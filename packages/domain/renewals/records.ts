import { requireOperational } from "../billing/policy";
import { randomUUID } from "node:crypto";
import type { CreateRenewal } from "../../contracts/renewals";
import type { Transaction } from "../../db/database";
import type { RenewalCycle, RenewalItem } from "../../db/generated/client";
import { type Command } from "../context";
import { conflict, notFound } from "../errors";
import { actionDate, dateFields, dateText, localToday, sqlDate } from "../renewal-dates";

export function itemView(item: RenewalItem) {
  return { ...item, anchorOn: dateText(item.anchorOn), archivedAt: item.archivedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() };
}

export function cycleView(cycle: RenewalCycle, today = localToday(cycle.timezone)) {
  const {
    expiryOn, noticeBy, respondBy, nextActionOn, performedOn, closedAt, createdAt, updatedAt, ...record
  } = cycle;
  const actionable = !closedAt && cycle.state !== "draft";
  return {
    ...record,
    expiryOn: dateText(expiryOn),
    noticeBy: noticeBy ? dateText(noticeBy) : null,
    respondBy: respondBy ? dateText(respondBy) : null,
    nextActionOn: dateText(nextActionOn),
    performedOn: performedOn ? dateText(performedOn) : null,
    closedAt: closedAt?.toISOString() ?? null,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    overdue: actionable && dateText(nextActionOn) < today,
    providerNoticeMissed: actionable && !!noticeBy && dateText(noticeBy) < today,
  };
}

export function cycleTerms(source: Pick<CreateRenewal, "service" | "provider" | "payer" | "rebillable" | "autoRenew" |
  "currency" | "supplierCostMinor" | "clientQuoteMinor" | "term">) {
  const { service, provider, payer, rebillable, autoRenew, currency, supplierCostMinor, clientQuoteMinor, term } = source;
  return { service, provider, payer, rebillable, autoRenew, currency, supplierCostMinor, clientQuoteMinor, term };
}

export async function findItem(tx: Transaction, workspaceId: string, id: string) {
  const item = await tx.renewalItem.findUnique({ where: { workspaceId_id: { workspaceId, id } } });
  if (!item) notFound();
  return item;
}

export async function findCycle(tx: Transaction, workspaceId: string, id: string) {
  const cycle = await tx.renewalCycle.findUnique({ where: { workspaceId_id: { workspaceId, id } }, include: { item: true } });
  if (!cycle) notFound();
  const { item, ...record } = cycle;
  return { item, cycle: record };
}

export async function checkOperator(tx: Transaction, workspaceId: string, userId: string) {
  if (!(await tx.membership.findFirst({ where: { workspaceId, userId, removedAt: null }, select: { userId: true } }))) {
    conflict("invalid_operator", "Choose an active workspace member as the operator.");
  }
}

export async function checkCapacity(tx: Transaction, workspaceId: string, adding: number) {
  const used = await tx.renewalItem.count({ where: { workspaceId, archivedAt: null } });
  const { limits } = await requireOperational(tx, workspaceId);
  if (used + adding > limits.items) {
    conflict("item_limit", `There are ${used} of ${limits.items} item slots in use. This request requires ${adding}.`);
  }
}

export async function referenceSets(tx: Transaction, workspaceId: string, inputs: CreateRenewal[]) {
  const clients = await tx.client.findMany({
    where: { workspaceId, id: { in: [...new Set(inputs.map(({ clientId }) => clientId))] }, archivedAt: null },
    select: { id: true },
  });
  const operators = await tx.membership.findMany({
    where: { workspaceId, userId: { in: [...new Set(inputs.map(({ operatorId }) => operatorId))] }, removedAt: null },
    select: { userId: true },
  });
  return {
    clients: new Set(clients.map(({ id }) => id)),
    operators: new Set(operators.map(({ userId }) => userId)),
  };
}

export async function insertRenewals(tx: Transaction, cmd: Command, workspaceId: string, timezone: string,
  inputs: CreateRenewal[]) {
  const today = localToday(timezone);
  const records = inputs.map((input) => {
    const itemId = randomUUID();
    const cycleId = randomUUID();
    const { clientId, operatorId, service, provider, recurrence } = input;
    const state = input.mode === "draft" ? "draft" as const : "open" as const;
    return {
      item: { id: itemId, workspaceId, clientId, operatorId, service, provider, recurrence, anchorOn: sqlDate(input.expiryOn) },
      cycle: { id: cycleId, workspaceId, itemId, operatorId, sequence: 1, state, timezone,
        ...cycleTerms(input), ...dateFields(input, true) },
      overdueActivation: state === "open" && actionDate(input, true) < today,
    };
  });
  await tx.renewalItem.createMany({ data: records.map(({ item }) => item) });
  await tx.renewalCycle.createMany({ data: records.map(({ cycle }) => cycle) });
  await tx.auditEvent.createMany({ data: records.flatMap(({ item, cycle, overdueActivation }) => {
    const context = { workspaceId, actorId: cmd.actor.id, requestId: cmd.requestId };
    return [
      { ...context, event: "item.created", entityId: item.id, details: { cycleId: cycle.id } },
      { ...context, event: "cycle.created", entityId: cycle.id, details: { state: cycle.state } },
      ...(overdueActivation ? [{ ...context, event: "cycle.activated_overdue", entityId: cycle.id, details: {} }] : []),
    ];
  }) });
  return records.map(({ item, cycle }) => ({ itemId: item.id, cycleId: cycle.id }));
}

export function workspaceTimezone(tx: Transaction, id: string) {
  return tx.workspace.findUniqueOrThrow({ where: { id }, select: { timezone: true } }).then(({ timezone }) => timezone);
}
