import assert from "node:assert/strict";
import { inspectWorker } from "../packages/operations/worker-health.ts";
export async function batch5Scenarios(t, { api, expect, adminDb, workerDb }) {
  await t.test("batch5 readiness rejects incomplete schema and recovers without exposing details", async () => {
    const healthy = await api("/api/v1/health");
    assert.ok(healthy.headers.get("x-request-id"));
    await expect(healthy, 200);
    await adminDb.$executeRaw`ALTER INDEX billing_events_operational_pending RENAME TO billing_events_operational_pending_test`;
    try {
      const response = await api("/api/v1/health");
      const result = await response.json();
      assert.equal(response.status, 503);
      assert.deepEqual(result, { error: { code: "unavailable" } });
    } finally {
      await adminDb.$executeRaw`ALTER INDEX billing_events_operational_pending_test RENAME TO billing_events_operational_pending`;
    }
    await expect(await api("/api/v1/health"), 200);
  });
  await t.test("batch5 operational queue metrics run under the restricted worker role", async () => {
    const metrics = await inspectWorker(workerDb);
    for (const value of Object.values(metrics)) assert.ok(Number.isFinite(value) && value >= 0);
    assert.ok("QueueAgeSeconds" in metrics);
    assert.ok("BillingEventAgeSeconds" in metrics);
  });
}
