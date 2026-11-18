import { setWorkspace } from "../../packages/db/database";
import { entitlement } from "../../packages/domain/billing/policy";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../packages/db/generated/client";
import type { InviteCredentials } from "../../packages/domain/invite-credentials";
import type { Mailer } from "../../packages/integrations/smtp";

const retryDelays = [60, 300, 1800, 7200];
const safePreDeliveryCommands = new Set(["CONN", "EHLO", "HELO", "STARTTLS", "AUTH", "MAIL FROM", "RCPT TO"]);

async function claim(db: PrismaClient, workspaceId?: string) {
  const leaseToken = randomUUID();
  const rows = await db.$queryRaw<{ id: string }[]>`
    WITH next_job AS (
      SELECT id FROM mail_jobs
      WHERE (${workspaceId ?? null}::uuid IS NULL OR "workspaceId" = ${workspaceId ?? null}::uuid)
        AND status = 'pending' AND "runAt" <= now() AND "expiresAt" > now()
      ORDER BY "runAt", id LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    UPDATE mail_jobs job SET status = 'leased', "leaseToken" = ${leaseToken}::uuid,
      "leaseUntil" = now() + interval '2 minutes', attempts = job.attempts + 1
    FROM next_job WHERE job.id = next_job.id RETURNING job.id
  `;
  const job = rows[0];
  return job ? { id: job.id, leaseToken } : null;
}

export async function clearStaleMail(db: PrismaClient) {
  const now = new Date();
  await db.mailJob.updateMany({
    where: { status: "pending", expiresAt: { lte: now } },
    data: { status: "expired", ciphertext: null },
  });
  // An abandoned SMTP lease might already have delivered. SMTP cannot ensure replay deduplication.
  await db.mailJob.updateMany({
    where: { status: "leased", leaseUntil: { lte: now } },
    data: { status: "uncertain", ciphertext: null, leaseUntil: null, leaseToken: null },
  });
}

export async function processMail(db: PrismaClient, sendMail: Mailer, credentials: InviteCredentials, workspaceId?: string) {
  const lease = await claim(db, workspaceId);
  if (!lease) return false;

  const where = { ...lease, status: "leased" };
  const job = await db.mailJob.findFirst({ where });
  if (!job) return true;

  const finish = (status: string, nextRun?: Date) => db.mailJob.updateMany({
    where,
    data: {
      status,
      runAt: nextRun,
      ciphertext: status === "pending" ? job.ciphertext : null,
      leaseToken: null,
      leaseUntil: null,
    },
  });

  const eligible = await db.$transaction(async tx => {
    await setWorkspace(tx, job.workspaceId);
    const billing = await tx.workspaceBilling.findUnique({ where: { workspaceId: job.workspaceId } });
    const invitation = await tx.invitation.findUnique({ where: { workspaceId_id: { workspaceId: job.workspaceId, id: job.inviteId } } });
    const suppressed = await tx.suppressedRecipient.findUnique({ where: { email: job.recipient } });
    return billing && entitlement(billing).writable && invitation && !invitation.acceptedAt && !invitation.revokedAt &&
      invitation.expiresAt > new Date() && invitation.email === job.recipient && !suppressed;
  });
  if (!eligible) {
    await finish("canceled");
    return true;
  }
  if (job.expiresAt <= new Date()) {
    await finish("expired");
    return true;
  }

  let token: string;
  try {
    if (!job.ciphertext) throw new Error("Missing invitation credential.");
    token = credentials.decrypt(job.ciphertext, job.inviteId);
  } catch {
    await finish("failed");
    console.error("RenewRelay invitation credential unavailable", { jobId: job.id });
    return true;
  }

  try {
    await sendMail({
      to: job.recipient,
      subject: "Your RenewRelay workspace invitation",
      text: `Sign in with this verified email address to accept your invitation.\n\nInvitation code: ${token}`,
      messageId: `<${job.id}@renewrelay.invalid>`,
    });
  } catch (error) {
    const detail = error && typeof error === "object" ? error as { command?: string; responseCode?: number } : {};
    const definitelyRejected = typeof detail.responseCode === "number" && detail.responseCode >= 400;
    const safeToRetry = definitelyRejected || safePreDeliveryCommands.has(detail.command ?? "");
    const permanent = typeof detail.responseCode === "number" && detail.responseCode >= 500;
    const delay = retryDelays[job.attempts - 1];
    if (safeToRetry && !permanent && delay !== undefined) {
      const nextRun = new Date(Date.now() + delay * (0.9 + Math.random() * 0.2) * 1000);
      await finish(nextRun < job.expiresAt ? "pending" : "expired", nextRun);
    } else {
      await finish(safeToRetry ? "failed" : "uncertain");
    }
    console.error("RenewRelay invitation delivery exception", { jobId: job.id, attempt: job.attempts });
    return true;
  }

  await finish("sent");
  return true;
}
