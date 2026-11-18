import { openDatabase } from "../packages/db/database.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { dispatchMailBatch } from "../apps/worker/dispatch.ts";
import { scheduleWorkspaceMail } from "../apps/worker/internal-mail.ts";
import { InviteCredentials } from "../packages/domain/invite-credentials.ts";
import { addDays, localToday } from "../packages/domain/renewal-dates.ts";

export async function dispatchScenarios(t, { api, expect, second, adminDb, workerDb }) {
  const credentials = new InviteCredentials(Buffer.from(process.env.INVITE_ENCRYPTION_KEY, "base64url"));
  const post = (workspace, path, body) => api(`/api/v1/workspaces/${workspace.id}${path}`, { method: "POST", cookie: second.cookie, body });
  const today = localToday("Asia/Kolkata");
  async function space(name, timezone = "Asia/Kolkata") {
    return expect(await api("/api/v1/workspaces", { method: "POST", cookie: second.cookie, body: { name, timezone } }), 201);
  }
  async function customer(workspace) {
    const client = await expect(await post(workspace, "/clients", { name: "Dispatch customer" }), 201);
    const contact = await expect(await post(workspace, `/clients/${client.id}/contacts`, { name: "Recipient", email: randomUUID() + "@example.test" }), 201);
    return { client, contact };
  }
  const input = (clientId, label) => ({ clientId, operatorId: second.id, service: label, provider: "Synthetic provider",
    expiryOn: addDays(today, 60), respondBy: addDays(today, 15), payer: "client", currency: "INR",
    clientQuoteMinor: 1234, term: "Annual", recurrence: "once" });

  await t.test("RR-04 bounded concurrent dispatch drains multiple lanes and tenants without duplicate claims", async () => {
    const workspaces = [await space("Large mail tenant"), await space("Small mail tenant")].sort((a, b) => a.id.localeCompare(b.id));
    const requestIds = [];
    for (const [index, workspace] of workspaces.entries()) {
      await adminDb.workspaceBilling.update({ where: { workspaceId: workspace.id }, data: { paidThrough: new Date(Date.now() + 86400_000) } });
      const { client, contact } = await customer(workspace);
      for (let item = 0; item < (index === 0 ? 13 : 1); item++) {
        const created = await expect(await post(workspace, "/items", input(client.id, "Batch decision " + item)), 201);
        const issued = await expect(await post(workspace, `/cycles/${created.cycle.id}/requests`, { contactId: contact.id, expectedVersion: 1 }), 201);
        requestIds.push(issued.requestId);
      }
      await adminDb.internalNotification.create({ data: { workspaceId: workspace.id, recipientId: second.id,
        recipient: second.email, kind: "billing_warning", dedupeKey: randomUUID(), runAt: new Date(), expiresAt: new Date(Date.now() + 86400_000) } });
    }
    const invitation = await expect(await post(workspaces[0], "/invites", { email: randomUUID() + "@example.test", role: "member" }), 201);
    const accepted = new Map();
    const order = [];
    const errors = [];
    const options = { credentials, origin: "http://127.0.0.1:3547", deduplicated: true, maxJobs: 200,
      sendInvitation: async message => { accepted.set(message.messageId, (accepted.get(message.messageId) ?? 0) + 1); },
      sendTransactional: async message => {
        accepted.set(message.id, (accepted.get(message.id) ?? 0) + 1); order.push(message.id);
        await new Promise(resolve => setTimeout(resolve, 2));
        return { id: "fake_" + message.id, deduplicated: true };
      }, onError: (lane, error) => errors.push({ lane, error }) };
    await assert.rejects(() => dispatchMailBatch(workerDb, { ...options, maxJobs: 2 }), RangeError);
    const limited = await dispatchMailBatch(workerDb, { ...options, maxJobs: 3, concurrency: 1 });
    assert.ok(limited.processed <= 3);
    assert.equal(limited.pending, true);
    const parallelDb = openDatabase(process.env.WORKER_DATABASE_URL, 8);
    let concurrent;
    try {
      concurrent = await Promise.all([dispatchMailBatch(parallelDb, options), dispatchMailBatch(parallelDb, options)]);
    } finally {
      await parallelDb.$disconnect();
    }
    const results = [limited, ...concurrent];
    assert.deepEqual(errors, []);
    assert.ok(results.reduce((sum, result) => sum + result.processed, 0) >= 17);
    const deliveries = await adminDb.decisionDelivery.findMany({ where: { requestId: { in: requestIds }, kind: "invitation" } });
    assert.equal(deliveries.length, 14);
    assert.ok(deliveries.every(job => job.status === "sent" && accepted.get(job.id) === 1));
    const small = deliveries.find(job => job.workspaceId === workspaces[1].id);
    const ownOrder = order.filter(id => deliveries.some(job => job.id === id));
    assert.ok(ownOrder.indexOf(small.id) < 4, "Small tenant should run before the large tenant's backlog drains");
    assert.ok([...accepted.values()].every(count => count === 1));
    assert.equal((await adminDb.mailJob.findFirstOrThrow({ where: { inviteId: invitation.id } })).status, "sent");
    assert.equal(await adminDb.decisionDelivery.count({ where: { requestId: { in: requestIds }, kind: "reminder", status: "pending" } }), 28);
    const before = accepted.size;
    await dispatchMailBatch(workerDb, { ...options, signal: AbortSignal.abort() });
    assert.equal(accepted.size, before);
    // Bulk schedule replay creates no duplicate logical notifications.
    await scheduleWorkspaceMail(workerDb);
    const count = await adminDb.internalNotification.count({ where: { workspaceId: { in: workspaces.map(workspace => workspace.id) } } });
    await scheduleWorkspaceMail(workerDb);
    assert.equal(await adminDb.internalNotification.count({ where: { workspaceId: { in: workspaces.map(workspace => workspace.id) } } }), count);
  });

  await t.test("RR-07 HTTP issuance accepts a Havana response date before skipped midnight", async () => {
    const workspace = await space("Havana boundary", "America/Havana");
    const { client, contact } = await customer(workspace);
    const created = await expect(await post(workspace, "/items", {
      ...input(client.id, "Havana decision"), expiryOn: "2027-04-30", respondBy: "2027-03-13",
    }), 201);
    const issued = await expect(await post(workspace, `/cycles/${created.cycle.id}/requests`, { contactId: contact.id, expectedVersion: 1 }), 201);
    const request = await adminDb.decisionRequest.findUniqueOrThrow({ where: { id: issued.requestId } });
    assert.equal(request.deadlineAt.toISOString(), "2027-03-14T05:00:00.000Z");
    const job = await adminDb.decisionDelivery.findFirstOrThrow({ where: { requestId: request.id, kind: "invitation" } });
    const token = credentials.decrypt(job.ciphertext, request.id);
    await expect(await api("/api/v1/decisions/preview", { method: "POST", body: { token } }), 200);
    await adminDb.decisionRequest.update({ where: { id: request.id }, data: { deadlineAt: new Date(0) } });
    await expect(await api("/api/v1/decisions/preview", { method: "POST", body: { token } }), 410);
  });
}
