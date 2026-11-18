import assert from "node:assert/strict";
import test from "node:test";
import type { WorkspaceBilling } from "../packages/db/generated/client";
import { entitlement } from "../packages/domain/billing/policy";

const now = new Date("2026-11-18T12:00:00Z");
function billing(values: Partial<WorkspaceBilling> = {}): WorkspaceBilling {
  return {
    workspaceId: "test", trialEndsAt: new Date("2026-11-20T12:00:00Z"), paidThrough: null,
    paymentFailed: false, cancelAtTerm: false, providerId: null, providerStatus: null,
    checkoutIntent: null, checkoutKey: null, checkoutState: "none", checkoutUrl: null,
    cancelRequestedAt: null, cancellationId: null, cancellationMode: null, lastCheckedAt: null, reconcileAfter: now, deletionRequestedAt: null,
    purgeAfter: null, purgedAt: null, recoveryOwnerId: null, version: 1, ...values,
  };
}

test("trial expiry and paid limits use exclusive UTC boundaries", () => {
  assert.equal(entitlement(billing(), now).mode, "trial");
  assert.equal(entitlement(billing({ trialEndsAt: now }), now).writable, false);
  const paid = entitlement(billing({ paidThrough: new Date("2026-12-01T00:00:00Z") }), now);
  assert.deepEqual(paid.limits, { items: 100, seats: 5 });
  assert.equal(paid.mode, "paid");
});

test("grace applies to failed payments while cancellation and deletion stop it", () => {
  const expired = { paidThrough: new Date("2026-11-17T12:00:00Z"), paymentFailed: true };
  assert.equal(entitlement(billing(expired), now).mode, "grace");
  assert.equal(entitlement(billing({ ...expired, cancelAtTerm: true }), now).mode, "read_only");
  assert.equal(entitlement(billing({ ...expired, paidThrough: new Date("2026-11-11T12:00:00Z") }), now).mode, "read_only");
  assert.equal(entitlement(billing({ ...expired, deletionRequestedAt: now }), now).mode, "deleting");
});
