import type { WorkspaceBilling } from "../../db/generated/client";
import type { Transaction } from "../../db/database";
import { DomainError } from "../errors";

export const trialLimits = { items: 10, seats: 3 } as const;
export const paidLimits = { items: 100, seats: 5 } as const;
const day = 86400_000;

export function entitlement(billing: WorkspaceBilling, now = new Date()) {
  const deleted = !!billing.deletionRequestedAt || !!billing.purgedAt;
  const paid = !!billing.paidThrough && billing.paidThrough > now;
  const graceEnd = billing.paidThrough && billing.paymentFailed && !billing.cancelAtTerm
    ? new Date(billing.paidThrough.getTime() + 7 * day) : null;
  const grace = !!graceEnd && graceEnd > now;
  const trial = !billing.paidThrough && billing.trialEndsAt > now;
  const writable = !deleted && (paid || grace || trial);
  const mode = deleted ? "deleting" : paid ? "paid" : grace ? "grace" : trial ? "trial" : "read_only";
  return {
    mode, writable, limits: paid || grace ? paidLimits : trialLimits,
    trialEndsAt: billing.trialEndsAt.toISOString(), paidThrough: billing.paidThrough?.toISOString() ?? null,
    graceEndsAt: graceEnd?.toISOString() ?? null,
    cancellationScheduled: billing.cancelAtTerm, deletionRequestedAt: billing.deletionRequestedAt?.toISOString() ?? null,
    purgeAfter: billing.purgeAfter?.toISOString() ?? null,
  };
}

export async function workspaceEntitlement(tx: Transaction, workspaceId: string, now = new Date()) {
  const billing = await tx.workspaceBilling.findUnique({ where: { workspaceId } });
  if (!billing) throw new DomainError(503, "billing_unavailable", "Workspace access could not be verified.");
  return entitlement(billing, now);
}

export async function requireOperational(tx: Transaction, workspaceId: string) {
  const access = await workspaceEntitlement(tx, workspaceId);
  if (!access.writable) throw new DomainError(403, "workspace_read_only", "This workspace currently permits reading and exporting.");
  return access;
}
