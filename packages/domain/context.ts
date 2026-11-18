import { workspaceEntitlement } from "./billing/policy";
import { createHash } from "node:crypto";
import type { Prisma, PrismaClient, Role } from "../db/generated/client";
import { lockCommand, lockWorkspace, setActor, setWorkspace, type Transaction } from "../db/database";
import { DomainError, conflict, notFound } from "./errors";

export interface Actor {
  id: string;
  email: string;
  authenticatedAt: Date;
  mfaVerified: boolean;
}

export interface Command {
  actor: Actor;
  requestId: string;
  key: string;
  operation: string;
  input: unknown;
}

export const allStaff: readonly Role[] = ["owner", "admin", "member"];
export const managers: readonly Role[] = ["owner", "admin"];
export const owners: readonly Role[] = ["owner"];

export interface WorkspaceContext {
  tx: Transaction;
  workspaceId: string;
  role: Role;
}

export async function withWorkspace<T>(
  db: PrismaClient,
  actor: Actor,
  workspaceId: string,
  roles: readonly Role[],
  write: boolean,
  run: (context: WorkspaceContext) => Promise<T>,
  accessMode: "operational" | "safety" | "billing" = "operational",
) {
  return db.$transaction(async (tx) => {
    await setActor(tx, actor.id);
    const membershipKey = { workspaceId, userId: actor.id };
    const lookup = () => tx.membership.findUnique({ where: { workspaceId_userId: membershipKey } });
    const initial = await lookup();
    if (!initial || initial.removedAt) notFound();

    await setWorkspace(tx, workspaceId);
    if (write && !(await lockWorkspace(tx, workspaceId))) notFound();
    const membership = write ? await lookup() : initial;
    if (!membership || membership.removedAt) notFound();
    if (!roles.includes(membership.role)) {
      throw new DomainError(403, "forbidden", "Your workspace role cannot perform this action.");
    }
    if (membership.role !== "member" && !actor.mfaVerified) {
      throw new DomainError(403, "mfa_required", "Set up and verify two-factor authentication for administrator access.");
    }
    const access = await workspaceEntitlement(tx, workspaceId);
    if (access.mode === "deleting" && accessMode !== "billing") {
      throw new DomainError(410, "workspace_deleting", "This workspace is scheduled for deletion.");
    }
    if (write && accessMode === "operational" && !access.writable) {
      throw new DomainError(403, "workspace_read_only", "This workspace currently permits reading and exporting.");
    }
    return run({ tx, workspaceId, role: membership.role });
  }, write ? undefined : { isolationLevel: "RepeatableRead" });
}

export async function once<T extends Prisma.InputJsonValue>(
  tx: Transaction,
  cmd: Command,
  scopeId: string,
  run: () => Promise<T>,
  identity = false,
) {
  const scope = JSON.stringify([cmd.operation, scopeId]);
  const where = { actorId: cmd.actor.id, scope, key: cmd.key };
  const digest = createHash("sha256").update(JSON.stringify(cmd.input)).digest("hex");
  await lockCommand(tx, [where.actorId, where.scope, where.key]);
  const receipt = identity
    ? await tx.identityReceipt.findUnique({ where: { actorId_scope_key: where } })
    : await tx.commandReceipt.findUnique({ where: { actorId_scope_key: where } });
  if (receipt) {
    if (receipt.digest !== digest) conflict("idempotency_conflict", "This key was used with different input.");
    return receipt.result as T;
  }
  const result = await run();
  if (identity) await tx.identityReceipt.create({ data: { ...where, digest, result } });
  else await tx.commandReceipt.create({ data: { ...where, digest, result } });
  return result;
}

export function checkVersion(actual: number, expected: number) {
  if (actual !== expected) conflict("stale_version", "This record changed. Reload it and try again.");
}

export function requireRecentAuth(actor: Actor) {
  if (Date.now() - actor.authenticatedAt.getTime() > 10 * 60_000) {
    throw new DomainError(403, "reauthentication_required", "Sign in again to complete this action.");
  }
}

export async function audit(
  tx: Transaction,
  cmd: Command,
  workspaceId: string,
  event: string,
  entityId: string,
  details: Prisma.InputJsonObject = {},
) {
  await tx.auditEvent.create({
    data: { workspaceId, event, entityId, details, actorId: cmd.actor.id, requestId: cmd.requestId },
  });
}
