import { dispatchMailBatch } from "../apps/worker/dispatch.ts";
import { decisionResponses } from "../packages/domain/decisions/history.ts";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { openDatabase } from "../packages/db/database.ts";
import { createWorkspace } from "../packages/domain/workspaces.ts";
import { createClient, createContact, updateContact } from "../packages/domain/clients.ts";
import { createItem } from "../packages/domain/renewals/commands.ts";
import { getCycle, cycleHistory, listCycles } from "../packages/domain/renewals/queries.ts";
import { issue, preview, startOtp, respond } from "../packages/domain/decisions/service.ts";
import { InviteCredentials } from "../packages/domain/invite-credentials.ts";
import { cancelSubscription } from "../packages/domain/billing/service.ts";
import { deleteWorkspace } from "../packages/domain/billing/deletion.ts";
import { processBilling } from "../apps/worker/billing.ts";
import { createRenewal, cycleFilter } from "../packages/contracts/renewals.ts";
import { responseDeadline, addDays, localToday } from "../packages/domain/renewal-dates.ts";

const urls = ["MIGRATION_DATABASE_URL", "DATABASE_URL", "WORKER_DATABASE_URL"].map(key => {
  const url = new URL(process.env[key] ?? "");
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.startsWith("/renewrelay_audit_")) {
    throw new Error("Use an isolated local renewrelay_audit_ database for all audit connections.");
  }
  return url.toString();
});
const admin = openDatabase(urls[0], 1);
const db = openDatabase(urls[1], 2);
const worker = openDatabase(urls[2], 2);
const observations = [];
const credentials = new InviteCredentials(randomBytes(32));
const otpSecret = randomBytes(32).toString("hex");
const today = localToday("Asia/Kolkata");
const user = { id: randomUUID(), email: randomUUID() + "@example.test", authenticatedAt: new Date(), mfaVerified: true };
const command = (operation, input = {}) => ({ actor: user, operation, input, key: randomUUID(), requestId: randomUUID() });
const record = (id, violated, observed) => observations.push({ id, status: violated ? "FAIL" : "PASS", observed });

try {
  await admin.user.create({ data: { id: user.id, email: user.email, name: "Synthetic audit owner", emailVerified: true } });
  async function workspace(name) {
    return createWorkspace(db, command("workspace.create"), { name, timezone: "Asia/Kolkata" });
  }
  const space = await workspace("Synthetic audit workflow");
  const wid = space.id;
  await admin.workspaceBilling.update({ where: { workspaceId: wid }, data: { paidThrough: new Date(Date.now() + 30 * 86400_000) } });
  const client = await createClient(db, command("client.create"), wid, { name: "Synthetic audit client" });
  const email = randomUUID() + "@example.test";
  const contact = await createContact(db, command("contact.create"), wid, client.id, { name: "Audit contact", email });
  async function item(label) {
    const input = createRenewal.parse({
      clientId: client.id, operatorId: user.id, service: label, provider: "Synthetic provider",
      expiryOn: addDays(today, 60), respondBy: addDays(today, 15),
      payer: "client", currency: "INR", clientQuoteMinor: 10000, term: "Annual", recurrence: "once",
    });
    return createItem(db, command("renewal.create", input), wid, input);
  }
  async function request(cycle) {
    const input = { contactId: contact.id, expectedVersion: cycle.version };
    const issued = await issue(db, command("decision.issue", input), wid, cycle.id, input, credentials, otpSecret);
    const job = await admin.decisionDelivery.findFirstOrThrow({ where: { requestId: issued.requestId, kind: "invitation" } });
    return { ...issued, token: credentials.decrypt(job.ciphertext, issued.requestId) };
  }
  async function otp(token) {
    let code;
    await startOtp(db, token, otpSecret, async (_email, value) => { code = value; });
    return code;
  }

  const first = await item("Contact-change audit");
  const initial = await request(first.cycle);
  await updateContact(db, command("contact.update"), wid, client.id, contact.id,
    { name: "Audit contact", email: randomUUID() + "@example.test", expectedVersion: 1 });
  let unavailableAfterChange = false;
  try { await preview(db, initial.token); } catch { unavailableAfterChange = true; }
  await updateContact(db, command("contact.update"), wid, client.id, contact.id,
    { name: "Audit contact", email, expectedVersion: 2 });
  let oldLinkCanApprove = false;
  try {
    const code = await otp(initial.token);
    const terms = await preview(db, initial.token);
    await respond(db, initial.token, otpSecret, randomUUID(), { code, expectedVersion: terms.version, choice: "approve" });
    oldLinkCanApprove = true;
  } catch {}
  record("RR-01", oldLinkCanApprove, { unavailableAfterChange, oldLinkCanApproveAfterAddressReverted: oldLinkCanApprove });

  const second = await item("Question-read audit");
  const questionRequest = await request(second.cycle);
  const question = "Synthetic question " + randomUUID();
  await respond(db, questionRequest.token, otpSecret, randomUUID(), {
    code: await otp(questionRequest.token), expectedVersion: questionRequest.version, choice: "question", question,
  });
  const detail = await getCycle(db, user, wid, second.cycle.id);
  const history = await cycleHistory(db, user, wid, second.cycle.id, { limit: 100 });
  const responses = await decisionResponses(db, user, wid, second.cycle.id, { limit: 100 });
  const questionVisible = JSON.stringify({ detail, history, responses }).includes(question);
  record("RR-02", !questionVisible, { storedQuestions: await admin.decisionResponse.count({ where: { requestId: questionRequest.requestId, choice: "question" } }), questionVisibleInStaffResponses: questionVisible });

  const unissued = await item("Unissued request audit");
  const queue = await listCycles(db, user, wid, cycleFilter.parse({ bucket: "waiting_on_client", itemId: unissued.item.id }));
  record("RR-03", queue.items.length > 0, {
    issuedRequests: await admin.decisionRequest.count({ where: { cycleId: unissued.cycle.id } }),
    waitingOnClientRows: queue.items.length,
  });

  for (let i = 0; i < 12; i++) await request((await item("Due reminder " + i)).cycle);
  const before = await admin.decisionDelivery.count({ where: { status: "pending", runAt: { lte: new Date() } } });
  let sends = 0;
  await dispatchMailBatch(worker, {
    credentials, origin: "http://127.0.0.1:3547", deduplicated: false,
    sendInvitation: async () => {},
    sendTransactional: async message => {
      if (message.subject === "RenewRelay renewal decision") sends++;
      return { id: null, deduplicated: false };
    },
  });
  record("RR-04", sends < before, { dueBeforeBatch: before, decisionSendsInBatch: sends,
    note: "Bounded dispatcher regression. Full pilot timing and provider quota evidence are separate." });

  const cancellationSpace = await workspace("Cancellation race audit");
  const cancelIntent = randomUUID();
  const subId = "sub_" + randomUUID().replaceAll("-", "");
  await admin.workspaceBilling.update({ where: { workspaceId: cancellationSpace.id }, data: {
    checkoutIntent: cancelIntent, providerId: subId, providerStatus: "active",
    checkoutState: "ready", paidThrough: new Date(Date.now() + 30 * 86400_000),
  } });
  const cancellationCalls = [];
  const cancellationProvider = {
    environment: "test",
    async create() { throw new Error("Creation is outside this fixture"); },
    async find() { return null; },
    async fetch() { return { id: subId, intentId: cancelIntent, workspaceId: cancellationSpace.id, status: "active", checkoutUrl: null, periods: [] }; },
    async cancel(_id, atTerm) {
      cancellationCalls.push(atTerm);
      if (atTerm) await deleteWorkspace(db, command("workspace.delete"), cancellationSpace.id,
        { confirmName: cancellationSpace.name, exportAcknowledged: true });
    },
  };
  await cancelSubscription(db, command("billing.cancel"), cancellationSpace.id, cancellationProvider);
  const raced = await admin.workspaceBilling.findUniqueOrThrow({ where: { workspaceId: cancellationSpace.id } });
  record("RR-05", !!raced.deletionRequestedAt && !raced.cancelRequestedAt, {
    deletionRequested: !!raced.deletionRequestedAt, pendingCancellationAfterConcurrentDelete: !!raced.cancelRequestedAt,
    providerCancellationModes: cancellationCalls.map(atTerm => atTerm ? "at-term" : "immediate"),
  });

  const conflictSpace = await workspace("Reconciliation race audit");
  const conflictIntent = randomUUID();
  const conflictSub = "sub_" + randomUUID().replaceAll("-", "");
  await admin.workspaceBilling.update({ where: { workspaceId: conflictSpace.id }, data: {
    checkoutIntent: conflictIntent, providerId: conflictSub, providerStatus: "created", checkoutState: "ready",
    trialEndsAt: new Date(0), reconcileAfter: new Date(0),
  } });
  const reconciliationProvider = {
    ...cancellationProvider,
    async cancel() {},
    async fetch(id) {
      if (id !== conflictSub) return cancellationProvider.fetch();
      await admin.workspaceBilling.update({ where: { workspaceId: conflictSpace.id }, data: { version: { increment: 1 } } });
      return { id: conflictSub, intentId: conflictIntent, workspaceId: conflictSpace.id, status: "active", checkoutUrl: null,
        periods: [{ paymentId: "pay_" + randomUUID().replaceAll("-", ""), invoiceId: "inv_synthetic", amountMinor: 149900,
          currency: "INR", start: new Date(Date.now() - 1000), end: new Date(Date.now() + 30 * 86400_000) }] };
    },
  };
  await processBilling(worker, reconciliationProvider);
  const conflicted = await admin.workspaceBilling.findUniqueOrThrow({ where: { workspaceId: conflictSpace.id } });
  const delayHours = (conflicted.reconcileAfter.getTime() - Date.now()) / 3600_000;
  record("RR-06", !conflicted.paidThrough && delayHours > 23, { paidPeriodApplied: !!conflicted.paidThrough, retryDelayHoursRounded: Math.round(delayHours) });

  let skippedMidnightRejected = false;
  try { responseDeadline("2027-03-13", "America/Havana"); } catch { skippedMidnightRejected = true; }
  record("RR-07", skippedMidnightRejected, { supportedTimezone: "America/Havana", responseDate: "2027-03-13", inclusiveDeadlineRejected: skippedMidnightRejected });

  const output = { auditedAt: new Date().toISOString(), environment: "isolated local synthetic PostgreSQL",
    applicationModified: false, observations, failedControls: observations.filter(v => v.status === "FAIL").length };
  if (process.env.AUDIT_OUTPUT_PATH) await writeFile(process.env.AUDIT_OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(JSON.stringify(output, null, 2));
  process.exitCode = output.failedControls ? 1 : 0;
} finally {
  await Promise.all([admin.$disconnect(), db.$disconnect(), worker.$disconnect()]);
}
