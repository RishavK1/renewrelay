"use client";
import { useTeamPreview } from "../team/team-preview-store";
import { usePreviewWritable } from "../settings/settings-preview-store";

import { useRef, useState } from "react";
import Link from "next/link";
import { DashboardPreviewShell as DashboardShell } from "../team/dashboard-preview-shell";
import { AuthNotice } from "../../../../packages/ui/auth/auth-fields";
import { DecisionRequestForm, StaffDecisionResponses } from "../../../../packages/ui/decisions/staff-views";
import { ClientDecision } from "../../../../packages/ui/decisions/client-decision";
import { sessionResponse, type DecisionFailure, type DecisionPreviewRecord, type DecisionTerms, type IssueAction, type PublicDecisionAction } from "../../../../packages/ui/decisions/contracts";
import { issueDecision } from "../../../../packages/contracts/decisions";
import { useClientPreview } from "../clients/client-preview-store";
import { previewToday, refreshPreviewRecord } from "../renewals/renewal-fixtures";

const sampleCycle = "40000000-0000-4000-8000-000000000001";
const fail = (code: string, message: string, retryAfterSeconds?: number): DecisionFailure => ({ status: "error", code, message, retryAfterSeconds });
function pause(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new Error("Aborted")); return; }
    const cancel = () => { clearTimeout(timer); reject(new Error("Aborted")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, 450);
    signal.addEventListener("abort", cancel, { once: true });
  });
}
type StaffScenario = "normal" | "loading" | "error" | "read-only" | "session" | "mfa" | "network" | "rate" | "stale" | "unresolved";
export function StaffDecisionPreview({ cycleId, view }: { cycleId: string; view: "issue" | "responses" }) {
  const workspace = useTeamPreview().workspace;
  const store = useClientPreview();
  const [scenario, setScenario] = useState<StaffScenario>("normal");
  const [generation, setGeneration] = useState(0);
  const latest = useRef(store); latest.current = store;
  const record = store.renewals.find(row => row.cycle.id === cycleId);
  const decisions = store.decisions.filter(row => row.cycleId === cycleId);
  const responses = decisions.flatMap(row => row.responses).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const unresolved = responses.some(response => response.choice === "question" && !response.resolution);
  const workspaceWritable = usePreviewWritable();
  const canWrite = workspaceWritable && !["read-only", "session", "mfa", "loading", "error"].includes(scenario);
  const action: IssueAction = async (input, signal) => {
    await pause(signal);
    if (scenario === "network") throw new Error("Synthetic connection failure");
    if (scenario === "rate") return fail("rate_limited", "Too many request attempts. Wait before trying again.", 15);
    if (scenario === "stale") return fail("stale_version", "This renewal has changed. Return to its details and review the current terms.");
    if (scenario === "unresolved") return fail("unresolved_questions", "Resolve the existing client questions before creating a new request.");
    if (!canWrite) return fail("workspace_read_only", "This workspace is read-only.");
    const current = latest.current;
    const renewal = current.renewals.find(row => row.cycle.id === cycleId);
    const parsed = issueDecision.safeParse(input);
    if (!parsed.success) return fail("invalid_input", "Choose a contact and check your note.");
    if (!renewal || renewal.cycle.version !== input.expectedVersion) return fail("stale_version", "This renewal has changed. Review it before creating a request.");
    if (!renewal.allowedActions.includes("issue")) return fail("invalid_transition", "This renewal needs a current response date, quote and term.");
    if (current.decisions.some(row => row.cycleId === cycleId && row.responses.some(response => response.choice === "question" && !response.resolution))) return fail("unresolved_questions", "An unresolved client question needs follow-up before a new request.");
    const contact = current.contacts.find(row => row.id === input.contactId && row.clientId === renewal.item.clientId && !row.archivedAt);
    if (!contact) return fail("not_found", "That active contact is no longer available. Choose another contact.");
    const cycle = renewal.cycle;
    if (cycle.clientQuoteMinor === null || !cycle.term || !cycle.respondBy || cycle.respondBy < previewToday(cycle.timezone)) return fail("invalid_transition", "Review the renewal’s response date, quote and term.");
    const id = crypto.randomUUID(), revision = Math.max(0, ...current.decisions.filter(row => row.cycleId === cycleId).map(row => row.terms.revision)) + 1;
    const version = cycle.version + 1;
    const terms: DecisionTerms = { requestId: id, revision, issuer: workspace.name, service: cycle.service, currency: cycle.currency, amountMinor: cycle.clientQuoteMinor, term: cycle.term, respondBy: cycle.respondBy, timezone: cycle.timezone, expiryOn: cycle.expiryOn, noticeBy: cycle.noticeBy, note: parsed.data.customerNote ?? null, version, decided: false };
    current.saveDecision({ id, cycleId, contactId: contact.id, recipientEmail: contact.email, superseded: false, terms, responses: [] });
    current.saveRenewal(refreshPreviewRecord({ ...renewal, cycle: { ...cycle, version, state: "open", intendedAction: null, nextActionOn: cycle.respondBy } }));
    current.appendHistory({ entityId: cycleId, event: "decision.issued", details: { requestId: id, revision } });
    return { status: "success", requestId: id, revision, version, queued: true };
  };
  return <><DashboardShell workspace={["session", "mfa"].includes(scenario) ? null : workspace} clientsHref="/clients" preview>
    {scenario === "loading" ? <div className="rr-clients__loading" role="status">Loading decision request…</div> : scenario === "error" ? <div className="rr-clients__loading"><h1>Decision details couldn’t load</h1><button className="rr-dashboard__primary" onClick={() => setScenario("normal")}>Try again</button></div> : scenario === "session" || scenario === "mfa" ? <div className="rr-clients__loading"><h1>{scenario === "mfa" ? "Verify your sign-in" : "Log in to continue"}</h1><Link className="rr-dashboard__primary" href={scenario === "mfa" ? "/two-factor" : "/login"}>Continue</Link></div> : !record ? <div className="rr-clients__loading"><h1>Renewal isn’t available</h1><p>Load a sample below, or open a renewal from your current preview.</p><Link className="rr-dashboard__primary" href="/renewals">All renewals</Link></div> : <>
      {scenario === "read-only" && <AuthNotice>Read-only workspace. You can review responses; creating requests is unavailable.</AuthNotice>}
      {view === "issue" ? <DecisionRequestForm key={`${cycleId}-${generation}`} record={record} contacts={store.contacts} canIssue={canWrite && record.allowedActions.includes("issue") && !unresolved} action={action} preview /> : <><StaffDecisionResponses cycleId={cycleId} responses={responses} canResolve={canWrite} />{unresolved && <AuthNotice>Record a resolution for the client’s questions before requesting a new decision.</AuthNotice>}<div className="rr-dashboard__actions rr-dashboard__actions--start"><Link className="rr-clients__outline-action" href={`/renewals/${cycleId}/follow-through`}>View follow-through</Link>{canWrite && !unresolved && record.allowedActions.includes("issue") && <Link className="rr-clients__outline-action" href={`/renewals/${cycleId}/request`}>Request a decision</Link>}</div>{decisions.filter(row => !row.superseded && !store.revokedDecisionIds.includes(row.id)).map(row => <p key={row.id}><Link className="rr-auth__notice-link" href={`/decision-preview?request=${row.id}`}>Open client preview · revision {row.terms.revision}</Link></p>)}</>}
    </>}
  </DashboardShell><details className="rr-auth__review"><summary>Local preview tools</summary><p>In-memory sample data only. No requests, codes, emails, provider actions or payments are sent.</p><div className="rr-auth__review-controls"><label htmlFor="decision-staff-scenario">Screen state<select id="decision-staff-scenario" value={scenario} onChange={event => { setScenario(event.target.value as StaffScenario); setGeneration(value => value + 1); }}>{["normal", "loading", "error", "read-only", "session", "mfa", "network", "rate", "stale", "unresolved"].map(value => <option key={value}>{value}</option>)}</select></label><button className="rr-clients__outline-action" onClick={() => { store.loadDecisionSamples(); setScenario("normal"); setGeneration(value => value + 1); }}>Load decision samples</button><Link href={`/renewals/${sampleCycle}/request`}>Open sample request form</Link></div></details></>;
}

type PublicScenario = "normal" | "loading" | "error" | "unavailable" | "invalid-code" | "otp-required" | "rate" | "network" | "stale" | "suppressed";
export function PublicDecisionPreview({ requestId }: { requestId?: string }) {
  const store = useClientPreview();
  const [scenario, setScenario] = useState<PublicScenario>("normal");
  const [generation, setGeneration] = useState(0);
  const verified = useRef(false);
  const latest = useRef(store); latest.current = store;
  const selected = store.decisions.find(row => row.id === requestId);
  const contact = store.contacts.find(row => row.id === selected?.contactId);
  const renewal = store.renewals.find(row => row.cycle.id === selected?.cycleId);
  const unavailable = !selected || selected.superseded || store.revokedDecisionIds.includes(selected.id) || !contact || !!contact.archivedAt || contact.email !== selected.recipientEmail || !renewal || !!renewal.cycle.closedAt || selected.terms.respondBy < previewToday(renewal.cycle.timezone) || scenario === "unavailable";
  // Deliberate public projection: never pass the contact, internal cycle or request record.
  const terms: DecisionTerms | null = selected && renewal ? { requestId: selected.id, revision: selected.terms.revision, issuer: selected.terms.issuer, service: selected.terms.service, currency: selected.terms.currency, amountMinor: selected.terms.amountMinor, term: selected.terms.term, respondBy: selected.terms.respondBy, timezone: selected.terms.timezone, expiryOn: selected.terms.expiryOn, noticeBy: selected.terms.noticeBy, note: selected.terms.note, version: renewal.cycle.version, decided: selected.terms.decided } : null;
  const action: PublicDecisionAction = async (command, signal) => {
    await pause(signal);
    if (scenario === "network") throw new Error("Synthetic connection failure");
    if (scenario === "rate") return fail("rate_limited", "Too many attempts. Wait before trying again.", 15);
    const current = latest.current;
    const request = current.decisions.find(row => row.id === requestId);
    const cycleRecord = current.renewals.find(row => row.cycle.id === request?.cycleId);
    const recipient = current.contacts.find(row => row.id === request?.contactId);
    if (!request || request.superseded || current.revokedDecisionIds.includes(request.id) || !cycleRecord || cycleRecord.cycle.closedAt || !recipient || recipient.archivedAt || recipient.email !== request.recipientEmail || request.terms.respondBy < previewToday(cycleRecord.cycle.timezone)) return fail("decision_unavailable", "This request is unavailable. Open the latest request or contact the team that sent it.");
    if (request.terms.decided) return fail("already_decided", "A final response has already been recorded.");
    if (command.operation === "start-code") {
      if (scenario === "suppressed") return fail("recipient_suppressed", "The email address needs attention. Ask the team that sent this request to update it.");
      verified.current = false; return { status: "success", kind: "code-started" };
    }
    if (command.operation === "verify-code") {
      if (scenario === "invalid-code" || !/^\d{6}$/.test(command.code)) return fail("invalid_code", "That code wasn’t accepted. Check the latest code and try again.");
      verified.current = true; return { status: "success", kind: "verified" };
    }
    if (!verified.current || scenario === "otp-required") { verified.current = false; return fail("otp_required", "Verification has expired. Request a new code and verify again."); }
    if (scenario === "stale" || command.input.expectedVersion !== cycleRecord.cycle.version) return fail("stale_version", "The request has changed. Reopen it and review the current terms before responding.");
    const parsed = sessionResponse.safeParse(command.input);
    if (!parsed.success) return fail("invalid_input", "Check your response and question text.");
    const { choice, question } = parsed.data;
    const id = crypto.randomUUID(), final = choice !== "question", version = cycleRecord.cycle.version + (final ? 1 : 0);
    const updated: DecisionPreviewRecord = { ...request, terms: { ...request.terms, decided: final }, responses: [...request.responses, { id, choice, question: question ?? null, createdAt: new Date().toISOString(), request: { id: request.id, revision: request.terms.revision, recipientEmail: request.recipientEmail, service: request.terms.service, currency: request.terms.currency, amountMinor: request.terms.amountMinor, term: request.terms.term, respondBy: request.terms.respondBy, customerNote: request.terms.note }, resolution: null }] };
    current.saveDecision(updated);
    if (final) current.saveRenewal(refreshPreviewRecord({ ...cycleRecord, cycle: { ...cycleRecord.cycle, state: "ready", intendedAction: choice === "approve" ? "renew" : "cancel", nextActionOn: cycleRecord.cycle.noticeBy ?? cycleRecord.cycle.expiryOn, version } }));
    current.appendHistory({ entityId: request.cycleId, event: choice === "question" ? "decision.question" : "decision.responded", actorId: request.contactId, details: { actorKind: "client_contact", requestId: request.id, revision: request.terms.revision, responseId: id, choice } });
    return { status: "success", kind: "responded", response: { id, choice, version } };
  };
  return <>{unavailable || !terms || scenario === "loading" || scenario === "error" ? <div className="rr-client-decision"><header className="rr-client-decision__header"><span className="rr-client-decision__brand">RenewRelay</span><span className="rr-client-decision__preview">UI preview</span></header><main id="main-content" className="rr-client-decision__main"><h1>{scenario === "loading" ? "Loading your request…" : scenario === "error" ? "Your request couldn’t load" : "This request isn’t available"}</h1>{scenario === "loading" ? <p role="status">Loading renewal terms…</p> : scenario === "error" ? <><p>Check your connection and try again.</p><button className="rr-decision__primary" type="button" onClick={() => setScenario("normal")}>Try again</button></> : <p>Open the latest request from your email, or contact the team that sent it.</p>}</main></div> : <ClientDecision key={`${selected?.id}-${generation}`} terms={terms} action={action} preview />}
    <details className="rr-auth__review"><summary>Local preview tools</summary><p>Verification and responses use synthetic in-memory state. Any six digits work in the normal state. Nothing is sent or saved to the backend.</p><label htmlFor="decision-public-scenario">Screen state<select id="decision-public-scenario" value={scenario} onChange={event => { verified.current = false; setScenario(event.target.value as PublicScenario); setGeneration(value => value + 1); }}>{["normal", "loading", "error", "unavailable", "invalid-code", "otp-required", "rate", "network", "stale", "suppressed"].map(value => <option key={value}>{value}</option>)}</select></label>{selected && <Link href={`/renewals/${selected.cycleId}/responses`}>Staff responses</Link>}<Link href={`/renewals/${sampleCycle}/request`}>Staff request form</Link></details>
  </>;
}
