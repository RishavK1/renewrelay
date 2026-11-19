import type { DecisionPreviewRecord } from "../../../../packages/ui/decisions/contracts";
import { previewRenewal, previewToday, refreshPreviewRecord, sampleRenewals } from "./renewal-fixtures";

/** Explicit local samples, not production lifecycle or API adapters. */
export function followThroughSamples(clientId: string) {
  const renewals = sampleRenewals(clientId);
  const ready = previewRenewal({ clientId, operatorId: "preview-owner", service: "Website support", provider: "Example Services", recurrence: "yearly", mode: "activate", expiryOn: "2026-12-20", noticeBy: "2026-12-05", respondBy: "2026-12-01", payer: "agency", rebillable: true, autoRenew: false, currency: "INR", supplierCostMinor: 120000, clientQuoteMinor: 150000, term: "12 months of website support" }, "30000000-0000-4000-8000-000000000005", "40000000-0000-4000-8000-000000000005");
  ready.cycle = { ...ready.cycle, state: "ready", intendedAction: "renew", nextActionOn: ready.cycle.noticeBy ?? ready.cycle.expiryOn };
  const cancel = { ...ready, item: { ...ready.item, id: "30000000-0000-4000-8000-000000000006", service: "Legacy hosting" }, cycle: { ...ready.cycle, id: "40000000-0000-4000-8000-000000000006", itemId: "30000000-0000-4000-8000-000000000006", service: "Legacy hosting", intendedAction: "cancel" as const } };
  const completed = { ...ready, item: { ...ready.item, id: "30000000-0000-4000-8000-000000000007", recurrence: "once" as const }, cycle: { ...ready.cycle, id: "40000000-0000-4000-8000-000000000007", itemId: "30000000-0000-4000-8000-000000000007", state: "renewed" as const, closedAt: new Date().toISOString(), performedOn: previewToday(), providerReference: "SAMPLE-RENEWAL-1042", outcomeNote: "Provider confirmation checked (sample).", billingStatus: "to_invoice" as const } };
  renewals.push(...[ready, cancel, completed].map(refreshPreviewRecord));
  renewals[0] = { ...renewals[0]!, cycle: { ...renewals[0]!.cycle, version: 2 } };
  const cycle = renewals[0]!.cycle;
  const id = "50000000-0000-4000-8000-000000000001";
  const terms = { requestId: id, revision: 1, issuer: "Northline Studio", service: cycle.service, currency: cycle.currency, amountMinor: cycle.clientQuoteMinor!, term: cycle.term!, respondBy: cycle.respondBy!, timezone: cycle.timezone, expiryOn: cycle.expiryOn, noticeBy: cycle.noticeBy, note: "Please review this hosting renewal (sample).", version: cycle.version, decided: false };
  const decisions: DecisionPreviewRecord[] = [{ id, cycleId: cycle.id, contactId: "20000000-0000-4000-8000-000000000001", recipientEmail: "alex@acme.example", superseded: false, terms, responses: [{ id: "60000000-0000-4000-8000-000000000001", choice: "question", question: "Does this quote include the staging site as well? (Sample question.)", createdAt: new Date().toISOString(), request: { id, revision: 1, recipientEmail: "alex@acme.example", service: terms.service, currency: terms.currency, amountMinor: terms.amountMinor, term: terms.term, respondBy: terms.respondBy, customerNote: terms.note }, resolution: null }] }];
  return { renewals, decisions };
}
