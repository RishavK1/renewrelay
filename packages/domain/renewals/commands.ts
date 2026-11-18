import { revokeDecisions } from "../decisions/revocation";
import type { z } from "zod";
import type * as contracts from "../../contracts/renewals";
import type { PrismaClient, RenewalCycle } from "../../db/generated/client";
import type { Transaction } from "../../db/database";
import { type Command, allStaff, audit, checkVersion, once, withWorkspace } from "../context";
import { DomainError, conflict, notFound } from "../errors";
import { dateFields, dateText, localToday, sqlDate } from "../renewal-dates";
import { checkCapacity, checkOperator, cycleTerms, cycleView, findCycle, findItem,
  insertRenewals, itemView, referenceSets, workspaceTimezone } from "./records";

function invalidTransition(message: string): never {
  throw new DomainError(422, "invalid_transition", message);
}

function renewalWrite<T extends import("../../db/generated/client").Prisma.InputJsonValue>(
  db: PrismaClient, cmd: Command, workspaceId: string, run: (tx: Transaction) => Promise<T>,
) {
  return withWorkspace(db, cmd.actor, workspaceId, allStaff, true, ({ tx }) => once(tx, cmd, workspaceId, () => run(tx)));
}

export function createItem(db: PrismaClient, cmd: Command, workspaceId: string, input: contracts.CreateRenewal) {
  return renewalWrite(db, cmd, workspaceId, async (tx) => {
    const references = await referenceSets(tx, workspaceId, [input]);
    if (!references.clients.has(input.clientId)) notFound();
    if (!references.operators.has(input.operatorId)) conflict("invalid_operator", "Choose an active workspace member as the operator.");
    await checkCapacity(tx, workspaceId, 1);
    const timezone = await workspaceTimezone(tx, workspaceId);
    const [created] = await insertRenewals(tx, cmd, workspaceId, timezone, [input]);
    if (!created) throw new Error("Expected one renewal record.");
    const { item, cycle } = await findCycle(tx, workspaceId, created.cycleId);
    return { item: itemView(item), cycle: cycleView(cycle) };
  });
}

export function updateItem(db: PrismaClient, cmd: Command, workspaceId: string, id: string,
  input: z.infer<typeof contracts.editRenewal>) {
  return renewalWrite(db, cmd, workspaceId, async (tx) => {
    const item = await findItem(tx, workspaceId, id);
    checkVersion(item.version, input.expectedVersion);
    if (item.archivedAt) invalidTransition("This item is archived.");
    const current = await tx.renewalCycle.findFirst({ where: { workspaceId, itemId: id, closedAt: null } });
    if (!current) invalidTransition("This item has ended.");
    if (input.operatorId) await checkOperator(tx, workspaceId, input.operatorId);
    const updated = await tx.renewalItem.update({ where: { workspaceId_id: { workspaceId, id } }, data: {
      operatorId: input.operatorId, recurrence: input.recurrence, version: { increment: 1 },
    } });
    if (input.operatorId && input.operatorId !== item.operatorId) {
      await updateCycle(tx, current, { operatorId: input.operatorId });
    }
    await audit(tx, cmd, workspaceId, "item.updated", id, {
      previousOperator: item.operatorId, operator: updated.operatorId, previousRecurrence: item.recurrence, recurrence: updated.recurrence,
    });
    return itemView(updated);
  });
}

function updateCycle(tx: Transaction, cycle: RenewalCycle, data: import("../../db/generated/client").Prisma.RenewalCycleUncheckedUpdateInput) {
  return tx.renewalCycle.update({
    where: { workspaceId_id: { workspaceId: cycle.workspaceId, id: cycle.id } }, data: { ...data, version: { increment: 1 } },
  });
}

export function reviseSchedule(db: PrismaClient, cmd: Command, workspaceId: string, id: string,
  input: z.infer<typeof contracts.editCycle>) {
  return renewalWrite(db, cmd, workspaceId, async (tx) => {
    const { cycle, item } = await findCycle(tx, workspaceId, id);
    checkVersion(cycle.version, input.expectedVersion);
    if (cycle.closedAt) invalidTransition("Use a correction for closed cycles.");
    const previousNotice = cycle.noticeBy ? dateText(cycle.noticeBy) : null;
    if (previousNotice && (!input.noticeBy || input.noticeBy > previousNotice) && !input.providerAgreement) {
      invalidTransition("Record the provider agreement before extending or removing the previous notice deadline.");
    }
    await revokeDecisions(tx, workspaceId, id);
    const updated = await updateCycle(tx, cycle, {
      ...dateFields(input, true), ...cycleTerms(input), state: cycle.state === "draft" ? "draft" : "open", intendedAction: null,
    });
    if (input.service !== item.service || input.provider !== item.provider) {
      await tx.renewalItem.update({ where: { workspaceId_id: { workspaceId, id: item.id } }, data: {
        service: input.service, provider: input.provider, version: { increment: 1 },
      } });
    }
    await audit(tx, cmd, workspaceId, "cycle.revised", id, {
      fromState: cycle.state,
      previousExpiryOn: dateText(cycle.expiryOn),
      previousNoticeBy: cycle.noticeBy ? dateText(cycle.noticeBy) : null,
      previousRespondBy: cycle.respondBy ? dateText(cycle.respondBy) : null,
      expiryOn: input.expiryOn, noticeBy: input.noticeBy, respondBy: input.respondBy,
      providerAgreement: input.providerAgreement ?? null,
    });
    return cycleView(updated);
  });
}

export function activateCycle(db: PrismaClient, cmd: Command, workspaceId: string, id: string, expectedVersion: number) {
  return renewalWrite(db, cmd, workspaceId, async (tx) => {
    const { cycle } = await findCycle(tx, workspaceId, id);
    checkVersion(cycle.version, expectedVersion);
    if (cycle.state !== "draft") invalidTransition("Only a draft can be activated.");
    const view = cycleView(await updateCycle(tx, cycle, { state: "open" }));
    await audit(tx, cmd, workspaceId, view.overdue ? "cycle.activated_overdue" : "cycle.activated", id);
    return view;
  });
}

type Readiness = ({ kind: "waived" } & z.infer<typeof contracts.readyCycle>) |
  ({ kind: "offline" } & z.infer<typeof contracts.offlineDecision>);

export function markReady(db: PrismaClient, cmd: Command, workspaceId: string, id: string, input: Readiness) {
  return renewalWrite(db, cmd, workspaceId, async (tx) => {
    const { cycle } = await findCycle(tx, workspaceId, id);
    checkVersion(cycle.version, input.expectedVersion);
    if (cycle.state !== "open") invalidTransition("Only an active open cycle can be made ready.");
    const today = localToday(cycle.timezone);
    if (input.kind === "offline") {
      if (input.instructedOn > today) invalidTransition("The instruction date cannot be in the future.");
      if (input.action === "renew" && (cycle.clientQuoteMinor === null || !cycle.term)) {
        invalidTransition("Record a quote and term before recording approval.");
      }
    }
    await revokeDecisions(tx, workspaceId, id);
    const updated = await updateCycle(tx, cycle, {
      state: "ready", intendedAction: input.action, nextActionOn: cycle.noticeBy ?? cycle.expiryOn,
    });
    await audit(tx, cmd, workspaceId, input.kind === "offline" ? "cycle.offline_instruction" : "cycle.approval_waived", id, {
      action: input.action, reason: input.reason,
      ...(input.kind === "offline" ? {
        source: input.source, instructedOn: input.instructedOn, currency: cycle.currency,
        quoteMinor: cycle.clientQuoteMinor, term: cycle.term,
      } : {}),
    });
    return cycleView(updated, today);
  });
}

export function completeRenewal(db: PrismaClient, cmd: Command, workspaceId: string, id: string,
  input: z.infer<typeof contracts.completeCycle>) {
  return renewalWrite(db, cmd, workspaceId, async (tx) => {
    const { item, cycle } = await findCycle(tx, workspaceId, id);
    checkVersion(cycle.version, input.expectedVersion);
    if (cycle.state !== "ready") invalidTransition("Record the instruction or waive approval before recording the outcome.");
    if (cycle.blockedReason) invalidTransition("Resolve the provider blocker before recording completion.");
    if ((input.outcome === "renewed") !== (cycle.intendedAction === "renew")) {
      invalidTransition("The provider outcome must match the intended action.");
    }
    if (input.performedOn > localToday(cycle.timezone)) invalidTransition("The provider action date cannot be in the future.");
    const needsSuccessor = input.outcome === "renewed" && item.recurrence !== "once";
    if (needsSuccessor !== !!input.next) {
      invalidTransition(needsSuccessor ? "Confirm the next term dates." : "This outcome cannot create a successor.");
    }
    if (input.next && (input.next.expiryOn <= dateText(cycle.expiryOn) || input.next.expiryOn <= input.performedOn)) {
      invalidTransition("The successor must expire after this term and the recorded action date.");
    }
    const updated = await updateCycle(tx, cycle, {
      state: input.outcome, closedAt: new Date(), performedOn: sqlDate(input.performedOn),
      providerReference: input.providerReference, outcomeNote: input.note,
      billingStatus: cycle.payer === "agency" && cycle.rebillable ? "to_invoice" : "not_applicable",
    });
    const successor = input.next ? await tx.renewalCycle.create({ data: {
      workspaceId, itemId: item.id, sequence: cycle.sequence + 1, timezone: cycle.timezone,
      state: "open", operatorId: item.operatorId, ...cycleTerms(cycle), ...dateFields(input.next, true),
    } }) : null;
    await audit(tx, cmd, workspaceId, `cycle.${input.outcome}`, id, {
      performedOn: input.performedOn, successorId: successor?.id ?? null, billingStatus: updated.billingStatus,
    });
    if (successor) await audit(tx, cmd, workspaceId, "cycle.successor_created", successor.id, { previousCycleId: id });
    return { cycle: cycleView(updated), successor: successor ? cycleView(successor) : null };
  });
}

export function updateBlocker(db: PrismaClient, cmd: Command, workspaceId: string, id: string,
  input: z.infer<typeof contracts.setBlocker>) {
  return renewalWrite(db, cmd, workspaceId, async (tx) => {
    const { cycle } = await findCycle(tx, workspaceId, id);
    checkVersion(cycle.version, input.expectedVersion);
    if (cycle.closedAt || cycle.state === "draft") invalidTransition("Only an active cycle can have a provider blocker.");
    if (!input.blocked && !cycle.blockedReason) invalidTransition("This cycle has no active blocker.");
    const updated = await updateCycle(tx, cycle, { blockedReason: input.blocked ? input.reason : null });
    await audit(tx, cmd, workspaceId, input.blocked ? "cycle.blocked" : "cycle.unblocked", id, {
      reason: input.reason, previous: cycle.blockedReason,
    });
    return cycleView(updated);
  });
}

async function withdraw(tx: Transaction, cmd: Command, cycle: RenewalCycle, reason: string) {
  await revokeDecisions(tx, cycle.workspaceId, cycle.id);
  const result = await updateCycle(tx, cycle, { state: "withdrawn", closedAt: new Date(), outcomeNote: reason, blockedReason: null });
  await audit(tx, cmd, cycle.workspaceId, "cycle.withdrawn", cycle.id, { reason });
  return result;
}

export function withdrawRenewal(db: PrismaClient, cmd: Command, workspaceId: string, id: string,
  input: z.infer<typeof contracts.withdrawCycle>) {
  return renewalWrite(db, cmd, workspaceId, async (tx) => {
    const { cycle } = await findCycle(tx, workspaceId, id);
    checkVersion(cycle.version, input.expectedVersion);
    if (cycle.closedAt) invalidTransition("This cycle is already closed.");
    return cycleView(await withdraw(tx, cmd, cycle, input.reason));
  });
}

export function appendCorrection(db: PrismaClient, cmd: Command, workspaceId: string, id: string,
  input: z.infer<typeof contracts.correctCycle>) {
  return renewalWrite(db, cmd, workspaceId, async (tx) => {
    const { cycle } = await findCycle(tx, workspaceId, id);
    checkVersion(cycle.version, input.expectedVersion);
    if (!cycle.closedAt) invalidTransition("Corrections apply to closed cycles.");
    let successorId: string | null = null;
    if (input.successor) {
      const confirmed = input.successor;
      const next = await tx.renewalCycle.findFirst({ where: { workspaceId, id: confirmed.id, itemId: cycle.itemId, sequence: cycle.sequence + 1 } });
      if (!next) notFound();
      checkVersion(next.version, confirmed.expectedVersion);
      if (next.closedAt || next.state !== "open") invalidTransition("Only an open successor can have corrected dates.");
      if (confirmed.dates.expiryOn <= dateText(cycle.expiryOn) ||
        (cycle.performedOn && confirmed.dates.expiryOn <= dateText(cycle.performedOn))) invalidTransition("The successor must remain after the completed term.");
      if (next.noticeBy && (!confirmed.dates.noticeBy || confirmed.dates.noticeBy > dateText(next.noticeBy)) && !confirmed.providerAgreement) {
        invalidTransition("Record the provider agreement before extending or removing the successor notice deadline.");
      }
      const live = await tx.decisionRequest.count({ where: { workspaceId, cycleId: next.id, supersededAt: null } });
      if (live) invalidTransition("Revise the successor explicitly before correcting dates with outstanding terms.");
      await updateCycle(tx, next, dateFields(confirmed.dates, true));
      successorId = next.id;
      await audit(tx, cmd, workspaceId, "cycle.successor_corrected", next.id, { previousCycleId: id, dates: confirmed.dates, providerAgreement: confirmed.providerAgreement ?? null });
    }
    const updated = await updateCycle(tx, cycle, {});
    await audit(tx, cmd, workspaceId, "cycle.corrected", id, { correction: input.correction, successorId });
    return cycleView(updated);
  });
}

export function updateBilling(db: PrismaClient, cmd: Command, workspaceId: string, id: string,
  input: z.infer<typeof contracts.setBilling>) {
  return renewalWrite(db, cmd, workspaceId, async (tx) => {
    const { cycle } = await findCycle(tx, workspaceId, id);
    checkVersion(cycle.version, input.expectedVersion);
    if ((cycle.state !== "renewed" && cycle.state !== "cancelled") || cycle.payer !== "agency" || !cycle.rebillable) {
      invalidTransition("Billing can only be changed for completed agency-paid, rebillable actions.");
    }
    const updated = await updateCycle(tx, cycle, { billingStatus: input.status, invoiceReference: input.invoiceReference ?? null });
    await audit(tx, cmd, workspaceId, "cycle.billing_changed", id, { from: cycle.billingStatus, to: input.status });
    return cycleView(updated);
  });
}

export function archiveRenewal(db: PrismaClient, cmd: Command, workspaceId: string, id: string,
  input: z.infer<typeof contracts.archiveItem>) {
  return renewalWrite(db, cmd, workspaceId, async (tx) => {
    const item = await findItem(tx, workspaceId, id);
    checkVersion(item.version, input.expectedVersion);
    if (item.archivedAt) invalidTransition("This item is already archived.");
    const active = await tx.renewalCycle.findFirst({ where: { workspaceId, itemId: id, closedAt: null } });
    if (active) {
      if (!input.abandonReason) invalidTransition("Resolve the current cycle or record an abandonment reason.");
      await withdraw(tx, cmd, active, input.abandonReason);
    }
    const updated = await tx.renewalItem.update({
      where: { workspaceId_id: { workspaceId, id } }, data: { archivedAt: new Date(), version: { increment: 1 } },
    });
    await audit(tx, cmd, workspaceId, "item.archived", id);
    return itemView(updated);
  });
}
