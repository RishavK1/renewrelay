import type { InviteCredentials } from "../../packages/domain/invite-credentials";
import type { PrismaClient } from "../../packages/db/generated/client";
import { setWorkspace, lockWorkspace } from "../../packages/db/database";
import { dispatchCancellation } from "../../packages/domain/billing/cancellation";
import { reconcile, retryBilling } from "../../packages/domain/billing/service";
import type { BillingProvider } from "../../packages/domain/billing/provider";
import { entitlement } from "../../packages/domain/billing/policy";

export async function processBilling(db: PrismaClient, provider: BillingProvider, now = new Date(), credentials?: InviteCredentials) {
  const events = await db.billingEvent.findMany({
    where: { environment: provider.environment, processedAt: null, runAt: { lte: now } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 25,
  });
  for (const event of events) {
    const mapping = await db.workspaceBilling.findUnique({ where: { providerId: event.providerId } });
    if (!mapping) {
      await db.billingEvent.updateMany({ where: { id: event.id, processedAt: null }, data: { runAt: new Date(now.getTime() + 300_000), errorCode: "mapping_pending", attempts: { increment: 1 },
      } });
      continue;
    }
    try {
      const result = await reconcile(db, mapping.workspaceId, provider, credentials, event.providerId);
      if (result.status === "applied") {
        await db.billingEvent.updateMany({ where: { id: event.id, processedAt: null }, data: { processedAt: now, errorCode: null } });
      } else {
        await db.billingEvent.updateMany({ where: { id: event.id, processedAt: null }, data: {
          attempts: { increment: 1 }, runAt: new Date(now.getTime() + 5000),
          errorCode: result.status === "conflict" ? "reconciliation_conflict" : "mapping_pending",
        } });
      }
    } catch {
      await db.billingEvent.updateMany({ where: { id: event.id, processedAt: null }, data: {
        attempts: { increment: 1 }, runAt: new Date(now.getTime() + 300_000), errorCode: "reconciliation_failed",
      } });
    }
  }
  const due = await db.workspaceBilling.findMany({
    where: { reconcileAfter: { lte: now }, checkoutIntent: { not: null }, purgedAt: null },
    orderBy: { reconcileAfter: "asc" }, take: 25,
  });
  for (const row of due) {
    try {
      // Discover an ambiguous checkout before attempting cancellation.
      const result = await reconcile(db, row.workspaceId, provider, credentials);
      if (result.status !== "applied") continue;
      const outcome = await dispatchCancellation(db, row.workspaceId, provider);
      if (outcome === "acknowledged") await reconcile(db, row.workspaceId, provider, credentials);
      // applySnapshot owns scheduling. Never replace a conflict or newer command's deadline here.
    } catch {
      await retryBilling(db, row.workspaceId, row.version, now);
    }
  }
}

export async function enforceBilling(db: PrismaClient, now = new Date(), after?: string) {
  const rows = await db.workspaceBilling.findMany({ where: { purgedAt: null, workspaceId: after ? { gt: after } : undefined },
    orderBy: { workspaceId: "asc" }, take: 101 });
  const workspaces = rows.slice(0, 100);
  for (const billing of workspaces) {
    await db.$transaction(async tx => {
      await setWorkspace(tx, billing.workspaceId);
      await lockWorkspace(tx, billing.workspaceId);
      const current = await tx.workspaceBilling.findUniqueOrThrow({ where: { workspaceId: billing.workspaceId } });
      const access = entitlement(current, now);
      if (!access.writable) {
        await tx.decisionLink.updateMany({ where: { workspaceId: billing.workspaceId, revokedAt: null }, data: { revokedAt: now } });
        await tx.decisionDelivery.updateMany({
          where: { workspaceId: billing.workspaceId, status: { in: ["pending", "leased"] } },
          data: { status: "canceled", ciphertext: null, messageCiphertext: null, leaseToken: null, leaseUntil: null },
        });
        await tx.mailJob.updateMany({
          where: { workspaceId: billing.workspaceId, status: { in: ["pending", "leased"] } },
          data: { status: "canceled", ciphertext: null, leaseToken: null, leaseUntil: null },
        });
        await tx.internalNotification.updateMany({
          where: { workspaceId: billing.workspaceId, kind: { not: "billing_warning" }, status: { in: ["pending", "leased"] } },
          data: { status: "canceled", leaseToken: null, leaseUntil: null },
        });
      }
      const owner = await tx.membership.findFirst({ where: { workspaceId: billing.workspaceId, role: "owner", removedAt: null } });
      const trialWarning = !current.paidThrough && current.trialEndsAt > now && current.trialEndsAt.getTime() - now.getTime() <= 3 * 86400_000;
      const graceRemaining = current.paidThrough ? current.paidThrough.getTime() + 7 * 86400_000 - now.getTime() : null;
      const graceWarning = current.paymentFailed && !current.cancelAtTerm &&
        graceRemaining !== null && graceRemaining > 0 && graceRemaining <= 86400_000;
      const warning = trialWarning ? "trial_ending" : graceWarning ? "grace_ending" : current.paymentFailed ? "payment_failed" : null;
      if (owner && warning && !current.deletionRequestedAt) {
        const dedupeKey = JSON.stringify([warning, billing.workspaceId, current.paidThrough?.toISOString() ?? current.trialEndsAt.toISOString()]);
        await tx.internalNotification.upsert({ where: { dedupeKey }, create: {
          workspaceId: billing.workspaceId, recipientId: owner.userId, recipient: owner.email,
          kind: "billing_warning", dedupeKey, runAt: now, expiresAt: new Date(now.getTime() + 86400_000),
        }, update: {} });
      }
    });
  }
  return { nextCursor: rows.length > 100 ? workspaces.at(-1)!.workspaceId : undefined };
}
