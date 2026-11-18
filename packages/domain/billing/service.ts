import { dispatchCancellation, terminalStates } from "./cancellation";
import { scheduleClientReminders } from "../notifications/schedules";
import type { InviteCredentials } from "../invite-credentials";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../db/generated/client";
import { lockWorkspace, setActor, setWorkspace } from "../../db/database";
import { audit, type Actor, type Command, owners, requireRecentAuth, withWorkspace } from "../context";
import { DomainError, conflict } from "../errors";
import { entitlement } from "./policy";
import type { BillingProvider, SubscriptionSnapshot } from "./provider";

export type ReconciliationResult =
  | { status: "applied"; version: number; deleting: boolean }
  | { status: "conflict" }
  | { status: "unavailable" };

// A failed older call must not postpone work created by a newer transaction.
export async function retryBilling(db: PrismaClient, workspaceId: string, version: number, now = new Date()) {
  await db.$transaction(async tx => {
    await setWorkspace(tx, workspaceId);
    await tx.workspaceBilling.updateMany({ where: { workspaceId, version },
      data: { reconcileAfter: new Date(now.getTime() + 300_000) } });
  });
}

export function billingStatus(db: PrismaClient, actor: Actor, workspaceId: string) {
  return withWorkspace(db, actor, workspaceId, owners, false, async ({ tx }) => {
    const row = await tx.workspaceBilling.findUniqueOrThrow({ where: { workspaceId } });
    const items = await tx.renewalItem.count({ where: { workspaceId, archivedAt: null } });
    const staff = await tx.membership.count({ where: { workspaceId, removedAt: null } });
    const invites = await tx.invitation.count({ where: { workspaceId, revokedAt: null, acceptedAt: null, expiresAt: { gt: new Date() } } });
    return { ...entitlement(row), providerStatus: row.providerStatus, checkoutState: row.checkoutState,
      checkoutUrl: row.checkoutUrl, usage: { items, seats: staff + invites }, version: row.version };
  }, "billing");
}

export async function checkout(db: PrismaClient, cmd: Command, workspaceId: string, provider: BillingProvider, credentials?: InviteCredentials) {
  const intent = await withWorkspace(db, cmd.actor, workspaceId, owners, true, async ({ tx }) => {
    requireRecentAuth(cmd.actor);
    const row = await tx.workspaceBilling.findUniqueOrThrow({ where: { workspaceId } });
    if (row.deletionRequestedAt) conflict("workspace_deleting", "Restore the workspace before subscribing.");
    if (row.checkoutIntent && (row.checkoutKey === cmd.key || !terminalStates.has(row.providerStatus ?? ""))) {
      return { id: row.checkoutIntent, create: false, state: row.checkoutState, url: row.checkoutUrl };
    }
    if (row.paidThrough && row.paidThrough > new Date()) conflict("paid_period_active", "The current paid period is still active.");
    const id = randomUUID();
    await tx.workspaceBilling.update({ where: { workspaceId }, data: {
      checkoutIntent: id, checkoutKey: cmd.key, checkoutState: "creating", checkoutUrl: null,
      providerId: null, providerStatus: null, cancelAtTerm: false, cancelRequestedAt: null,
      cancellationId: null, cancellationMode: null,
      reconcileAfter: new Date(Date.now() + 60_000), version: { increment: 1 },
    } });
    await audit(tx, cmd, workspaceId, "billing.checkout_requested", workspaceId, { intentId: id });
    return { id, create: true, state: "creating", url: null };
  }, "billing");
  if (!intent.create) return { state: intent.state, checkoutUrl: intent.url };

  try {
    const snapshot = await provider.create(intent.id, workspaceId);
    const result = await applySnapshot(db, snapshot, workspaceId, intent.id, undefined, credentials);
    return result.status === "applied" && !result.deleting
      ? { state: "ready", checkoutUrl: snapshot.checkoutUrl }
      : { state: "processing", checkoutUrl: null };
  } catch {
    await db.$transaction(async tx => {
      await setWorkspace(tx, workspaceId);
      await lockWorkspace(tx, workspaceId);
      await tx.workspaceBilling.updateMany({
        where: { workspaceId, checkoutIntent: intent.id, checkoutState: "creating" },
        data: { checkoutState: "uncertain", reconcileAfter: new Date(Date.now() + 60_000) },
      });
    });
    // Creation may have succeeded remotely. Reconciliation must discover it before another create.
    return { state: "processing", checkoutUrl: null };
  }
}

export async function applySnapshot(db: PrismaClient, snapshot: SubscriptionSnapshot, workspaceId: string, intentId: string, expectedVersion?: number, credentials?: InviteCredentials): Promise<ReconciliationResult> {
  if (snapshot.workspaceId !== workspaceId || snapshot.intentId !== intentId) {
    throw new DomainError(409, "billing_mapping_mismatch", "The provider resource does not match this workspace.");
  }
  return db.$transaction(async tx => {
    await setWorkspace(tx, workspaceId);
    await lockWorkspace(tx, workspaceId);
    const row = await tx.workspaceBilling.findUniqueOrThrow({ where: { workspaceId } });
    if (row.checkoutIntent !== intentId || (row.providerId && row.providerId !== snapshot.id)) {
      return { status: "conflict" };
    }
    if (expectedVersion !== undefined && row.version !== expectedVersion) {
      await tx.workspaceBilling.update({ where: { workspaceId }, data: { reconcileAfter: new Date(Date.now() + 5000) } });
      return { status: "conflict" };
    }
    let paidThrough = row.paidThrough;
    for (const period of snapshot.periods) {
      if (period.currency !== "INR" || period.amountMinor <= 0 || period.end <= period.start) {
        throw new Error("Invalid verified paid period.");
      }
      await tx.billingPayment.createMany({ data: [{
        id: period.paymentId, workspaceId, providerId: snapshot.id, invoiceId: period.invoiceId,
        amountMinor: period.amountMinor, currency: period.currency, periodStart: period.start, periodEnd: period.end,
      }], skipDuplicates: true });
      if (period.start <= new Date() && (!paidThrough || period.end > paidThrough)) paidThrough = period.end;
    }
    const failed = ["pending", "halted", "paused"].includes(snapshot.status);
    const wasWritable = entitlement(row).writable;
    const updated = await tx.workspaceBilling.update({ where: { workspaceId }, data: {
      providerId: snapshot.id, providerStatus: snapshot.status, checkoutState: terminalStates.has(snapshot.status) ? "terminal" : "ready",
      checkoutUrl: snapshot.checkoutUrl, paidThrough,
      paymentFailed: failed, cancelAtTerm: row.cancelAtTerm || terminalStates.has(snapshot.status),
      lastCheckedAt: new Date(), reconcileAfter: new Date(Date.now() + (row.cancelRequestedAt ? 5000 : 86400_000)), version: { increment: 1 },
    } });
    await setActor(tx, "billing-provider");
    await tx.auditEvent.create({ data: {
      workspaceId, actorId: "billing-provider", entityId: workspaceId, event: "billing.reconciled",
      requestId: randomUUID(), details: { providerId: snapshot.id, status: snapshot.status, paidThrough: paidThrough?.toISOString() ?? null },
    } });
    if (!wasWritable && entitlement(updated).writable) {
      await tx.decisionLink.updateMany({ where: { workspaceId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.decisionDelivery.updateMany({
        where: { workspaceId, status: { in: ["pending", "leased"] } },
        data: { status: "canceled", ciphertext: null, messageCiphertext: null, leaseToken: null, leaseUntil: null },
      });
      await tx.internalNotification.updateMany({ where: { workspaceId, status: "pending", runAt: { lt: new Date() } },
        data: { status: "canceled" } });
      await tx.internalNotification.updateMany({ where: {
        workspaceId, status: "canceled", attempts: 0, runAt: { gt: new Date() },
      }, data: { status: "pending" } });
      if (credentials) {
        const requests = await tx.decisionRequest.findMany({ where: {
          workspaceId, supersededAt: null, decidedAt: null, deadlineAt: { gt: new Date() },
          cycle: { closedAt: null, state: "open", item: { archivedAt: null } },
          contact: { archivedAt: null },
        }, include: { cycle: { select: { timezone: true } }, contact: { select: { email: true } } } });
        for (const request of requests) {
          if (request.recipientEmail === request.contact.email) {
            await scheduleClientReminders(tx, request, request.cycle.timezone, credentials);
          }
        }
      }
    }
    return { status: "applied", version: updated.version, deleting: !!updated.deletionRequestedAt };
  });
}

export async function reconcile(db: PrismaClient, workspaceId: string, provider: BillingProvider,
  credentials?: InviteCredentials, expectedProviderId?: string): Promise<ReconciliationResult> {
  const row = await db.$transaction(async tx => {
    await setWorkspace(tx, workspaceId);
    return tx.workspaceBilling.findUniqueOrThrow({ where: { workspaceId } });
  });
  if (!row.checkoutIntent || row.purgedAt || (expectedProviderId && row.providerId !== expectedProviderId)) {
    return { status: "unavailable" };
  }
  try {
    const snapshot = row.providerId ? await provider.fetch(row.providerId) : await provider.find(row.checkoutIntent);
    if (!snapshot) {
      await retryBilling(db, workspaceId, row.version);
      return { status: "unavailable" };
    }
    return await applySnapshot(db, snapshot, workspaceId, row.checkoutIntent, row.version, credentials);
  } catch (error) {
    await retryBilling(db, workspaceId, row.version);
    throw error;
  }
}

export async function cancelSubscription(db: PrismaClient, cmd: Command, workspaceId: string, provider: BillingProvider, credentials?: InviteCredentials) {
  const row = await withWorkspace(db, cmd.actor, workspaceId, owners, true, async ({ tx }) => {
    requireRecentAuth(cmd.actor);
    const billing = await tx.workspaceBilling.findUniqueOrThrow({ where: { workspaceId } });
    if (!billing.providerId) conflict("subscription_unavailable", "Reconcile the checkout before cancelling.");
    if (billing.cancelAtTerm) return { shouldSend: false, state: billing.cancelRequestedAt ? "processing" : "scheduled" };
    await tx.workspaceBilling.update({ where: { workspaceId }, data: {
      cancelAtTerm: true, cancelRequestedAt: new Date(), cancellationId: randomUUID(), cancellationMode: "at_term",
      reconcileAfter: new Date(), version: { increment: 1 },
    } });
    await audit(tx, cmd, workspaceId, "billing.cancellation_requested", workspaceId);
    return { shouldSend: true, state: "processing" };
  }, "billing");
  if (!row.shouldSend) return { state: row.state };
  try {
    const outcome = await dispatchCancellation(db, workspaceId, provider);
    if (outcome !== "acknowledged") return { state: "processing" };
    const result = await reconcile(db, workspaceId, provider, credentials);
    return { state: result.status === "applied" && !result.deleting ? "scheduled" : "processing" };
  } catch {
    return { state: "processing" };
  }
}

export function catchUpDigest(db: PrismaClient, cmd: Command, workspaceId: string) {
  return withWorkspace(db, cmd.actor, workspaceId, owners, true, async ({ tx }) => {
    const row = await tx.workspaceBilling.findUniqueOrThrow({ where: { workspaceId } });
    const access = entitlement(row);
    if (!access.writable || !row.paidThrough) {
      throw new DomainError(403, "paid_access_required", "Activate a paid subscription before requesting a catch-up digest.");
    }
    const dedupeKey = "catchup/" + workspaceId + "/" + row.paidThrough.toISOString();
    const membership = await tx.membership.findUniqueOrThrow({
      where: { workspaceId_userId: { workspaceId, userId: cmd.actor.id } },
    });
    await tx.internalNotification.upsert({ where: { dedupeKey }, create: {
      workspaceId, recipientId: cmd.actor.id, recipient: membership.email, kind: "catchup", dedupeKey,
      runAt: new Date(), expiresAt: new Date(Date.now() + 86400_000),
    }, update: {} });
    return { queued: true };
  }, "billing");
}
