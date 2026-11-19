import type { CreateRenewal } from "../../../../packages/contracts/renewals";
import type { RenewalDetailRecord, RenewalQueueRow } from "../../../../packages/ui/renewals/contracts";

export function previewToday(timezone = "Asia/Kolkata") {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value).join("-");
}
export function refreshPreviewRecord(record: RenewalDetailRecord): RenewalDetailRecord {
  const today = previewToday(record.cycle.timezone), cycle = { ...record.cycle };
  cycle.overdue = !cycle.closedAt && cycle.state !== "draft" && cycle.nextActionOn < today;
  cycle.providerNoticeMissed = !cycle.closedAt && cycle.state !== "draft" && !!cycle.noticeBy && cycle.noticeBy < today;
  const allowedActions = cycle.closedAt ? ["correct", ...(cycle.payer === "agency" && cycle.rebillable && ["renewed", "cancelled"].includes(cycle.state) ? ["billing"] : [])] : cycle.state === "draft" ? ["activate", "revise", "withdraw"] : ["revise", "withdraw", ...(cycle.state === "ready" ? ["blocker", ...(!cycle.blockedReason ? ["complete"] : [])] : ["ready", "record_offline"]), ...(cycle.respondBy && cycle.respondBy >= today && cycle.clientQuoteMinor !== null && cycle.term ? ["issue"] : [])];
  return { ...record, cycle, allowedActions };
}
/** Host-only synthetic API-shaped records. Real adapters use server date flags. */
export function previewRenewal(input: CreateRenewal, itemId: string, cycleId: string, timezone = "Asia/Kolkata"): RenewalDetailRecord {
  const { clientId, recurrence, mode, ...terms } = input;
  const nextActionOn = input.respondBy ?? input.noticeBy ?? input.expiryOn;
  const date = previewToday(timezone);
  return refreshPreviewRecord({ item: { id: itemId, clientId, recurrence, operatorId: input.operatorId, service: input.service, provider: input.provider, version: 1, archivedAt: null }, cycle: {
    ...terms, id: cycleId, itemId, version: 1, sequence: 1, timezone, state: mode === "draft" ? "draft" : "open", nextActionOn,
    overdue: mode !== "draft" && nextActionOn < date, providerNoticeMissed: mode !== "draft" && !!input.noticeBy && input.noticeBy < date,
    blockedReason: null, intendedAction: null, billingStatus: "not_applicable", closedAt: null, performedOn: null, providerReference: null, outcomeNote: null, invoiceReference: null,
  }, allowedActions: [] });
}
export function queuePreview(record: RenewalDetailRecord): RenewalQueueRow {
  const { supplierCostMinor: _cost, term: _term, payer: _payer, rebillable: _rebillable, performedOn: _performed, providerReference: _reference, outcomeNote: _outcomeNote, invoiceReference: _invoiceReference, ...cycle } = record.cycle;
  return { ...cycle, clientId: record.item.clientId };
}
export function sampleRenewals(clientId: string): RenewalDetailRecord[] {
  const base: CreateRenewal = { clientId, service: "Website hosting", provider: "Example Hosting", operatorId: "preview-owner", recurrence: "yearly", expiryOn: "2026-12-20", noticeBy: "2026-12-05", respondBy: "2026-12-01", payer: "agency", rebillable: true, autoRenew: false, currency: "INR", supplierCostMinor: 120000, clientQuoteMinor: 150000, term: "12 months of website hosting", mode: "activate" };
  const open = previewRenewal(base, "30000000-0000-4000-8000-000000000001", "40000000-0000-4000-8000-000000000001");
  const draft = previewRenewal({ ...base, service: "Domain registration", provider: "Example Registrar", mode: "draft", expiryOn: "2027-03-10", noticeBy: null, respondBy: null, supplierCostMinor: null, clientQuoteMinor: null, term: null }, "30000000-0000-4000-8000-000000000002", "40000000-0000-4000-8000-000000000002");
  const ready = previewRenewal({ ...base, service: "Website care", provider: "Agency service", recurrence: "monthly", expiryOn: "2026-12-10", noticeBy: null, respondBy: "2026-12-01" }, "30000000-0000-4000-8000-000000000003", "40000000-0000-4000-8000-000000000003");
  ready.cycle = { ...ready.cycle, state: "ready", intendedAction: "renew", nextActionOn: ready.cycle.expiryOn, overdue: ready.cycle.expiryOn < previewToday(), providerNoticeMissed: false, blockedReason: "Awaiting provider confirmation (sample)." };
  const overdue = previewRenewal({ ...base, service: "TLS certificate", provider: "Example Certificate Service", recurrence: "once", expiryOn: "2026-10-30", noticeBy: "2026-10-15", respondBy: "2026-10-10", currency: "USD", supplierCostMinor: null, clientQuoteMinor: 1500, term: "Certificate renewal" }, "30000000-0000-4000-8000-000000000004", "40000000-0000-4000-8000-000000000004");
  return [open, draft, ready, overdue].map(refreshPreviewRecord);
}
