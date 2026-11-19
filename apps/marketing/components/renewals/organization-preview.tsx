"use client";
import { useTeamPreview } from "../team/team-preview-store";
import { usePreviewWritable } from "../settings/settings-preview-store";
import { useRef, useState } from "react";
import Link from "next/link";
import { archiveItem, correctCycle, editRenewal, withdrawCycle } from "../../../../packages/contracts/renewals";
import { AuthNotice } from "../../../../packages/ui/auth/auth-fields";
import { DashboardPreviewShell as DashboardShell } from "../team/dashboard-preview-shell";
import { OrganizationForm } from "../../../../packages/ui/renewals/organization-form";
import { RenewalHistory } from "../../../../packages/ui/renewals/renewal-history";
import type { OrganizationAction, OrganizationCommand } from "../../../../packages/ui/renewals/organization-contracts";
import type { DecisionFailure } from "../../../../packages/ui/decisions/contracts";
import { useClientPreview } from "../clients/client-preview-store";
import { refreshPreviewRecord } from "./renewal-fixtures";
import { usePreviewOperators } from "../team/dashboard-preview-shell";

type View = OrganizationCommand["operation"] | "history";
type Scenario = "normal" | "loading" | "error" | "read-only" | "directory-unavailable" | "session" | "mfa" | "stale" | "network" | "rate";
const fail = (code: string, message: string, retryAfterSeconds?: number): DecisionFailure => ({ status: "error", code, message, retryAfterSeconds });
function pause(signal: AbortSignal) { return new Promise<void>((resolve, reject) => { if (signal.aborted) { reject(new Error("Aborted")); return; } const cancel = () => { clearTimeout(timer); reject(new Error("Aborted")); }; const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, 450); signal.addEventListener("abort", cancel, { once: true }); }); }
export function OrganizationPreview({ cycleId, view }: { cycleId: string; view: View }) {
  const workspace = useTeamPreview().workspace;
  const previewOperators = usePreviewOperators();
  const store = useClientPreview(), latest = useRef(store); latest.current = store;
  const [scenario, setScenario] = useState<Scenario>("normal"), [generation, setGeneration] = useState(0), [visible, setVisible] = useState(8);
  const record = store.renewals.find(row => row.cycle.id === cycleId);
  const active = record ? store.renewals.find(row => row.cycle.itemId === record.item.id && !row.cycle.closedAt) ?? null : null;
  const successor = record ? store.renewals.find(row => row.cycle.itemId === record.item.id && row.cycle.sequence === record.cycle.sequence + 1) ?? null : null;
  const successorHasRequests = !!successor && store.decisions.some(row => row.cycleId === successor.cycle.id && !row.superseded);
  const directoryAvailable = scenario !== "directory-unavailable";
  const workspaceWritable = usePreviewWritable();
  const canWrite = workspaceWritable && !["loading", "error", "read-only", "session", "mfa"].includes(scenario);
  const history = store.history.filter(row => row.entityId === cycleId).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const action: OrganizationAction = async (command, signal) => {
    await pause(signal);
    if (scenario === "network") throw new Error("Synthetic connection failure");
    if (scenario === "rate") return fail("rate_limited", "Too many attempts. Wait before trying again.", 15);
    if (scenario === "stale") return fail("stale_version", "The record changed. Return to the latest record before continuing.");
    if (!canWrite) return fail("workspace_read_only", "This workspace is read-only.");
    const current = latest.current, found = current.renewals.find(row => row.cycle.id === cycleId);
    if (!found) return fail("not_found", "The record is no longer available.");
    const { item, cycle } = found;
    const itemCommand = command.operation === "archive" || command.operation === "assignment";
    if (command.input.expectedVersion !== (itemCommand ? item.version : cycle.version)) return fail("stale_version", "This record changed. Review the latest version.");
    function revoke(id: string) { for (const request of current.decisions.filter(row => row.cycleId === id && !row.superseded)) current.saveDecision({ ...request, superseded: true }); }
    if (command.operation === "assignment") {
      const parsed = editRenewal.safeParse(command.input);
      if (!parsed.success) return fail("invalid_input", "Check the assignment and recurrence change.");
      const input = parsed.data;
      const active = current.renewals.find(row => row.item.id === item.id && !row.cycle.closedAt);
      if (item.archivedAt || !active) return fail("invalid_transition", "An active, unarchived item is required.");
      if (input.operatorId && (!directoryAvailable || !previewOperators.some(row => row.userId === input.operatorId && !row.removedAt))) return fail("invalid_operator", "Choose an active member from an authorized directory.");
      const nextItem = { ...item, operatorId: input.operatorId ?? item.operatorId, recurrence: input.recurrence ?? item.recurrence, version: item.version + 1 };
      for (const row of current.renewals.filter(row => row.item.id === item.id)) current.saveRenewal(refreshPreviewRecord({ ...row, item: nextItem, suggestedNext: null, cycle: row.cycle.id === active.cycle.id && input.operatorId && input.operatorId !== item.operatorId ? { ...row.cycle, operatorId: input.operatorId, version: row.cycle.version + 1 } : row.cycle }));
      current.appendHistory({ entityId: item.id, event: "item.updated", details: { previousOperator: item.operatorId, operator: nextItem.operatorId, previousRecurrence: item.recurrence, recurrence: nextItem.recurrence } });
      return { status: "success" };
    }
    if (command.operation === "withdraw") {
      const parsed = withdrawCycle.safeParse(command.input);
      if (!parsed.success) return fail("invalid_input", "Record a plain-text withdrawal reason.");
      if (cycle.closedAt || !found.allowedActions.includes("withdraw")) return fail("invalid_transition", "This cycle is already closed or unavailable for withdrawal.");
      revoke(cycle.id);
      current.saveRenewal(refreshPreviewRecord({ ...found, cycle: { ...cycle, state: "withdrawn", closedAt: new Date().toISOString(), blockedReason: null, outcomeNote: parsed.data.reason, version: cycle.version + 1 } }));
      current.appendHistory({ entityId: cycle.id, event: "cycle.withdrawn", details: { reason: parsed.data.reason } });
      return { status: "success" };
    }
    if (command.operation === "archive") {
      const parsed = archiveItem.safeParse(command.input);
      if (!parsed.success) return fail("invalid_input", "Check the abandonment reason.");
      if (item.archivedAt) return fail("invalid_transition", "This item is already archived.");
      const active = current.renewals.find(row => row.item.id === item.id && !row.cycle.closedAt);
      if (active && !parsed.data.abandonReason) return fail("invalid_transition", "Record an abandonment reason for the active cycle.");
      const archivedAt = new Date().toISOString();
      if (active) revoke(active.cycle.id);
      for (const row of current.renewals.filter(row => row.item.id === item.id)) current.saveRenewal(refreshPreviewRecord({ ...row, item: { ...item, version: item.version + 1, archivedAt }, cycle: row.cycle.id === active?.cycle.id ? { ...row.cycle, version: row.cycle.version + 1, state: "withdrawn", closedAt: archivedAt, outcomeNote: parsed.data.abandonReason ?? null, blockedReason: null } : row.cycle }));
      if (active) current.appendHistory({ entityId: active.cycle.id, event: "cycle.withdrawn", details: { reason: parsed.data.abandonReason } });
      current.appendHistory({ entityId: item.id, event: "item.archived", details: {} });
      return { status: "success" };
    }
    const parsed = correctCycle.safeParse(command.input);
    if (!parsed.success) return fail("invalid_input", "Check the correction and next-cycle schedule.");
    if (!cycle.closedAt || !found.allowedActions.includes("correct")) return fail("invalid_transition", "Corrections apply only to closed cycles.");
    const input = parsed.data;
    if (input.successor) {
      const confirmed = input.successor;
      const next = current.renewals.find(row => row.cycle.id === confirmed.id && row.item.id === item.id && row.cycle.sequence === cycle.sequence + 1);
      if (!next) return fail("not_found", "The next cycle is no longer available.");
      if (next.cycle.version !== confirmed.expectedVersion) return fail("stale_version", "The next cycle changed. Review its latest dates.");
      if (next.cycle.closedAt || next.cycle.state !== "open") return fail("invalid_transition", "Only an open next cycle can have corrected dates.");
      if (confirmed.dates.expiryOn <= cycle.expiryOn || cycle.performedOn && confirmed.dates.expiryOn <= cycle.performedOn) return fail("invalid_transition", "Next expiry must follow the closed term and provider action date.");
      if (next.cycle.noticeBy && (!confirmed.dates.noticeBy || confirmed.dates.noticeBy > next.cycle.noticeBy) && !confirmed.providerAgreement) return fail("invalid_transition", "Record the provider agreement before extending or removing next-cycle notice.");
      if (current.decisions.some(row => row.cycleId === next.cycle.id && !row.superseded)) return fail("invalid_transition", "Revise the next cycle explicitly before correcting dates with outstanding terms.");
      current.saveRenewal(refreshPreviewRecord({ ...next, suggestedNext: null, cycle: { ...next.cycle, ...confirmed.dates, version: next.cycle.version + 1, nextActionOn: confirmed.dates.respondBy ?? confirmed.dates.noticeBy ?? confirmed.dates.expiryOn } }));
      current.appendHistory({ entityId: next.cycle.id, event: "cycle.successor_corrected", details: { previousCycleId: cycle.id, dates: confirmed.dates, providerAgreement: confirmed.providerAgreement ?? null } });
    }
    current.saveRenewal(refreshPreviewRecord({ ...found, cycle: { ...cycle, version: cycle.version + 1 } }));
    current.appendHistory({ entityId: cycle.id, event: "cycle.corrected", details: { correction: input.correction, successorId: input.successor?.id ?? null } });
    return { status: "success" };
  };
  return <><DashboardShell workspace={["session", "mfa", "loading", "error"].includes(scenario) ? null : workspace} preview clientsHref="/clients">{scenario === "loading" ? <div className="rr-clients__loading" role="status">Loading record…</div> : scenario === "error" ? <div className="rr-clients__loading"><h1>The record couldn’t load</h1><button className="rr-dashboard__primary" onClick={() => setScenario("normal")}>Try again</button></div> : scenario === "session" || scenario === "mfa" ? <div className="rr-clients__loading"><h1>{scenario === "mfa" ? "Verify your sign-in" : "Log in to continue"}</h1><Link className="rr-dashboard__primary" href={scenario === "mfa" ? "/two-factor" : "/login"}>Continue</Link></div> : !record ? <div className="rr-clients__loading"><h1>Preview record isn’t loaded</h1><p>Load the samples to open this screen.</p><div className="rr-dashboard__actions"><button className="rr-dashboard__primary" type="button" onClick={() => store.loadOrganizationSamples()}>Load organization samples</button><Link className="rr-clients__outline-action" href="/renewals">All renewals</Link></div></div> : <>{!canWrite && <AuthNotice>Read-only workspace. History stays available; changes are unavailable.</AuthNotice>}{view === "history" ? <RenewalHistory cycleId={cycleId} service={record.cycle.service} rows={history.slice(0, visible)} actorNames={{ ...Object.fromEntries(previewOperators.map(row => [row.userId, row.label])), ...Object.fromEntries(store.contacts.map(row => [row.id, row.name])) }} nextCursor={history.length > visible ? "synthetic-next-page" : null} onLoadMore={() => setVisible(value => value + 8)} /> : <OrganizationForm key={`${cycleId}-${view}-${generation}`} mode={view} record={record} activeCycle={active} successor={successor} successorHasRequests={successorHasRequests} operators={directoryAvailable ? previewOperators : []} directoryAvailable={directoryAvailable} canWrite={canWrite} action={action} preview />}</>}</DashboardShell>
    <details className="rr-auth__review"><summary>Local preview tools</summary><p>Synthetic events and complete in-memory sample records only. Sample delivery attention is explicit fixture metadata, not a real failure. No backend, message, provider or payment operation. Loading samples replaces current preview data.</p><div className="rr-auth__review-controls"><label htmlFor="organization-scenario">Screen state<select id="organization-scenario" value={scenario} onChange={event => { setScenario(event.target.value as Scenario); setGeneration(value => value + 1); }}>{["normal", "loading", "error", "read-only", "directory-unavailable", "session", "mfa", "stale", "network", "rate"].map(value => <option key={value}>{value}</option>)}</select></label><button className="rr-clients__outline-action" onClick={() => { store.loadOrganizationSamples(); setScenario("normal"); setVisible(8); setGeneration(value => value + 1); }}>Load organization samples</button></div><nav aria-label="Organization preview navigation"><Link href="/renewals">Queue filters</Link><Link href="/renewals/40000000-0000-4000-8000-000000000001/assignment">Assignment</Link><Link href="/renewals/40000000-0000-4000-8000-000000000001/history">Activity history</Link><Link href="/renewals/40000000-0000-4000-8000-000000000001/withdraw">Withdraw</Link><Link href="/renewals/40000000-0000-4000-8000-000000000007/archive">Archive with active successor</Link><Link href="/renewals/40000000-0000-4000-8000-000000000007/correct">Closed-cycle correction</Link></nav></details></>;
}
