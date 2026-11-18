import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { setTimeout as wait } from "node:timers/promises";
import { openDatabase } from "../packages/db/database.ts";
import { createWorkspace } from "../packages/domain/workspaces.ts";
import { listCycles } from "../packages/domain/renewals/queries.ts";
import { cycleFilter } from "../packages/contracts/renewals.ts";
import { InviteCredentials, inviteDigest } from "../packages/domain/invite-credentials.ts";
import { addDays, localToday, responseDeadline, sqlDate } from "../packages/domain/renewal-dates.ts";
import { dispatchMailBatch, createSendLimiter } from "../apps/worker/dispatch.ts";
import { scheduleWorkspaceMail } from "../apps/worker/internal-mail.ts";

const urls = ["MIGRATION_DATABASE_URL", "DATABASE_URL", "WORKER_DATABASE_URL"].map(key => {
  const url = new URL(process.env[key] ?? "");
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname.startsWith("/renewrelay_audit_"), "Use isolated local audit connections.");
  return url;
});
assert.ok(urls.every(url => url.host === urls[0].host && url.pathname === urls[0].pathname), "All roles must use the same database.");
const admin = openDatabase(urls[0].toString(), 1);
const app = openDatabase(urls[1].toString(), 2);
const worker = openDatabase(urls[2].toString(), 8);
const credentials = new InviteCredentials(randomBytes(32));
const actor = { id: randomUUID(), email: randomUUID() + "@example.test", authenticatedAt: new Date(), mfaVerified: true };
const today = localToday("Asia/Kolkata");
const expiryOn = sqlDate(addDays(today, 60));
const respondBy = sqlDate(addDays(today, 7));
const deadlineAt = responseDeadline(addDays(today, 7), "Asia/Kolkata");
const ids = [];
const queryTimes = [];
const errors = [];
try {
  assert.equal(await admin.workspace.count(), 0, "Prepare a fresh migrated database for each run.");
  await admin.user.create({ data: { id: actor.id, email: actor.email, name: "Synthetic load operator", emailVerified: true } });
  for (let index = 0; index < 100; index++) {
    const space = await createWorkspace(app, { actor, key: randomUUID(), operation: "workspace.create", input: {}, requestId: randomUUID() },
      { name: "Synthetic load " + index, timezone: "Asia/Kolkata" });
    ids.push(space.id);
    await admin.workspaceBilling.update({ where: { workspaceId: space.id }, data: { paidThrough: new Date(Date.now() + 30 * 86400_000) } });
    const clientId = randomUUID();
    const contactId = randomUUID();
    const email = randomUUID() + "@example.test";
    await admin.client.create({ data: { id: clientId, workspaceId: space.id, name: "Load customer" } });
    await admin.contact.create({ data: { id: contactId, workspaceId: space.id, clientId, name: "Load recipient", email } });
    const items = [];
    const cycles = [];
    const requests = [];
    const links = [];
    const deliveries = [];
    const internal = [];
    for (let item = 0; item < 100; item++) {
      const itemId = randomUUID(), cycleId = randomUUID(), requestId = randomUUID();
      const common = { workspaceId: space.id, operatorId: actor.id, service: "Synthetic hosting " + item, provider: "Synthetic host" };
      items.push({ ...common, id: itemId, clientId, recurrence: "once", anchorOn: expiryOn });
      cycles.push({ ...common, id: cycleId, itemId, sequence: 1, state: "open", expiryOn, respondBy,
        nextActionOn: respondBy, timezone: "Asia/Kolkata", payer: "client", rebillable: false,
        currency: "INR", clientQuoteMinor: 10000, term: "Annual" });
      requests.push({ id: requestId, workspaceId: space.id, cycleId, contactId, revision: 1,
        issuerId: actor.id, issuerLabel: space.name, recipientEmail: email, service: common.service,
        currency: "INR", amountMinor: 10000, term: "Annual", respondBy, deadlineAt });
      if (item < 50) {
        const token = randomBytes(32).toString("base64url");
        links.push({ workspaceId: space.id, requestId, digest: inviteDigest(token), validFrom: new Date(), expiresAt: deadlineAt });
        deliveries.push({ workspaceId: space.id, requestId, kind: "reminder", recipient: email,
          runAt: new Date(), expiresAt: new Date(Date.now() + 86400_000), ciphertext: credentials.encrypt(token, requestId) });
      } else internal.push({ workspaceId: space.id, cycleId, recipientId: actor.id, recipient: actor.email,
        kind: "deadline", dedupeKey: JSON.stringify(["internal", cycleId, actor.id, addDays(today, 7), 7]),
        runAt: new Date(), expiresAt: new Date(Date.now() + 86400_000) });
    }
    await admin.renewalItem.createMany({ data: items });
    await admin.renewalCycle.createMany({ data: cycles });
    await admin.decisionRequest.createMany({ data: requests });
    await admin.decisionLink.createMany({ data: links });
    await admin.decisionDelivery.createMany({ data: deliveries });
    await admin.internalNotification.createMany({ data: internal });
  }
  console.log("Seeded 100 workspaces, 10,000 items and 10,000 due reminders.");
  const scheduleStart = performance.now();
  await scheduleWorkspaceMail(worker);
  const scheduleMs = performance.now() - scheduleStart;
  const accepted = new Map();
  const latency = [];
  const limit = createSendLimiter(100);
  const start = performance.now();
  let readActive = true;
  const reads = (async () => {
    for (let index = 0; readActive || index < 100; index++) {
      const before = performance.now();
      const result = await listCycles(app, actor, ids[index % ids.length], cycleFilter.parse({ bucket: "waiting_on_client" }));
      assert.equal(result.items.length, 25);
      queryTimes.push(performance.now() - before);
      await wait(100);
    }
  })();
  let after;
  let batches = 0;
  do {
    const result = await dispatchMailBatch(worker, { credentials, origin: "http://127.0.0.1:3547", deduplicated: true,
      concurrency: 4, maxJobs: 200, after,
      sendInvitation: async () => { throw new Error("No invitations in this workload"); },
      sendTransactional: message => limit(async () => {
        await wait(10); // controlled healthy-provider acceptance latency, no external requests
        accepted.set(message.id, (accepted.get(message.id) ?? 0) + 1);
        latency.push(performance.now() - start);
        return { id: "synthetic_" + message.id, deduplicated: true };
      }), onError: (lane, error) => errors.push({ lane, name: error?.name ?? "unknown" }),
    });
    after = result.after;
    batches++;
    if (batches % 20 === 0) console.log("Accepted synthetic reminders:", accepted.size);
    assert.ok(performance.now() - start < 280_000, "Local drain exceeded the benchmark budget");
    if (!result.pending) break;
    await wait(100); // same backlog continuation delay as the worker
  // The bounded drain above exits on completion or throws at its time budget.
  // eslint-disable-next-line no-constant-condition
  } while (true);
  readActive = false;
  await reads;
  assert.deepEqual(errors, []);
  assert.equal(accepted.size, 10000);
  assert.ok([...accepted.values()].every(count => count === 1));
  assert.equal(await admin.decisionDelivery.count({ where: { status: "sent" } }), 5000);
  assert.equal(await admin.internalNotification.count({ where: { status: "sent" } }), 5000);
  const percentile = (values, percent) => values.toSorted((a, b) => a - b)[Math.ceil(values.length * percent) - 1];
  const p99 = percentile(latency, 0.99);
  const p95 = percentile(queryTimes, 0.95);
  const [server] = await admin.$queryRaw`SELECT current_setting('server_version') AS version`;
  const output = { checkedAt: new Date().toISOString(), environment: `isolated local PostgreSQL ${server.version}`,
    workspaces: 100, items: 10000, dueReminders: 10000, decisionReminders: 5000, internalReminders: 5000,
    provider: "In-process healthy fake, 10 ms acceptance latency", configuredSendsPerSecond: 100,
    workerConcurrency: 4, batches, duplicateAcceptances: 0, accepted: accepted.size,
    schedulerSweepMs: Math.round(scheduleMs),
    reminderP99Ms: Math.round(p99), reminderLastMs: Math.round(Math.max(...latency)),
    querySamples: queryTimes.length, domainQueueReadP95Ms: Math.round(p95),
    withinFiveMinutes: p99 + scheduleMs + 30000 < 300000,
    queueDomainUnder500Ms: p95 < 500,
    limitations: ["In-process provider fixture, no live delivery or quota acceptance", "Queue timings measure authorized domain queries, excluding HTTP/network overhead",
      "Local single-worker capacity only; cloud staging and aggregate provider-account quota remain release gates",
      "Five-minute calculation includes one scheduler sweep and a conservative 30-second idle poll allowance"] };
  await writeFile(process.env.DISPATCH_LOAD_OUTPUT ?? "docs/audit/dispatch-load-2026-11-18.json", JSON.stringify(output, null, 2) + "\n");
  console.log(JSON.stringify(output));
  assert.ok(output.withinFiveMinutes && output.queueDomainUnder500Ms);
} finally {
  await Promise.all([admin.$disconnect(), app.$disconnect(), worker.$disconnect()]);
}
