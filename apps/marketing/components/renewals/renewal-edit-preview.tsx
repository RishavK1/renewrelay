"use client";
import { useTeamPreview } from "../team/team-preview-store";
import { usePreviewWritable } from "../settings/settings-preview-store";

import { useRef, useState } from "react";
import Link from "next/link";
import { DashboardPreviewShell as DashboardShell } from "../team/dashboard-preview-shell";
import { AuthNotice } from "../../../../packages/ui/auth/auth-fields";
import { RenewalEditForm } from "../../../../packages/ui/renewals/renewal-edit-form";
import type { RenewalEditAction, RenewalEditCommand } from "../../../../packages/ui/renewals/edit-contracts";
import type { DecisionFailure } from "../../../../packages/ui/decisions/contracts";
import { activateDraft, editCycle, offlineDecision } from "../../../../packages/contracts/renewals";
import { useClientPreview } from "../clients/client-preview-store";
import { previewToday, refreshPreviewRecord } from "./renewal-fixtures";

type Mode = RenewalEditCommand["operation"];
type Scenario = "normal" | "loading" | "error" | "unavailable" | "read-only" | "session" | "mfa" | "stale" | "network" | "rate";
const fail = (code: string, message: string, retryAfterSeconds?: number): DecisionFailure => ({ status: "error", code, message, retryAfterSeconds });
function pause(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new Error("Aborted")); return; }
    const cancel = () => { clearTimeout(timer); reject(new Error("Aborted")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, 450);
    signal.addEventListener("abort", cancel, { once: true });
  });
}
export function RenewalEditPreview({ cycleId, mode }: { cycleId: string; mode: Mode }) {
  const workspace = useTeamPreview().workspace;
  const store = useClientPreview();
  const latest = useRef(store); latest.current = store;
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [generation, setGeneration] = useState(0);
  const record = store.renewals.find(row => row.cycle.id === cycleId);
  const workspaceWritable = usePreviewWritable();
  const canWrite = workspaceWritable && !["loading", "error", "unavailable", "read-only", "session", "mfa"].includes(scenario);
  const action: RenewalEditAction = async (command, signal) => {
    await pause(signal);
    if (scenario === "network") throw new Error("Synthetic connection failure");
    if (scenario === "rate") return fail("rate_limited", "Too many attempts. Wait before trying again.", 15);
    if (scenario === "stale") return fail("stale_version", "This renewal changed. Return to its details and review the current version.");
    if (!canWrite) return fail("workspace_read_only", "This workspace is read-only.");
    const current = latest.current, found = current.renewals.find(row => row.cycle.id === cycleId);
    if (!found) return fail("not_found", "This renewal is unavailable.");
    const c = found.cycle;
    if (command.input.expectedVersion !== c.version) return fail("stale_version", "This renewal has changed. Review its current details.");
    const version = c.version + 1;
    function revokePreviewDecisions() { for (const request of current.decisions.filter(row => row.cycleId === cycleId && !row.superseded)) current.saveDecision({ ...request, superseded: true }); }
    if (command.operation === "revise") {
      const parsed = editCycle.safeParse(command.input);
      if (!parsed.success) return fail("invalid_input", "Check the renewal details, dates and amounts.");
      if (c.closedAt || !found.allowedActions.includes("revise")) return fail("invalid_transition", "Closed cycles need a correction; they can’t be edited here.");
      const input = parsed.data;
      if (c.noticeBy && (!input.noticeBy || input.noticeBy > c.noticeBy) && !input.providerAgreement) return fail("invalid_transition", "Record the provider agreement before extending or removing the notice deadline.");
      const { expectedVersion: _version, providerAgreement: _agreement, ...fields } = input;
      revokePreviewDecisions();
      const itemChanged = found.item.service !== input.service || found.item.provider !== input.provider;
      const item = itemChanged ? { ...found.item, service: input.service, provider: input.provider, version: found.item.version + 1 } : found.item;
      // Existing closed cycles share the item label too; their frozen cycle terms stay unchanged.
      if (itemChanged) for (const other of current.renewals.filter(row => row.cycle.itemId === item.id && row.cycle.id !== cycleId)) current.saveRenewal({ ...other, item });
      current.saveRenewal(refreshPreviewRecord({ ...found, item, suggestedNext: null, cycle: { ...c, ...fields, version, state: c.state === "draft" ? "draft" : "open", intendedAction: null, nextActionOn: input.respondBy ?? input.noticeBy ?? input.expiryOn } }));
      current.appendHistory({ entityId: cycleId, event: "cycle.revised", details: { fromState: c.state, previousExpiryOn: c.expiryOn, previousNoticeBy: c.noticeBy, previousRespondBy: c.respondBy, expiryOn: input.expiryOn, noticeBy: input.noticeBy, respondBy: input.respondBy, providerAgreement: input.providerAgreement ?? null } });
      return { status: "success", version };
    }
    if (command.operation === "activate") {
      const parsed = activateDraft.safeParse(command.input);
      if (!parsed.success) return fail("invalid_input", "Review the current draft version.");
      if (c.state !== "draft" || !found.allowedActions.includes("activate")) return fail("invalid_transition", "Only a draft can be activated.");
      current.saveRenewal(refreshPreviewRecord({ ...found, cycle: { ...c, version, state: "open" } }));
      current.appendHistory({ entityId: cycleId, event: c.nextActionOn < previewToday(c.timezone) ? "cycle.activated_overdue" : "cycle.activated", details: {} });
      return { status: "success", version };
    }
    const parsed = offlineDecision.safeParse(command.input);
    if (!parsed.success) return fail("invalid_input", "Check the instruction, source, date and reason.");
    const input = parsed.data;
    if (c.state !== "open" || c.closedAt || !found.allowedActions.includes("record_offline")) return fail("invalid_transition", "Only an active open cycle can receive an offline instruction.");
    if (input.instructedOn > previewToday(c.timezone)) return fail("invalid_transition", "The instruction date cannot be in the future.");
    if (input.action === "renew" && (c.clientQuoteMinor === null || !c.term)) return fail("invalid_transition", "Record a quote and term before recording approval.");
    revokePreviewDecisions();
    current.saveRenewal(refreshPreviewRecord({ ...found, cycle: { ...c, version, state: "ready", intendedAction: input.action, nextActionOn: c.noticeBy ?? c.expiryOn } }));
    current.appendHistory({ entityId: cycleId, event: "cycle.offline_instruction", details: { action: input.action, source: input.source, instructedOn: input.instructedOn, reason: input.reason, currency: c.currency, quoteMinor: c.clientQuoteMinor, term: c.term } });
    return { status: "success", version };
  };
  const trusted = !["loading", "error", "session", "mfa"].includes(scenario);
  return <><DashboardShell workspace={trusted ? workspace : null} preview clientsHref="/clients">
    {scenario === "loading" ? <div className="rr-clients__loading" role="status">Loading renewal details…</div> : scenario === "error" ? <div className="rr-clients__loading"><h1>Renewal details couldn’t load</h1><button className="rr-dashboard__primary" onClick={() => setScenario("normal")}>Try again</button></div> : scenario === "session" || scenario === "mfa" ? <div className="rr-clients__loading"><h1>{scenario === "mfa" ? "Verify your sign-in" : "Log in to continue"}</h1><Link className="rr-dashboard__primary" href={scenario === "mfa" ? "/two-factor" : "/login"}>Continue</Link></div> : !record || scenario === "unavailable" ? <div className="rr-clients__loading"><h1>Renewal isn’t available</h1><p>Load the samples below, or open a renewal from the current preview.</p><Link className="rr-dashboard__primary" href="/renewals">All renewals</Link></div> : <>{!canWrite && <AuthNotice>Read-only workspace. Details remain visible; changes are unavailable.</AuthNotice>}<RenewalEditForm key={`${cycleId}-${mode}-${generation}`} mode={mode} record={record} canWrite={canWrite} today={previewToday(record.cycle.timezone)} clientName={store.clients.find(row => row.id === record.item.clientId)?.name ?? "Client details not loaded"} action={action} preview /></>}
  </DashboardShell><details className="rr-auth__review"><summary>Local preview tools</summary><p>Synthetic in-memory records only. Loading samples replaces the current preview. No backend, provider, email or payment action occurs.</p><div className="rr-auth__review-controls"><label htmlFor="renewal-edit-scenario">Screen state<select id="renewal-edit-scenario" value={scenario} onChange={event => { setScenario(event.target.value as Scenario); setGeneration(value => value + 1); }}>{["normal", "loading", "error", "unavailable", "read-only", "session", "mfa", "stale", "network", "rate"].map(value => <option key={value}>{value}</option>)}</select></label><button className="rr-clients__outline-action" onClick={() => { store.loadFollowThroughSamples(); setScenario("normal"); setGeneration(value => value + 1); }}>Load renewal samples</button></div><nav aria-label="Renewal editing preview navigation"><Link href="/renewals/40000000-0000-4000-8000-000000000001/edit">Edit active renewal</Link><Link href="/renewals/40000000-0000-4000-8000-000000000002/activate">Activate draft</Link><Link href="/renewals/40000000-0000-4000-8000-000000000001/record-offline">Offline instruction</Link><Link href="/renewals/40000000-0000-4000-8000-000000000005/edit">Edit ready renewal</Link></nav></details></>;
}
