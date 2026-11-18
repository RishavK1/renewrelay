import type { InviteCredentials } from "../../packages/domain/invite-credentials";
import { workspaceEntitlement } from "../../packages/domain/billing/policy";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../packages/db/generated/client";
import { setWorkspace } from "../../packages/db/database";
import { internalSchedules } from "../../packages/domain/notifications/schedules";
import { addDays, dateText, localInstant, localToday } from "../../packages/domain/renewal-dates";
import { MailFailure, type TransactionalMailer } from "../../packages/integrations/transactional-mail";

export async function scheduleWorkspaceMail(db: PrismaClient, now = new Date(), after?: string) {
  const rows = await db.notificationWorkspace.findMany({
    where: after ? { id: { gt: after } } : {}, orderBy: { id: "asc" }, take: 101,
  });
  const workspaces = rows.slice(0, 100);
  for (const { id } of workspaces) {
    await db.$transaction(async tx => {
      await setWorkspace(tx, id);
      if (!(await workspaceEntitlement(tx, id, now)).writable) return;
      const workspace = await tx.workspace.findUniqueOrThrow({ where: { id } });
      const today = localToday(workspace.timezone, now);
      const members = await tx.membership.findMany({ where: { workspaceId: id, removedAt: null } });
      const recipients = new Map(members.map(member => [member.userId, member.email]));
      const owner = members.find(member => member.role === "owner");
      let cursor: string | undefined;
      let overdue = false;
      for (;;) {
        const cycles = await tx.renewalCycle.findMany({
          where: { workspaceId: id, id: cursor ? { gt: cursor } : undefined,
            closedAt: null, state: { not: "draft" }, item: { archivedAt: null } },
          orderBy: { id: "asc" }, take: 100,
        });
        const jobs = cycles.flatMap(cycle => {
          const recipient = recipients.get(cycle.operatorId);
          return recipient ? internalSchedules(cycle, recipient, now) : [];
        });
        if (jobs.length) await tx.internalNotification.createMany({ data: jobs, skipDuplicates: true });
        overdue ||= cycles.some(cycle => dateText(cycle.nextActionOn) < today);
        if (cycles.length < 100) break;
        cursor = cycles.at(-1)!.id;
      }
      if (owner && overdue) {
        const runAt = localInstant(today, workspace.timezone, 9);
        const dedupeKey = `overdue/${id}/${today}`;
        await tx.internalNotification.upsert({
          where: { dedupeKey },
          create: { workspaceId: id, recipientId: owner.userId, recipient: owner.email, kind: "overdue",
            dedupeKey, runAt, expiresAt: localInstant(addDays(today, 1), workspace.timezone, 9) },
          update: {},
        });
      }
    }, { timeout: 30_000 });
  }
  return { nextCursor: rows.length > 100 ? workspaces.at(-1)!.id : undefined };
}

export async function clearStaleInternalMail(db: PrismaClient, now = new Date(), deduplicated = false) {
  if (deduplicated) await db.internalNotification.updateMany({
    where: { status: "leased", leaseUntil: { lt: now }, messageCiphertext: { not: null },
      firstAttemptAt: { gt: new Date(now.getTime() - 23 * 3600_000) } },
    data: { status: "pending", leaseToken: null, leaseUntil: null },
  });
  await db.internalNotification.updateMany({
    where: { status: "leased", leaseUntil: { lt: now } },
    data: { status: "uncertain", leaseToken: null, leaseUntil: null, lastError: "reconciliation_required" },
  });
  await db.internalNotification.updateMany({ where: { expiresAt: { lte: now }, messageCiphertext: { not: null } }, data: { messageCiphertext: null } });
}

export interface InternalMailOptions {
  credentials: InviteCredentials;
  deduplicated: boolean;
  now?: Date;
  workspaceId?: string;
  maintenance?: boolean;
}
export async function processInternalMail(db: PrismaClient, send: TransactionalMailer, options: InternalMailOptions) {
  const { now = new Date(), workspaceId, maintenance = true, credentials, deduplicated } = options;
  if (maintenance) await clearStaleInternalMail(db, now, deduplicated);
  const lease = randomUUID();
  const jobs = await db.$queryRaw<{ id: string }[]>`
    WITH job AS (
      SELECT id FROM internal_notifications WHERE status = 'pending' AND "runAt" <= ${now}
        AND (${workspaceId ?? null}::uuid IS NULL OR "workspaceId" = ${workspaceId ?? null}::uuid)
      ORDER BY "runAt", id LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    UPDATE internal_notifications n SET status = 'leased', "leaseToken" = ${lease}::uuid,
      "leaseUntil" = ${now}::timestamptz + interval '2 minutes', attempts = attempts + 1, "firstAttemptAt" = COALESCE("firstAttemptAt", ${now})
    FROM job WHERE n.id = job.id RETURNING n.id
  `;
  if (!jobs[0]) return false;
  const job = await db.internalNotification.findUniqueOrThrow({ where: { id: jobs[0].id } });
  const text = await db.$transaction(async tx => {
    await setWorkspace(tx, job.workspaceId);
    const access = await workspaceEntitlement(tx, job.workspaceId, now);
    if (!access.writable && (job.kind !== "billing_warning" || access.mode === "deleting")) return null;
    const recipient = await tx.membership.findFirst({
      where: { workspaceId: job.workspaceId, userId: job.recipientId, removedAt: null, email: job.recipient },
    });
    if (!recipient || job.expiresAt <= now || await tx.suppressedRecipient.findUnique({ where: { email: job.recipient } })) return null;
    if (job.kind === "billing_warning") {
      if (recipient.role !== "owner") return null;
      return "Your RenewRelay subscription needs attention. Open the workspace billing settings to review the trial or payment status.";
    }
    if (job.cycleId) {
      const cycle = await tx.renewalCycle.findFirst({
        where: { workspaceId: job.workspaceId, id: job.cycleId, closedAt: null, operatorId: job.recipientId,
          state: { not: "draft" }, item: { archivedAt: null } },
      });
      // A changed deadline produces a different key. Obsolete schedules stop at dispatch.
      if (!cycle) return null;
      if (job.kind === "client_activity") {
        return `RenewRelay received client activity for ${cycle.service}. Review client responses and question resolutions for this cycle in your workspace.`;
      }
      if (!job.dedupeKey.includes(dateText(cycle.nextActionOn))) return null;
      return `RenewRelay action due ${dateText(cycle.nextActionOn)} for ${cycle.service}. Open your workspace to review the next action.`;
    }
    if (recipient.role !== "owner") return null;
    const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: job.workspaceId } });
    const count = await tx.renewalCycle.count({
      where: { workspaceId: job.workspaceId, closedAt: null, state: { not: "draft" },
        nextActionOn: { lt: new Date(localToday(workspace.timezone, now) + "T00:00:00Z") }, item: { archivedAt: null } },
    });
    return count ? `RenewRelay has ${count} overdue actions in ${workspace.name}. Open the workspace to review them.` : null;
  });
  let status = "canceled";
  let runAt: Date | undefined;
  let lastError: string | undefined;
  if (text) {
    try {
      if (job.firstAttemptAt && now.getTime() - job.firstAttemptAt.getTime() >= 23 * 3600_000) throw new MailFailure(false, true);
      const message = job.messageCiphertext
        ? JSON.parse(credentials.decrypt(job.messageCiphertext, job.id)) as { id: string; to: string; subject: string; text: string }
        : { id: job.id, to: job.recipient, subject: "RenewRelay action reminder", text };
      const saved = await db.internalNotification.updateMany({
        where: { id: job.id, status: "leased", leaseToken: lease },
        data: { messageCiphertext: credentials.encrypt(JSON.stringify(message), job.id) },
      });
      if (!saved.count) return true;
      await send(message);
      status = "sent";
    } catch (error) {
      const failure = error instanceof MailFailure ? error : new MailFailure(false, true);
      const delays = [60, 300, 1800, 7200];
      const delay = delays[job.attempts - 1];
      if (failure.retryable && (!failure.ambiguous || deduplicated) && delay && now.getTime() + delay * 1000 < job.expiresAt.getTime()) {
        status = "pending";
        runAt = new Date(now.getTime() + delay * (0.9 + Math.random() * 0.2) * 1000);
      } else status = failure.ambiguous ? "uncertain" : "failed";
      lastError = failure.ambiguous ? "reconciliation_required" : "provider_rejected";
    }
  }
  await db.internalNotification.updateMany({
    where: { id: job.id, status: "leased", leaseToken: lease },
    data: { status, runAt, lastError, messageCiphertext: status === "pending" ? undefined : null, leaseToken: null, leaseUntil: null },
  });
  return true;
}
