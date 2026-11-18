import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { processBilling } from "../apps/worker/billing.ts";
import { purgeDeletedWorkspaces } from "../apps/worker/purge.ts";
import { reconcile, applySnapshot } from "../packages/domain/billing/service.ts";
import { dispatchCancellation } from "../packages/domain/billing/cancellation.ts";
import { RazorpayProvider } from "../packages/integrations/razorpay.ts";

export async function billingAuditScenarios(t, { api, expect, second, owner, adminDb, appDb, workerDb, providerFixture, origin }) {
  const provider = new RazorpayProvider({ keyId: process.env.RAZORPAY_KEY_ID, secret: process.env.RAZORPAY_KEY_SECRET,
    planId: "plan_synthetic", amountMinor: 149900, testApiUrl: process.env.RAZORPAY_TEST_API_URL });
  const row = workspace => adminDb.workspaceBilling.findUniqueOrThrow({ where: { workspaceId: workspace.id } });
  const path = (workspace, suffix) => `/api/v1/workspaces/${workspace.id}${suffix}`;
  const post = (workspace, suffix, body = {}, key = randomUUID(), cookie = second.cookie) =>
    api(path(workspace, suffix), { method: "POST", cookie, body, key });
  async function workspace(name) {
    const created = await expect(await api("/api/v1/workspaces", {
      method: "POST", cookie: second.cookie, body: { name, timezone: "Asia/Kolkata" },
    }), 201);
    await expect(await post(created, "/billing/checkout"), 200);
    const billing = await row(created);
    providerFixture.subscriptions.get(billing.providerId).status = "active";
    return { ...created, subscriptionId: billing.providerId };
  }
  async function remove(workspace) {
    return expect(await post(workspace, "/workspace-deletion", { confirmName: workspace.name, exportAcknowledged: true }), 200);
  }
  async function due(workspace) {
    await adminDb.workspaceBilling.update({ where: { workspaceId: workspace.id }, data: { reconcileAfter: new Date(0) } });
  }
  async function event(workspace, id = randomUUID()) {
    const body = JSON.stringify({ event: "subscription.charged", payload: { subscription: { entity: { id: workspace.subscriptionId } } } });
    const signature = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex");
    const response = await fetch(origin + "/api/v1/webhooks/billing", { method: "POST", body, headers: {
      "content-type": "application/json", "x-razorpay-event-id": id, "x-razorpay-signature": signature,
    } });
    assert.equal(response.status, 204);
    return "test:" + id;
  }
  async function conflictNextFetch(workspace) {
    providerFixture.beforeNextFetch(async id => {
      assert.equal(id, workspace.subscriptionId);
      await adminDb.workspaceBilling.update({ where: { workspaceId: workspace.id }, data: { version: { increment: 1 } } });
    });
  }

  await t.test("RR-05 HTTP at-term acknowledgement cannot clear a newer deletion cancellation", async () => {
    const space = await workspace("Cancellation generation race");
    await expect(await post(space, "/billing/cancel", {}, randomUUID(), owner.cookie), 404);
    let atTermOperation;
    providerFixture.beforeNextCancel(async (id, atTerm) => {
      assert.equal(id, space.subscriptionId);
      assert.equal(atTerm, true);
      atTermOperation = (await row(space)).cancellationId;
      await remove(space);
    });
    assert.equal((await expect(await post(space, "/billing/cancel"), 200)).state, "processing");
    const pending = await row(space);
    assert.ok(pending.cancelRequestedAt);
    assert.equal(pending.cancellationMode, "immediate");
    assert.notEqual(pending.cancellationId, atTermOperation);
    const deletionOperation = pending.cancellationId;
    // A replay must not create another at-term operation or replace the deletion generation.
    const calls = providerFixture.cancellations.length;
    assert.equal((await expect(await post(space, "/billing/cancel"), 200)).state, "processing");
    assert.equal(providerFixture.cancellations.length, calls);
    assert.equal((await row(space)).cancellationId, deletionOperation);
    await adminDb.workspaceBilling.update({ where: { workspaceId: space.id }, data: { purgeAfter: new Date(0) } });
    await purgeDeletedWorkspaces(workerDb);
    assert.equal((await row(space)).purgedAt, null);
    await processBilling(workerDb, provider);
    assert.equal(providerFixture.cancellations.at(-1).atTerm, false);
    assert.equal((await row(space)).cancelRequestedAt, null);
    assert.equal((await row(space)).providerStatus, "cancelled");
    await purgeDeletedWorkspaces(workerDb);
    assert.ok((await row(space)).purgedAt);
  });

  await t.test("RR-05 worker cancellation fences overlapping deletion and preserves recovery semantics", async () => {
    const space = await workspace("Worker cancellation race");
    providerFixture.rejectNextCancel();
    assert.equal((await expect(await post(space, "/billing/cancel"), 200)).state, "processing");
    const original = (await row(space)).cancellationId;
    assert.ok((await row(space)).cancelRequestedAt);
    await due(space);
    providerFixture.beforeNextCancel(async (_id, atTerm) => {
      assert.equal(atTerm, true);
      await remove(space);
    });
    await processBilling(workerDb, provider);
    const pending = await row(space);
    assert.notEqual(pending.cancellationId, original);
    assert.ok(pending.cancelRequestedAt);
    assert.equal(pending.cancellationMode, "immediate");
    await expect(await post(space, "/workspace-deletion/restore"), 200);
    const restored = await row(space);
    assert.equal(restored.deletionRequestedAt, null);
    assert.equal(restored.cancellationId, pending.cancellationId);
    assert.equal(restored.cancellationMode, "immediate");
    // Recovery restores data access. It cannot undo a dispatched provider cancellation.
    await due(space);
    await processBilling(workerDb, provider);
    assert.equal((await row(space)).cancelRequestedAt, null);
    assert.equal((await row(space)).providerStatus, "cancelled");
    const count = providerFixture.cancellations.length;
    assert.equal(await dispatchCancellation(workerDb, space.id, provider), "idle");
    assert.equal(providerFixture.cancellations.length, count);
  });

  await t.test("RR-05 lost provider response remains pending and terminal fetch resolves it without another cancel", async () => {
    const space = await workspace("Lost immediate cancellation response");
    await remove(space);
    providerFixture.loseNextCancelResponse();
    await processBilling(workerDb, provider);
    const pending = await row(space);
    assert.ok(pending.cancelRequestedAt);
    assert.equal(providerFixture.subscriptions.get(space.subscriptionId).status, "cancelled");
    assert.equal(pending.providerStatus, "active");
    const count = providerFixture.cancellations.filter(call => call.id === space.subscriptionId).length;
    await due(space);
    await processBilling(workerDb, provider);
    assert.equal((await row(space)).providerStatus, "cancelled");
    assert.equal((await row(space)).cancelRequestedAt, null);
    assert.equal(providerFixture.cancellations.filter(call => call.id === space.subscriptionId).length, count);
  });

  await t.test("RR-05 an immediate acknowledgement cannot clear a fresh deletion after recovery", async () => {
    const space = await workspace("Repeated immediate cancellation generation");
    await remove(space);
    const first = (await row(space)).cancellationId;
    providerFixture.beforeNextCancel(async (_id, atTerm) => {
      assert.equal(atTerm, false);
      await expect(await post(space, "/workspace-deletion/restore"), 200);
      await remove(space);
    });
    await processBilling(workerDb, provider);
    const newer = await row(space);
    assert.ok(newer.cancelRequestedAt);
    assert.notEqual(newer.cancellationId, first);
    assert.equal(newer.cancellationMode, "immediate");
    // The provider has cancelled, but the older response cannot acknowledge the new generation.
    const calls = providerFixture.cancellations.filter(call => call.id === space.subscriptionId).length;
    await due(space);
    await processBilling(workerDb, provider);
    assert.equal((await row(space)).cancelRequestedAt, null);
    assert.equal((await row(space)).cancellationId, newer.cancellationId);
    assert.equal(providerFixture.cancellations.filter(call => call.id === space.subscriptionId).length, calls);
  });

  await t.test("RR-06 periodic reconciliation retries stale snapshots promptly and later grants the paid period", async () => {
    const space = await workspace("Periodic reconciliation conflict");
    providerFixture.pay(space.subscriptionId, new Date(Date.now() - 1000), new Date(Date.now() + 30 * 86400_000));
    await adminDb.workspaceBilling.update({ where: { workspaceId: space.id }, data: { trialEndsAt: new Date(0) } });
    await due(space);
    await conflictNextFetch(space);
    await processBilling(workerDb, provider);
    const stale = await row(space);
    assert.equal(stale.paidThrough, null);
    assert.ok(stale.reconcileAfter.getTime() - Date.now() < 10_000);
    assert.equal(await adminDb.billingPayment.count({ where: { workspaceId: space.id } }), 0);
    await due(space);
    await processBilling(workerDb, provider);
    const applied = await row(space);
    assert.ok(applied.paidThrough > new Date());
    assert.ok(applied.reconcileAfter.getTime() - Date.now() > 23 * 3600_000);
    assert.equal((await expect(await api(path(space, "/billing"), { cookie: second.cookie }), 200)).mode, "paid");
  });

  await t.test("RR-06 duplicate signed events remain unprocessed on conflict and retry idempotently", async () => {
    const space = await workspace("Webhook reconciliation conflict");
    providerFixture.pay(space.subscriptionId, new Date(Date.now() - 1000), new Date(Date.now() + 30 * 86400_000));
    const id = randomUUID();
    const eventId = await event(space, id);
    await event(space, id);
    await conflictNextFetch(space);
    await processBilling(workerDb, provider);
    const pending = await adminDb.billingEvent.findUniqueOrThrow({ where: { id: eventId } });
    assert.equal(pending.processedAt, null);
    assert.equal(pending.errorCode, "reconciliation_conflict");
    assert.ok(pending.runAt.getTime() - Date.now() < 10_000);
    assert.equal((await row(space)).paidThrough, null);
    await adminDb.billingEvent.update({ where: { id: eventId }, data: { runAt: new Date(0) } });
    await processBilling(workerDb, provider);
    assert.ok((await adminDb.billingEvent.findUniqueOrThrow({ where: { id: eventId } })).processedAt);
    const unmappedId = await event({ ...space, subscriptionId: "sub_" + randomUUID().replaceAll("-", "") });
    await adminDb.billingEvent.update({ where: { id: unmappedId }, data: { createdAt: new Date(Date.now() - 2 * 86400_000) } });
    await processBilling(workerDb, provider);
    const unmapped = await adminDb.billingEvent.findUniqueOrThrow({ where: { id: unmappedId } });
    assert.equal(unmapped.processedAt, null);
    assert.equal(unmapped.errorCode, "mapping_pending");
    assert.equal(await adminDb.billingPayment.count({ where: { workspaceId: space.id } }), 1);
    await event(space, id);
    await processBilling(workerDb, provider);
    assert.equal(await adminDb.billingPayment.count({ where: { workspaceId: space.id } }), 1);
  });

  await t.test("RR-06 provider failures leave signed events pending with bounded retry", async () => {
    const space = await workspace("Webhook provider failure");
    const eventId = await event(space);
    const unavailable = { environment: "test", async fetch() { throw new Error("Synthetic provider timeout"); } };
    await processBilling(workerDb, unavailable);
    const pending = await adminDb.billingEvent.findUniqueOrThrow({ where: { id: eventId } });
    assert.equal(pending.processedAt, null);
    assert.equal(pending.errorCode, "reconciliation_failed");
    assert.equal(pending.attempts, 1);
    assert.ok(pending.runAt.getTime() - Date.now() > 290_000);
    await adminDb.billingEvent.update({ where: { id: eventId }, data: { runAt: new Date(0) } });
    await processBilling(workerDb, provider);
    assert.ok((await adminDb.billingEvent.findUniqueOrThrow({ where: { id: eventId } })).processedAt);
  });

  await t.test("RR-06 stale mapping, provider outage and deletion cannot acknowledge unrelated snapshots", async () => {
    const space = await workspace("Reconciliation mapping race");
    const prior = await row(space);
    const snapshot = await provider.fetch(space.subscriptionId);
    providerFixture.beforeNextFetch(async () => {
      await adminDb.workspaceBilling.update({ where: { workspaceId: space.id }, data: {
        checkoutIntent: randomUUID(), providerId: null, checkoutState: "creating", reconcileAfter: new Date(0), version: { increment: 1 },
      } });
    });
    assert.equal((await reconcile(appDb, space.id, provider)).status, "conflict");
    assert.equal((await row(space)).providerId, null);
    assert.equal((await applySnapshot(appDb, snapshot, space.id, prior.checkoutIntent, prior.version)).status, "conflict");
    await assert.rejects(() => applySnapshot(appDb, { ...snapshot, workspaceId: randomUUID() }, space.id, prior.checkoutIntent));
    // An exception from an old fetch must not postpone a new deletion request.
    const deleting = await workspace("Reconciliation outage during deletion");
    const failing = { ...provider, environment: "test", async fetch() { await remove(deleting); throw new Error("Synthetic timeout"); } };
    await assert.rejects(() => reconcile(appDb, deleting.id, failing));
    const pending = await row(deleting);
    assert.ok(pending.deletionRequestedAt);
    assert.ok(pending.cancelRequestedAt);
    assert.ok(pending.reconcileAfter.getTime() <= Date.now());
    await processBilling(workerDb, provider);
    assert.equal((await row(deleting)).providerStatus, "cancelled");
    // No snapshot means unavailable, never applied and never a paid entitlement.
    const missing = { ...provider, environment: "test", async find() { return null; } };
    assert.equal((await reconcile(appDb, space.id, missing)).status, "unavailable");
    assert.equal((await row(space)).paidThrough, null);
  });
}
