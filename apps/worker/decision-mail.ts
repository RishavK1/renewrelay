import { workspaceEntitlement } from "../../packages/domain/billing/policy";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../packages/db/generated/client";
import { setWorkspace } from "../../packages/db/database";
import type { InviteCredentials } from "../../packages/domain/invite-credentials";
import { dateText, localToday } from "../../packages/domain/renewal-dates";
import { MailFailure, type TransactionalMailer } from "../../packages/integrations/transactional-mail";

export async function clearStaleDecisionMail(db: PrismaClient, deduplicated: boolean, now = new Date()) {
  // Replay only a persisted payload inside the provider's deduplication window.
  if (deduplicated) await db.decisionDelivery.updateMany({
    where: { status: "leased", leaseUntil: { lt: now }, messageCiphertext: { not: null },
      firstAttemptAt: { gt: new Date(now.getTime() - 23 * 3600_000) } },
    data: { status: "pending", leaseToken: null, leaseUntil: null },
  });
  await db.decisionDelivery.updateMany({
    where: { status: "leased", leaseUntil: { lt: now } },
    data: { status: "uncertain", leaseToken: null, leaseUntil: null, lastError: "reconciliation_required" },
  });
  await db.decisionDelivery.updateMany({
    where: { expiresAt: { lte: now }, OR: [{ ciphertext: { not: null } }, { messageCiphertext: { not: null } }] },
    data: { ciphertext: null, messageCiphertext: null },
  });
}

export async function processDecisionMail(db: PrismaClient, send: TransactionalMailer, credentials: InviteCredentials,
  origin: string, deduplicated: boolean, now = new Date(), workspaceId?: string, maintenance = true) {
  if (maintenance) await clearStaleDecisionMail(db, deduplicated, now);
  const lease = randomUUID();
  const jobs = await db.$queryRaw<{ id: string }[]>`
    WITH job AS (
      SELECT id FROM decision_deliveries WHERE status = 'pending' AND "runAt" <= ${now}
        AND (${workspaceId ?? null}::uuid IS NULL OR "workspaceId" = ${workspaceId ?? null}::uuid)
      ORDER BY "runAt", id LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    UPDATE decision_deliveries d SET status = 'leased', "leaseToken" = ${lease}::uuid,
      "leaseUntil" = ${now}::timestamptz + interval '2 minutes', attempts = attempts + 1,
      "firstAttemptAt" = COALESCE("firstAttemptAt", ${now})
    FROM job WHERE d.id = job.id RETURNING d.id
  `;
  if (!jobs[0]) return false;
  const job = await db.decisionDelivery.findUniqueOrThrow({ where: { id: jobs[0].id } });
  const finish = (status: string, data: { providerId?: string | null; runAt?: Date; lastError?: string } = {}) =>
    db.decisionDelivery.updateMany({
      where: { id: job.id, leaseToken: lease, status: "leased" },
      data: { ...data, status, ciphertext: status === "pending" ? job.ciphertext : null,
        messageCiphertext: status === "pending" ? undefined : null, leaseToken: null, leaseUntil: null },
    });
  if (job.firstAttemptAt && now.getTime() - job.firstAttemptAt.getTime() >= 23 * 3600_000) {
    await finish("uncertain", { lastError: "reconciliation_required" });
    return true;
  }
  const eligible = await db.$transaction(async tx => {
    await setWorkspace(tx, job.workspaceId);
    const request = await tx.decisionRequest.findUnique({
      where: { workspaceId_id: { workspaceId: job.workspaceId, id: job.requestId } },
      include: { cycle: { include: { item: true } }, contact: true },
    });
    const access = await workspaceEntitlement(tx, job.workspaceId);
    const suppressed = await tx.suppressedRecipient.findUnique({ where: { email: job.recipient } });
    return access.writable && !!request && !suppressed && !request.supersededAt && !request.decidedAt &&
      !request.cycle.closedAt && !request.cycle.item.archivedAt && !request.contact.archivedAt &&
      request.recipientEmail === request.contact.email && request.recipientEmail === job.recipient &&
      dateText(request.respondBy) >= localToday(request.cycle.timezone, now);
  });
  if (!eligible || !job.ciphertext || job.expiresAt <= now) {
    await finish("canceled", { lastError: "no_longer_actionable" });
    return true;
  }
  let providerId: string | null | undefined;
  try {
    const token = credentials.decrypt(job.ciphertext, job.requestId);
    const message = job.messageCiphertext
      ? JSON.parse(credentials.decrypt(job.messageCiphertext, job.id)) as { to: string; subject: string; text: string; id: string }
      : { id: job.id, to: job.recipient, subject: "RenewRelay renewal decision",
          text: `Your agency has requested a renewal decision.\n\n${origin}/d/${token}\n\nDecision code: ${token}` };
    if (!job.messageCiphertext) {
      const saved = await db.decisionDelivery.updateMany({
        where: { id: job.id, status: "leased", leaseToken: lease },
        data: { messageCiphertext: credentials.encrypt(JSON.stringify(message), job.id) },
      });
      if (!saved.count) return true;
    }
    const result = await send(message);
    providerId = result.id;
  } catch (error) {
    const failure = error instanceof MailFailure ? error : new MailFailure(false, true);
    const delays = [60, 300, 1800, 7200];
    const delay = delays[job.attempts - 1];
    if (delay && failure.retryable && (!failure.ambiguous || deduplicated)) {
      await finish("pending", { runAt: new Date(now.getTime() + delay * (0.9 + Math.random() * 0.2) * 1000), lastError: "provider_transient" });
    } else {
      await finish(failure.ambiguous ? "uncertain" : "failed", { lastError: failure.ambiguous ? "reconciliation_required" : "provider_rejected" });
    }
    return true;
  }
  if (providerId !== undefined) await finish("sent", { providerId });
  return true;
}
