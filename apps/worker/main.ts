import { writeFile } from "node:fs/promises";
import { assertReady } from "../../packages/operations/readiness";
import { inspectWorker } from "../../packages/operations/worker-health";
import { metric, logError, flushDatabaseMetrics } from "../../packages/operations/telemetry";
import { clearStaleMail } from "./mail-jobs";
import { createSendLimiter, dispatchMailBatch } from "./dispatch";
import { billingProvider } from "../../packages/integrations/billing-config";
import { processBilling, enforceBilling } from "./billing";
import { purgeDeletedWorkspaces } from "./purge";
import { scheduleWorkspaceMail } from "./internal-mail";
import { transactionalMailer } from "../../packages/integrations/transactional-mail";
import { processMailEvents } from "./mail-events";
import "dotenv/config";
import { setTimeout as wait } from "node:timers/promises";
import { workerConfig } from "../../packages/contracts/environment";
import { openDatabase } from "../../packages/db/database";
import { InviteCredentials } from "../../packages/domain/invite-credentials";
import { createMailer } from "../../packages/integrations/smtp";

const config = workerConfig();

const db = openDatabase(config.WORKER_DATABASE_URL, config.WORKER_MAIL_CONCURRENCY + 2);
await assertReady(db);
const credentials = new InviteCredentials(Buffer.from(config.INVITE_ENCRYPTION_KEY, "base64url"));
const invitationMailer = createMailer({ smtpUrl: config.SMTP_URL, from: config.MAIL_FROM });
const transactionMailer = transactionalMailer({ smtpUrl: config.SMTP_URL, from: config.MAIL_FROM, apiKey: config.RESEND_API_KEY });
const limitSend = createSendLimiter(config.WORKER_MAIL_RATE_PER_SECOND);
const sendMail: typeof invitationMailer = message => limitSend(() => invitationMailer(message));
const sendTransactional: typeof transactionMailer = message => limitSend(() => transactionMailer(message));
const shutdown = new AbortController();
let dispatchCursor: string | undefined;
let scheduleCursor: string | undefined;
let lastTelemetry = 0;
let lastImportCleanup = 0;
let lastSchedule = 0;
let lastBilling = 0;
let billingCursor: string | undefined;
process.once("SIGTERM", () => shutdown.abort());
process.once("SIGINT", () => shutdown.abort());

async function isolated(name: string, run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    logError("worker", name, error);
    metric("worker", { WorkerErrors: 1 });
  }
}

try {
  while (!shutdown.signal.aborted) {
    await writeFile(process.env.WORKER_HEARTBEAT_FILE ?? "/tmp/renewrelay-worker-heartbeat", String(Date.now()), { mode: 0o600 });
    if (Date.now() - lastTelemetry >= 30_000) {
      await isolated("telemetry", async () => metric("worker", { WorkerHeartbeat: 1, ...await inspectWorker(db) }));
      flushDatabaseMetrics("worker");
      lastTelemetry = Date.now();
    }
    if (Date.now() - lastBilling >= 30_000) {
      if (config.RAZORPAY_BILLING_ENABLED === "true") {
        await isolated("billing-events", () => processBilling(db, billingProvider(), new Date(), credentials));
      }
      await isolated("billing-access", async () => {
        billingCursor = (await enforceBilling(db, new Date(), billingCursor)).nextCursor;
      });
      if (config.WORKSPACE_PURGE_ENABLED === "true") {
        await isolated("workspace-purge", () => purgeDeletedWorkspaces(db));
      }
      lastBilling = Date.now();
    }
    await isolated("mail-events", () => processMailEvents(db));
    let pending = false;
    if (config.OUTBOUND_MAIL_ENABLED === "false") {
      await isolated("invitation-maintenance", () => clearStaleMail(db));
    }
    if (config.OUTBOUND_MAIL_ENABLED === "true") {
      if (Date.now() - lastSchedule > 30_000) {
        await isolated("schedules", async () => {
          const result = await scheduleWorkspaceMail(db, new Date(), scheduleCursor);
          scheduleCursor = result.nextCursor;
        });
        lastSchedule = Date.now();
      }
      await isolated("mail-dispatch", async () => {
        const result = await dispatchMailBatch(db, {
          sendInvitation: sendMail, sendTransactional, credentials,
          origin: new URL(config.BETTER_AUTH_URL).origin, deduplicated: !!config.RESEND_API_KEY,
          concurrency: config.WORKER_MAIL_CONCURRENCY, maxJobs: config.WORKER_MAIL_BATCH_SIZE,
          after: dispatchCursor, signal: shutdown.signal,
          onError: lane => console.error("RenewRelay mail lane failed", { lane }),
        });
        dispatchCursor = result.after;
        pending = result.pending;
      });
    }
    if (Date.now() - lastImportCleanup >= 60_000) {
      await isolated("rate-cleanup", () => db.$executeRaw`DELETE FROM api_rate_limits WHERE key IN (SELECT key FROM api_rate_limits WHERE "expiresAt" <= now() LIMIT 500)`);
      await isolated("import-cleanup", () => db.$executeRaw`DELETE FROM renewal_imports WHERE id IN (SELECT id FROM renewal_imports WHERE "committedAt" IS NULL AND "expiresAt" <= now() LIMIT 100)`);
      await isolated("session-cleanup", () => db.$executeRaw`DELETE FROM decision_sessions WHERE id IN (SELECT id FROM decision_sessions WHERE "expiresAt" <= now() LIMIT 500)`);
      lastImportCleanup = Date.now();
    }
    if (!shutdown.signal.aborted) {
      try {
        await wait(pending ? 100 : config.WORKER_POLL_MS, undefined, { signal: shutdown.signal });
      } catch (error) {
        if (!shutdown.signal.aborted) throw error;
      }
    }
  }
} finally {
  await db.$disconnect();
}
