import { followThroughSamples } from "./follow-through-fixtures";
import { refreshPreviewRecord } from "./renewal-fixtures";
import type { PreviewHistoryRow } from "../../../../packages/ui/renewals/organization-contracts";
export const previewOperators = [{ userId: "preview-owner", label: "Workspace owner (sample)", removedAt: null }, { userId: "preview-member", label: "Sam Lee (sample)", removedAt: null }];
export function organizationSamples(clientId: string) {
  const sample = followThroughSamples(clientId);
  const closed = sample.renewals.find(row => row.cycle.id.endsWith("000007"))!;
  const item = { ...closed.item, recurrence: "yearly" as const };
  closed.item = item;
  sample.renewals.push(refreshPreviewRecord({ item, cycle: { ...closed.cycle, id: "40000000-0000-4000-8000-000000000008", sequence: 2, version: 1, state: "open", expiryOn: "2027-12-20", noticeBy: "2027-12-05", respondBy: "2027-12-01", nextActionOn: "2027-12-01", intendedAction: null, closedAt: null, performedOn: null, providerReference: null, outcomeNote: null, invoiceReference: null, billingStatus: "not_applicable" }, allowedActions: [] }));
  const now = Date.now();
  const history: PreviewHistoryRow[] = sample.renewals.map((row, index) => ({ id: crypto.randomUUID(), entityId: row.cycle.id, actorId: "preview-owner", event: row.cycle.sequence === 2 ? "cycle.successor_created" : "cycle.created", createdAt: new Date(row.cycle.sequence === 2 ? now - 30000 : now - 120000 + index).toISOString(), details: row.cycle.sequence === 2 ? { previousCycleId: closed.cycle.id } : { state: row.cycle.state === "draft" ? "draft" : "open" } }));
  history.push({ id: crypto.randomUUID(), entityId: closed.cycle.id, event: "cycle.renewed", actorId: "preview-owner", createdAt: new Date(now - 60000).toISOString(), details: { performedOn: closed.cycle.performedOn, billingStatus: closed.cycle.billingStatus } });
  return { ...sample, history, deliveryFailedRequestIds: [sample.decisions[0]!.id] };
}
