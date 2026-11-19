"use client";
import { useTeamPreview } from "../team/team-preview-store";
import { usePreviewWritable } from "../settings/settings-preview-store";

import { useRef, useState } from "react";
import Link from "next/link";
import { DashboardPreviewShell as DashboardShell } from "../team/dashboard-preview-shell";
import { AuthNotice } from "../../../../packages/ui/auth/auth-fields";
import { FollowThroughForm } from "../../../../packages/ui/renewals/follow-through-form";
import type { FollowThroughAction, FollowThroughCommand } from "../../../../packages/ui/renewals/follow-through-contracts";
import { completeCycle, setBilling, setBlocker } from "../../../../packages/contracts/renewals";
import { resolveDecisionQuestion } from "../../../../packages/contracts/decisions";
import type { DecisionFailure } from "../../../../packages/ui/decisions/contracts";
import { useClientPreview } from "../clients/client-preview-store";
import { previewToday, refreshPreviewRecord } from "./renewal-fixtures";

type Scenario = "normal" | "loading" | "error" | "read-only" | "session" | "mfa" | "stale" | "network" | "rate";
const sampleCycle = "40000000-0000-4000-8000-000000000005";
const sampleResponse = "60000000-0000-4000-8000-000000000001";
const fail = (code: string, message: string, retryAfterSeconds?: number): DecisionFailure => ({ status: "error", code, message, retryAfterSeconds });
function pause(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new Error("Aborted")); return; }
    const cancel = () => { clearTimeout(timer); reject(new Error("Aborted")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, 450);
    signal.addEventListener("abort", cancel, { once: true });
  });
}
export function FollowThroughPreview({ cycleId, responseId }: { cycleId: string; responseId?: string }) {
  const workspace = useTeamPreview().workspace;
  const store = useClientPreview();
  const latest = useRef(store); latest.current = store;
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [generation, setGeneration] = useState(0);
  const [activeMode, setActiveMode] = useState<FollowThroughCommand["operation"] | null>(null);
  const record = store.renewals.find(row => row.cycle.id === cycleId);
  const response = store.decisions.filter(row => row.cycleId === cycleId).flatMap(row => row.responses).find(row => row.id === responseId);
  const workspaceWritable = usePreviewWritable();
  const canWrite = workspaceWritable && !["read-only", "loading", "error", "session", "mfa"].includes(scenario);
  const defaultMode = responseId ? "resolve-question" : record?.cycle.state === "ready" ? record.cycle.blockedReason ? "clear-blocker" : "complete" : record?.allowedActions.includes("billing") ? "billing" : null;
  const mode = activeMode ?? defaultMode;
  function reset() { setActiveMode(null); setGeneration(value => value + 1); }
  const action: FollowThroughAction = async (command, signal) => {
    await pause(signal);
    if (scenario === "network") throw new Error("Synthetic connection failure");
    if (scenario === "rate") return fail("rate_limited", "Too many attempts. Wait before trying again.", 15);
    if (scenario === "stale") return fail("stale_version", "This record has changed. Return to its details and review the current version.");
    if (!canWrite) return fail("workspace_read_only", "This workspace is read-only.");
    const current = latest.current;
    const found = current.renewals.find(row => row.cycle.id === cycleId);
    if (!found) return fail("not_found", "This renewal is no longer available.");
    const { cycle, item } = found;
    if (command.input.expectedVersion !== cycle.version) return fail("stale_version", "The renewal changed. Review its current details.");
    const version = cycle.version + 1;
    if (command.operation === "resolve-question") {
      const parsed = resolveDecisionQuestion.safeParse(command.input);
      if (!parsed.success) return fail("invalid_input", "Use a plain-text resolution note between 1 and 1,000 characters.");
      const request = current.decisions.find(row => row.cycleId === cycleId && row.responses.some(answer => answer.id === command.responseId && answer.choice === "question"));
      const answer = request?.responses.find(row => row.id === command.responseId);
      if (!request || !answer) return fail("not_found", "This question is no longer available.");
      if (answer.resolution) return fail("question_resolved", "A resolution has already been recorded.");
      setActiveMode(command.operation);
      current.saveDecision({ ...request, responses: request.responses.map(row => row.id === answer.id ? { ...row, resolution: { note: parsed.data.note, createdAt: new Date().toISOString() } } : row) });
      current.saveRenewal(refreshPreviewRecord({ ...found, cycle: { ...cycle, version } }));
      current.appendHistory({ entityId: cycleId, event: "decision.question_resolved", details: { responseId: answer.id, requestId: request.id, note: parsed.data.note } });
      return { status: "success", version };
    }
    if (command.operation === "clear-blocker") {
      const parsed = setBlocker.safeParse(command.input);
      if (!parsed.success || parsed.data.blocked || cycle.closedAt || cycle.state !== "ready" || !cycle.blockedReason || !found.allowedActions.includes("blocker")) return fail("invalid_transition", "An active provider blocker and a reason for clearing it are required.");
      setActiveMode(command.operation);
      current.saveRenewal(refreshPreviewRecord({ ...found, cycle: { ...cycle, blockedReason: null, version } }));
      current.appendHistory({ entityId: cycleId, event: "cycle.unblocked", details: { reason: parsed.data.reason, previous: cycle.blockedReason } });
      return { status: "success", version };
    }
    if (command.operation === "billing") {
      const parsed = setBilling.safeParse(command.input);
      if (!parsed.success) return fail("invalid_input", "Check the invoice status and optional reference.");
      if (!found.allowedActions.includes("billing") || !["renewed", "cancelled"].includes(cycle.state) || cycle.payer !== "agency" || !cycle.rebillable) return fail("invalid_transition", "Invoice tracking is only available for completed agency-paid, rebillable services.");
      setActiveMode(command.operation);
      current.saveRenewal(refreshPreviewRecord({ ...found, cycle: { ...cycle, billingStatus: parsed.data.status, invoiceReference: parsed.data.invoiceReference ?? null, version } }));
      current.appendHistory({ entityId: cycleId, event: "cycle.billing_changed", details: { from: cycle.billingStatus, to: parsed.data.status } });
      return { status: "success", version };
    }
    const parsed = completeCycle.safeParse(command.input);
    if (!parsed.success) return fail("invalid_input", "Check the outcome, date, evidence and next term.");
    const input = parsed.data;
    if (!found.allowedActions.includes("complete") || cycle.state !== "ready" || cycle.closedAt || cycle.blockedReason || (input.outcome === "renewed") !== (cycle.intendedAction === "renew")) return fail("invalid_transition", "The ready instruction must match the outcome and have no active blocker.");
    if (input.performedOn > previewToday(cycle.timezone)) return fail("invalid_transition", "The provider action date cannot be in the future.");
    const needsNext = input.outcome === "renewed" && item.recurrence !== "once";
    if (needsNext !== !!input.next) return fail("invalid_transition", needsNext ? "Confirm the next term dates." : "This outcome cannot create a next cycle.");
    if (input.next && (input.next.expiryOn <= cycle.expiryOn || input.next.expiryOn <= input.performedOn)) return fail("invalid_transition", "Next expiry must follow this term and the provider action date.");
    if (current.renewals.some(row => row.cycle.itemId === item.id && row.cycle.sequence === cycle.sequence + 1)) return fail("invalid_transition", "A next cycle already exists. Reload this record before continuing.");
    const successorId = input.next ? crypto.randomUUID() : null;
    setActiveMode(command.operation);
    current.saveRenewal(refreshPreviewRecord({ ...found, cycle: { ...cycle, version, state: input.outcome, closedAt: new Date().toISOString(), performedOn: input.performedOn, providerReference: input.providerReference ?? null, outcomeNote: input.note ?? null, billingStatus: cycle.payer === "agency" && cycle.rebillable ? "to_invoice" : "not_applicable" } }));
    if (input.next && successorId) current.saveRenewal(refreshPreviewRecord({ item: { ...item }, cycle: { ...cycle, ...input.next, id: successorId, sequence: cycle.sequence + 1, version: 1, operatorId: item.operatorId, state: "open", nextActionOn: input.next.respondBy ?? input.next.noticeBy ?? input.next.expiryOn, intendedAction: null, blockedReason: null, closedAt: null, performedOn: null, providerReference: null, outcomeNote: null, billingStatus: "not_applicable", invoiceReference: null }, allowedActions: [] }));
    current.appendHistory({ entityId: cycleId, event: `cycle.${input.outcome}`, details: { performedOn: input.performedOn, successorId, billingStatus: cycle.payer === "agency" && cycle.rebillable ? "to_invoice" : "not_applicable" } });
    if (successorId) current.appendHistory({ entityId: successorId, event: "cycle.successor_created", details: { previousCycleId: cycleId } });
    return { status: "success", version, successorId };
  };
  const trusted = !["session", "mfa", "loading", "error"].includes(scenario);
  return <><DashboardShell workspace={trusted ? workspace : null} preview clientsHref="/clients">
    {scenario === "loading" ? <div className="rr-clients__loading" role="status">Loading follow-through details…</div> : scenario === "error" ? <div className="rr-clients__loading"><h1>The record couldn’t load</h1><button className="rr-dashboard__primary" onClick={() => setScenario("normal")}>Try again</button></div> : scenario === "session" || scenario === "mfa" ? <div className="rr-clients__loading"><h1>{scenario === "mfa" ? "Verify your sign-in" : "Log in to continue"}</h1><Link className="rr-dashboard__primary" href={scenario === "mfa" ? "/two-factor" : "/login"}>Continue</Link></div> : !record || responseId && !response ? <div className="rr-clients__loading"><h1>Record isn’t available</h1><p>Load the samples below, or open a record from the renewal list.</p><Link className="rr-dashboard__primary" href="/renewals">All renewals</Link></div> : <>
      {!canWrite && <AuthNotice>Read-only workspace. You can review the record; updates are unavailable.</AuthNotice>}
      {mode ? <FollowThroughForm key={`${cycleId}-${responseId ?? "outcome"}-${mode}-${generation}`} mode={mode} record={record} response={response} today={previewToday(record.cycle.timezone)} canWrite={canWrite} clientName={store.clients.find(client => client.id === record.item.clientId)?.name} action={action} preview onContinue={reset} /> : <><Link className="rr-clients__back" href={`/renewals/${cycleId}`}>Back to renewal</Link><div className="rr-dashboard__page-heading"><h1>Follow-through</h1><p>{record.cycle.service}</p></div><section className="rr-follow__status"><h2>{record.cycle.closedAt ? "No agency invoice update is available" : "Record an instruction first"}</h2><p>{record.cycle.closedAt ? "Invoice tracking is available for renewed or cancelled agency-paid, rebillable services. This record doesn’t meet those conditions." : "The cycle needs a recorded client instruction and ready status before its provider outcome can be recorded."}</p><Link className="rr-clients__outline-action" href={`/renewals/${cycleId}/responses`}>View client responses</Link></section></>}
    </>}
  </DashboardShell><details className="rr-auth__review"><summary>Local preview tools</summary><p>Synthetic in-memory records only. No backend, provider, invoice, payment or email operation occurs. Loading samples replaces the current preview data.</p><div className="rr-auth__review-controls"><label htmlFor="follow-through-scenario">Screen state<select id="follow-through-scenario" value={scenario} onChange={event => { setScenario(event.target.value as Scenario); reset(); }}>{["normal", "loading", "error", "read-only", "session", "mfa", "stale", "network", "rate"].map(value => <option key={value}>{value}</option>)}</select></label><button className="rr-clients__outline-action" onClick={() => { store.loadFollowThroughSamples(); setScenario("normal"); reset(); }}>Load follow-through samples</button></div><nav aria-label="Follow-through preview navigation"><Link href={`/renewals/${sampleCycle}/follow-through`}>Ready to renew</Link><Link href="/renewals/40000000-0000-4000-8000-000000000006/follow-through">Ready to cancel</Link><Link href="/renewals/40000000-0000-4000-8000-000000000003/follow-through">Blocked service</Link><Link href="/renewals/40000000-0000-4000-8000-000000000007/follow-through">Agency invoice</Link><Link href={`/renewals/40000000-0000-4000-8000-000000000001/responses/${sampleResponse}/resolve`}>Client question</Link></nav></details></>;
}
