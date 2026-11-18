import { requireOperational } from "./billing/policy";
import { randomUUID } from "node:crypto";
import type { PrismaClient, Role, Workspace } from "../db/generated/client";
import { lockWorkspace, setActor, setInviteDigest, setWorkspace, type Transaction } from "../db/database";
import { type Actor, type Command, allStaff, audit, checkVersion, managers, once, owners, requireRecentAuth, withWorkspace } from "./context";
import { DomainError, conflict, notFound } from "./errors";
import { generateInviteToken, inviteDigest, type InviteCredentials } from "./invite-credentials";
import { type Page, pageResult } from "./pagination";
import { checkOperator } from "./renewals/records";

const inviteLifetime = 48 * 60 * 60 * 1000;

function workspaceView(workspace: Workspace, role: Role) {
  const { id, name, timezone, version } = workspace;
  return { id, name, timezone, version, role };
}

export function listWorkspaces(db: PrismaClient, actor: Actor, page: Page) {
  const limit = page.limit ?? 25;
  return db.$transaction(async (tx) => {
    await setActor(tx, actor.id);
    const memberships = await tx.membership.findMany({
      where: { userId: actor.id, removedAt: null, workspaceId: page.after ? { gt: page.after } : undefined },
      include: { workspace: true },
      orderBy: { workspaceId: "asc" },
      take: limit + 1,
    });
    if (!actor.mfaVerified && memberships.some(member => member.role !== "member")) {
      throw new DomainError(403, "mfa_required", "Verify two-factor authentication for administrator access.");
    }
    return pageResult(memberships.map(({ workspace, role }) => workspaceView(workspace, role)), limit);
  });
}

export function createWorkspace(db: PrismaClient, cmd: Command, input: { name: string; timezone: string }) {
  if (!cmd.actor.mfaVerified) throw new DomainError(403, "mfa_required", "Verify two-factor authentication before creating a workspace.");
  return db.$transaction(async (tx) => {
    await setActor(tx, cmd.actor.id);
    const result = await once(tx, cmd, "", async () => {
      const id = randomUUID();
      await setWorkspace(tx, id);
      const workspace = await tx.workspace.create({ data: { id, ...input } });
      await tx.workspaceBilling.create({ data: { workspaceId: id, trialEndsAt: new Date(Date.now() + 14 * 86400_000) } });
      await tx.$executeRaw`INSERT INTO notification_workspaces (id) VALUES (${id}::uuid)`;
      await tx.membership.create({ data: { workspaceId: id, userId: cmd.actor.id, email: cmd.actor.email, role: "owner" } });
      await audit(tx, cmd, id, "workspace.created", id);
      return workspaceView(workspace, "owner");
    });
    const membership = await tx.membership.findUnique({
      where: { workspaceId_userId: { workspaceId: result.id, userId: cmd.actor.id } },
      select: { removedAt: true },
    });
    if (!membership || membership.removedAt) notFound();
    return result;
  });
}

export function getWorkspace(db: PrismaClient, actor: Actor, id: string) {
  return withWorkspace(db, actor, id, allStaff, false, async ({ tx, role }) =>
    workspaceView(await tx.workspace.findUniqueOrThrow({ where: { id } }), role),
  );
}

export function listMembers(db: PrismaClient, actor: Actor, workspaceId: string) {
  return withWorkspace(db, actor, workspaceId, managers, false, ({ tx }) => tx.membership.findMany({
    where: { workspaceId, removedAt: null },
    select: { userId: true, email: true, role: true, joinedAt: true },
    orderBy: [{ joinedAt: "asc" }, { userId: "asc" }],
  }));
}

export function removeMember(db: PrismaClient, cmd: Command, workspaceId: string, userId: string, replacementUserId?: string) {
  return withWorkspace(db, cmd.actor, workspaceId, managers, true, ({ tx }) =>
    once(tx, cmd, workspaceId, async () => {
      const where = { workspaceId_userId: { workspaceId, userId } };
      const target = await tx.membership.findUnique({ where });
      if (!target || target.removedAt) notFound();
      if (target.role === "owner") conflict("owner_required", "Transfer ownership before removing the owner.");
      if (target.userId === cmd.actor.id) conflict("self_removal", "Ask another workspace manager to remove your membership.");
      const activeAssignments = { workspaceId, operatorId: userId, closedAt: null };
      const assignments = await tx.renewalCycle.findMany({ where: activeAssignments, select: { id: true, itemId: true } });
      if (replacementUserId === userId) conflict("invalid_operator", "Choose a different active member.");
      if (replacementUserId) await checkOperator(tx, workspaceId, replacementUserId);
      if (assignments.length && !replacementUserId) {
        conflict("replacement_required", "Assign the member's open work to an active replacement.");
      }
      if (assignments.length && replacementUserId) {
        await tx.renewalCycle.updateMany({
          where: activeAssignments, data: { operatorId: replacementUserId, version: { increment: 1 } },
        });
        await tx.renewalItem.updateMany({
          where: { workspaceId, id: { in: assignments.map(({ itemId }) => itemId) } },
          data: { operatorId: replacementUserId, version: { increment: 1 } },
        });
        for (const { id } of assignments) {
          await audit(tx, cmd, workspaceId, "cycle.operator_reassigned", id, { previousOperatorId: userId, replacementUserId });
        }
      }
      await tx.membership.update({ where, data: { removedAt: new Date() } });
      // Revoke any pending invitation to rejoin under the removed member's same address.
      const pending = await tx.invitation.findMany({
        where: { workspaceId, email: target.email, acceptedAt: null, revokedAt: null },
        select: { id: true },
      });
      for (const { id } of pending) await revokeInvite(tx, workspaceId, id);
      await audit(tx, cmd, workspaceId, "membership.removed", userId, {
        previousRole: target.role, reassigned: assignments.length,
      });
      return { userId, removed: true };
    }),
    "safety",
  );
}

export function transferOwnership(db: PrismaClient, cmd: Command, workspaceId: string, input: { userId: string; expectedVersion: number }) {
  return withWorkspace(db, cmd.actor, workspaceId, allStaff, true, ({ tx, role }) => {
    requireRecentAuth(cmd.actor);
    return once(tx, cmd, workspaceId, async () => {
      if (!owners.includes(role)) throw new DomainError(403, "forbidden", "Only the owner can transfer ownership.");
      const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      checkVersion(workspace.version, input.expectedVersion);
      const target = await tx.membership.findUnique({ where: { workspaceId_userId: { workspaceId, userId: input.userId } } });
      if (!target || target.removedAt || target.userId === cmd.actor.id) {
        conflict("invalid_owner", "Choose a different active member as the new owner.");
      }
      await tx.membership.update({
        where: { workspaceId_userId: { workspaceId, userId: cmd.actor.id } },
        data: { role: "admin" },
      });
      await tx.membership.update({
        where: { workspaceId_userId: { workspaceId, userId: target.userId } },
        data: { role: "owner" },
      });
      const updated = await tx.workspace.update({
        where: { id: workspaceId },
        data: { version: { increment: 1 } },
      });
      await audit(tx, cmd, workspaceId, "ownership.transferred", workspaceId, { from: cmd.actor.id, to: target.userId });
      return { workspaceId, ownerId: target.userId, version: updated.version };
    });
  });
}

const inviteFields = { id: true, email: true, role: true, expiresAt: true, acceptedAt: true, revokedAt: true } as const;

export function listInvites(db: PrismaClient, actor: Actor, workspaceId: string, page: Page) {
  const limit = page.limit ?? 25;
  return withWorkspace(db, actor, workspaceId, managers, false, async ({ tx }) => pageResult(
    await tx.invitation.findMany({
      where: { workspaceId, id: page.after ? { gt: page.after } : undefined },
      select: inviteFields,
      orderBy: { id: "asc" },
      take: limit + 1,
    }),
    limit,
  ));
}

export function createInvite(db: PrismaClient, cmd: Command, workspaceId: string, input: { email: string; role: "admin" | "member" }, credentials: InviteCredentials) {
  return withWorkspace(db, cmd.actor, workspaceId, managers, true, ({ tx }) =>
    once(tx, cmd, workspaceId, async () => {
      const now = new Date();
      const pending = { workspaceId, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } };
      const active = { workspaceId, removedAt: null };
      if (await tx.membership.findFirst({ where: { ...active, email: input.email } })) {
        conflict("already_member", "This email already belongs to a workspace member.");
      }
      if (await tx.invitation.findFirst({ where: { ...pending, email: input.email } })) {
        conflict("invite_pending", "This address already has a pending invitation.");
      }
      const seats = await tx.membership.count({ where: active }) + await tx.invitation.count({ where: pending });
      const { limits } = await requireOperational(tx, workspaceId);
      if (seats >= limits.seats) conflict("seat_limit", `All ${limits.seats} seats are used or reserved.`);

      const token = generateInviteToken();
      const expiresAt = new Date(now.getTime() + inviteLifetime);
      const invitation = await tx.invitation.create({
        data: { workspaceId, ...input, expiresAt, tokenDigest: inviteDigest(token), issuedBy: cmd.actor.id },
        select: inviteFields,
      });
      await tx.mailJob.create({
        data: { workspaceId, inviteId: invitation.id, recipient: input.email, expiresAt, ciphertext: credentials.encrypt(token, invitation.id) },
      });
      await audit(tx, cmd, workspaceId, "invitation.created", invitation.id, { role: input.role });
      return { ...invitation, expiresAt: expiresAt.toISOString(), acceptedAt: null, revokedAt: null };
    }),
  );
}

function cancelInviteMail(tx: Transaction, workspaceId: string, inviteId: string) {
  return tx.mailJob.updateMany({
    where: { workspaceId, inviteId, status: { in: ["pending", "leased"] } },
    data: { status: "canceled", ciphertext: null, leaseToken: null, leaseUntil: null },
  });
}

async function revokeInvite(tx: Transaction, workspaceId: string, id: string) {
  await tx.invitation.update({ where: { workspaceId_id: { workspaceId, id } }, data: { revokedAt: new Date() } });
  await cancelInviteMail(tx, workspaceId, id);
}

export function revokeInvitation(db: PrismaClient, cmd: Command, workspaceId: string, id: string) {
  return withWorkspace(db, cmd.actor, workspaceId, managers, true, ({ tx }) =>
    once(tx, cmd, workspaceId, async () => {
      const invite = await tx.invitation.findUnique({ where: { workspaceId_id: { workspaceId, id } } });
      if (!invite) notFound();
      if (invite.acceptedAt || invite.revokedAt) conflict("invite_closed", "The invitation is already closed.");
      await revokeInvite(tx, workspaceId, id);
      await audit(tx, cmd, workspaceId, "invitation.revoked", id);
      return { id, revoked: true };
    }),
    "safety",
  );
}

export function consumeInvitation(db: PrismaClient, cmd: Command, token: string) {
  return db.$transaction(async (tx) => {
    const digest = inviteDigest(token);
    await setActor(tx, cmd.actor.id);
    await setInviteDigest(tx, digest);
    const match = await tx.invitation.findUnique({ where: { tokenDigest: digest } });
    if (!match || match.email !== cmd.actor.email) notFound();
    const { workspaceId, id } = match;
    await setWorkspace(tx, workspaceId);
    if (!(await lockWorkspace(tx, workspaceId))) notFound();
    const invite = await tx.invitation.findUniqueOrThrow({ where: { workspaceId_id: { workspaceId, id } } });
    const where = { workspaceId_userId: { workspaceId, userId: cmd.actor.id } };
    const membership = await tx.membership.findUnique({ where });
    if (invite.acceptedAt && (!membership || membership.removedAt)) notFound();

    return once(tx, { ...cmd, input: { digest } }, id, async () => {
      const now = new Date();
      if (invite.acceptedAt || invite.revokedAt || invite.expiresAt <= now) {
        throw new DomainError(410, "invite_unavailable", "This invitation is no longer available.");
      }
      if (membership && !membership.removedAt) conflict("already_member", "You already belong to this workspace.");
      const active = await tx.membership.count({ where: { workspaceId, removedAt: null } });
      const { limits } = await requireOperational(tx, workspaceId);
      if (active >= limits.seats) conflict("seat_limit", `All ${limits.seats} seats are in use.`);
      await tx.membership.upsert({
        where,
        create: { workspaceId, userId: cmd.actor.id, email: cmd.actor.email, role: invite.role },
        update: { email: cmd.actor.email, role: invite.role, removedAt: null, joinedAt: now },
      });
      await tx.invitation.update({ where: { workspaceId_id: { workspaceId, id } }, data: { acceptedAt: now } });
      await cancelInviteMail(tx, workspaceId, id);
      await audit(tx, cmd, workspaceId, "invitation.accepted", id, { role: invite.role });
      return { workspaceId, role: invite.role };
    });
  });
}
