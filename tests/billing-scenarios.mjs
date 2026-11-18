import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { processBilling, enforceBilling } from "../apps/worker/billing.ts";
import { purgeDeletedWorkspaces } from "../apps/worker/purge.ts";
import { RazorpayProvider } from "../packages/integrations/razorpay.ts";

export async function billingScenarios(t, { api, expect, second, adminDb, workerDb, providerFixture, origin }) {
  const provider = new RazorpayProvider({
    keyId: process.env.RAZORPAY_KEY_ID, secret: process.env.RAZORPAY_KEY_SECRET,
    planId: "plan_synthetic", amountMinor: 149900, testApiUrl: process.env.RAZORPAY_TEST_API_URL,
  });
  const workspace = await expect(await api("/api/v1/workspaces", {
    method: "POST", cookie: second.cookie, body: { name: "Billing test", timezone: "Asia/Kolkata" },
  }), 201);
  const root = "/api/v1/workspaces/" + workspace.id;
  const get = path => api(root + path, { cookie: second.cookie });
  const post = (path, body = {}, key) => api(root + path, { method: "POST", cookie: second.cookie, body, key });
  const billing = () => adminDb.workspaceBilling.findUniqueOrThrow({ where: { workspaceId: workspace.id } });

  async function event(id, type, subscriptionId) {
    const body = JSON.stringify({ event: type, payload: { subscription: { entity: { id: subscriptionId } } } });
    const signature = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex");
    return fetch(origin + "/api/v1/webhooks/billing", { method: "POST", body, headers: {
      "content-type": "application/json", "x-razorpay-event-id": id, "x-razorpay-signature": signature,
    } });
  }

  await t.test("expired trials permit reads, export and billing while operational writes stop", async () => {
    assert.equal((await expect(await get("/billing"), 200)).mode, "trial");
    await adminDb.workspaceBilling.update({ where: { workspaceId: workspace.id }, data: { trialEndsAt: new Date(0) } });
    await expect(await post("/clients", { name: "Blocked" }), 403, "workspace_read_only");
    await expect(await get("/clients"), 200);
    assert.equal((await get("/exports/renewals.csv")).status, 200);
    assert.equal((await expect(await get("/billing"), 200)).mode, "read_only");
  });

  let subscriptionId;
  await t.test("lost checkout responses reconcile to one remote subscription and redirect fields grant no access", async () => {
    const before = providerFixture.created;
    providerFixture.loseNextCreateResponse();
    const key = randomUUID();
    const result = await expect(await post("/billing/checkout", {}, key), 200);
    assert.equal(result.state, "processing");
    await expect(await post("/billing/checkout", {}, key), 200);
    assert.equal(providerFixture.created, before + 1);
    await adminDb.workspaceBilling.update({ where: { workspaceId: workspace.id }, data: { reconcileAfter: new Date(0) } });
    await processBilling(workerDb, provider);
    const mapped = await billing();
    subscriptionId = mapped.providerId;
    assert.ok(subscriptionId);
    assert.equal((await expect(await get("/billing"), 200)).mode, "read_only");
    await expect(await post("/billing/checkout", { paid: true }), 400);
    await expect(await get("/billing?success=true&paid=true"), 200);
    assert.equal((await expect(await get("/billing"), 200)).mode, "read_only");
  });

  await t.test("verified captured payments activate access and out-of-order events preserve the paid term", async () => {
    const invoice = providerFixture.pay(subscriptionId, new Date(Date.now() - 86400_000), new Date(Date.now() + 30 * 86400_000));
    const payment = providerFixture.payments.get(invoice.payment_id);
    payment.status = "authorized";
    await event(randomUUID(), "subscription.charged", subscriptionId);
    await processBilling(workerDb, provider);
    assert.equal((await expect(await get("/billing"), 200)).mode, "read_only");
    payment.status = "captured";
    const invalid = await fetch(origin + "/api/v1/webhooks/billing", { method: "POST", body: "{}",
      headers: { "x-razorpay-event-id": randomUUID(), "x-razorpay-signature": "0".repeat(64) } });
    assert.equal(invalid.status, 400);
    const id = randomUUID();
    assert.equal((await event(id, "subscription.charged", subscriptionId)).status, 204);
    assert.equal((await event(id, "subscription.charged", subscriptionId)).status, 204);
    assert.equal(await adminDb.billingEvent.count({ where: { id: "test:" + id } }), 1);
    await processBilling(workerDb, provider);
    const paid = await expect(await get("/billing"), 200);
    assert.equal(paid.mode, "paid");
    assert.deepEqual(paid.limits, { items: 100, seats: 5 });
    assert.equal(await adminDb.billingPayment.count({ where: { workspaceId: workspace.id } }), 1);
    await expect(await post("/billing/catch-up"), 200);
    await expect(await post("/billing/catch-up"), 200);
    assert.equal(await adminDb.internalNotification.count({ where: { workspaceId: workspace.id, kind: "catchup" } }), 1);
    const seatInvites = await Promise.all(Array.from({ length: 5 }, () => post("/invites", {
      email: `paid-seat-${randomUUID()}@example.test`, role: "member",
    })));
    assert.equal(seatInvites.filter(response => response.status === 201).length, 4);
    assert.equal(seatInvites.filter(response => response.status === 409).length, 1);

    const client = await expect(await post("/clients", { name: "Paid client" }), 201);
    const { setWorkspace } = await import("../packages/db/database.ts");
    await assert.rejects(() => workerDb.$transaction(async tx => {
      await setWorkspace(tx, workspace.id);
      await tx.client.deleteMany({ where: { workspaceId: workspace.id } });
    }));
    const contact = await expect(await post("/clients/" + client.id + "/contacts", {
      name: "Subscription client", email: `subscription-${randomUUID()}@example.test`,
    }), 201);
    const inDays = days => new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);
    const item = await expect(await post("/items", {
      clientId: client.id, operatorId: second.id, service: "Entitlement flow", provider: "Example",
      expiryOn: inDays(60), respondBy: inDays(15), payer: "client", currency: "INR",
      clientQuoteMinor: 1000, term: "Annual", recurrence: "once",
    }), 201);
    await expect(await post("/cycles/" + item.cycle.id + "/requests", { contactId: contact.id, expectedVersion: 1 }), 201);
    const current = await adminDb.decisionRequest.findFirstOrThrow({ where: { cycleId: item.cycle.id } });
    const job = await adminDb.decisionDelivery.findFirstOrThrow({ where: { requestId: current.id, kind: "invitation" } });
    const { InviteCredentials } = await import("../packages/domain/invite-credentials.ts");
    const credentials = new InviteCredentials(Buffer.from(process.env.INVITE_ENCRYPTION_KEY, "base64url"));
    const token = credentials.decrypt(job.ciphertext, current.id);
    await adminDb.workspaceBilling.update({ where: { workspaceId: workspace.id }, data: {
      paidThrough: new Date(Date.now() - 10 * 86400_000), paymentFailed: false,
    } });
    await expect(await api("/api/v1/decisions/preview", { method: "POST", body: { token } }), 403, "workspace_read_only");
    await enforceBilling(workerDb);
    await event(randomUUID(), "subscription.charged", subscriptionId);
    await processBilling(workerDb, provider, new Date(), credentials);
    assert.equal((await expect(await get("/billing"), 200)).mode, "paid");
    const future = await adminDb.decisionDelivery.findMany({
      where: { requestId: current.id, kind: "reminder", status: "pending", runAt: { gt: new Date() } },
    });
    assert.equal(future.length, 2);
    await expect(await api("/api/v1/decisions/preview", { method: "POST", body: { token } }), 410);

    await event(randomUUID(), "subscription.pending", subscriptionId);
    await processBilling(workerDb, provider);
    assert.equal((await expect(await get("/billing"), 200)).paidThrough, paid.paidThrough);
  });

  await t.test("failure grace, suspension, cancellation and deletion enforce the same policy", async () => {
    await adminDb.workspaceBilling.update({ where: { workspaceId: workspace.id }, data: {
      paidThrough: new Date(Date.now() - 86400_000), paymentFailed: true,
    } });
    assert.equal((await expect(await get("/billing"), 200)).mode, "grace");
    await expect(await post("/clients", { name: "Grace client" }), 201);
    await adminDb.workspaceBilling.update({ where: { workspaceId: workspace.id }, data: { paidThrough: new Date(Date.now() - 8 * 86400_000) } });
    await enforceBilling(workerDb);
    await expect(await post("/clients", { name: "Suspended client" }), 403);
    assert.equal((await get("/exports/renewals.csv")).status, 200);
    await expect(await post("/billing/cancel"), 200);
    assert.equal(providerFixture.subscriptions.get(subscriptionId).cancel_at_cycle_end, true);
    await expect(await post("/workspace-deletion", { confirmName: "Wrong", exportAcknowledged: true }), 409);
    await expect(await post("/workspace-deletion", { confirmName: "Billing test", exportAcknowledged: true }), 200);
    await expect(await get("/clients"), 410);
    await expect(await post("/workspace-deletion/restore"), 200);
    await expect(await get("/clients"), 200);
    await expect(await post("/workspace-deletion", { confirmName: "Billing test", exportAcknowledged: true }), 200);
    await processBilling(workerDb, provider);
    assert.equal(providerFixture.subscriptions.get(subscriptionId).status, "cancelled");
    await adminDb.workspaceBilling.update({ where: { workspaceId: workspace.id }, data: { purgeAfter: new Date(0) } });
    await purgeDeletedWorkspaces(workerDb);
    assert.ok((await billing()).purgedAt);
    assert.equal(await adminDb.client.count({ where: { workspaceId: workspace.id } }), 0);
    assert.equal(await adminDb.billingPayment.count({ where: { workspaceId: workspace.id } }), 1);
    await expect(await get("/billing"), 404);
  });
}
