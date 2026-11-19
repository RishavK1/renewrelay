"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { issueDecision } from "../../contracts/decisions";
import type { ContactView } from "../clients/contracts";
import type { RenewalDetailRecord } from "../renewals/contracts";
import { renewalDate } from "../renewals/renewal-views";
import { displayMoney } from "../renewals/money";
import { AuthNotice } from "../auth/auth-fields";
import { NativeSelect } from "../primitives/native-select";
import type { DecisionResponseRow, IssueAction } from "./contracts";
import { useDecisionAction } from "./use-preview-action";

export function DecisionRequestForm({ record, contacts, canIssue, action, preview = false }: { record: RenewalDetailRecord; contacts: ContactView[]; canIssue: boolean; action: IssueAction; preview?: boolean }) {
  const [contactId, setContactId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ requestId: string; revision: number } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const state = useDecisionAction(action);
  const { cycle } = record;
  const active = contacts.filter(contact => contact.clientId === record.item.clientId && !contact.archivedAt);
  const blocked = !canIssue || !!state.failure && ["stale_version", "invalid_transition", "unresolved_questions", "forbidden", "unauthenticated", "mfa_required", "workspace_read_only", "workspace_deleting", "not_found", "email_unverified", "idempotency_conflict"].includes(state.failure.code);
  const locked = state.pending || !!state.frozen || blocked;
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [created]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (blocked || state.pending) return;
    const result = issueDecision.safeParse({ contactId, expectedVersion: cycle.version, ...(note.trim() ? { customerNote: note } : {}) });
    if (!result.success || !active.some(contact => contact.id === contactId)) { setError("Choose an active contact and keep your note within 1,000 characters."); (form.current?.elements.namedItem("contactId") as HTMLElement | null)?.focus(); return; }
    setError(""); const response = await state.run(result.data);
    if (response?.status === "success") setCreated(response);
  }
  return <div className="rr-decision-staff">
    <Link className="rr-clients__back" href={`/renewals/${cycle.id}`}>Back to renewal</Link>
    <div className="rr-dashboard__page-heading"><h1 ref={heading} tabIndex={-1}>{created ? preview ? "Request preview ready" : "Request queued" : "Request a client decision"}</h1><p>{created ? "Queued is a delivery state, not confirmation that an email was delivered." : "Review the terms and choose who should respond."}</p></div>
    {created ? <><AuthNotice>{preview ? "No email or reminder was sent. This is a local request preview." : "The request has been queued for delivery."}</AuthNotice><p className="rr-decision-staff__revision">Revision {created.revision}</p><div className="rr-decision-staff__links">{preview && <Link className="rr-dashboard__primary" href={`/decision-preview?request=${created.requestId}`}>Open client preview</Link>}<Link className="rr-clients__outline-action" href={`/renewals/${cycle.id}/responses`}>View responses</Link></div></> : <>
      {!canIssue && <AuthNotice error>This renewal isn’t eligible for a new decision request. It needs an active cycle, current response date, quote and term, and the required workspace access.</AuthNotice>}
      {!active.length && <AuthNotice error>Add an active contact for this client first. <Link className="rr-auth__notice-link" href={`/clients/${record.item.clientId}`}>Open client contacts</Link></AuthNotice>}
      <section className="rr-decision-staff__terms"><h2>Terms the client will see</h2><dl><div><dt>Service</dt><dd>{cycle.service}</dd></div><div><dt>Client quote</dt><dd>{displayMoney(cycle.clientQuoteMinor, cycle.currency)}</dd></div><div><dt>Term</dt><dd>{cycle.term ?? "Not recorded"}</dd></div><div><dt>Respond by</dt><dd>{renewalDate(cycle.respondBy)} · {cycle.timezone}</dd></div><div><dt>Expiry / provider notice</dt><dd>{renewalDate(cycle.expiryOn)} / {renewalDate(cycle.noticeBy)}</dd></div></dl></section>
      <form ref={form} onSubmit={submit} noValidate className="rr-decision-staff__form" aria-busy={state.pending}>
        <div className="rr-auth__field"><div className="rr-auth__label-row"><label htmlFor="decision-contact">Client contact</label></div><NativeSelect id="decision-contact" name="contactId" value={contactId} disabled={locked || !active.length} onChange={event => { setContactId(event.target.value); setError(""); state.clearFailure(); }} aria-invalid={error ? true : undefined} aria-describedby={error ? "decision-issue-error" : undefined}><option value="" disabled>Choose a contact</option>{active.map(contact => <option key={contact.id} value={contact.id}>{contact.name} — {contact.email}</option>)}</NativeSelect></div>
        <div className="rr-auth__field"><div className="rr-auth__label-row"><label htmlFor="decision-note">Note to client (optional)</label></div><textarea id="decision-note" value={note} maxLength={1000} readOnly={locked} rows={4} onChange={event => setNote(event.target.value)} placeholder="Add context for this renewal." /></div>
        <p className="rr-decision-staff__hint">Creating a new revision replaces access to previous requests for this renewal. Client approval still requires your team’s provider follow-through.</p>
        {error && <p id="decision-issue-error" className="rr-auth__field-error" role="alert">{error}</p>}
        {state.failure && <AuthNotice error>{state.failure.message}{state.frozen && <p>The original request is held for retry. Its contact, note and version remain unchanged.</p>}</AuthNotice>}
        <button className="rr-dashboard__primary" type="submit" disabled={state.pending || blocked || !active.length || state.remaining > 0}>{state.pending ? "Creating…" : state.remaining > 0 ? `Try again in ${state.remaining}s` : state.frozen ? "Retry original request" : preview ? "Create request preview" : "Queue decision request"}</button>
      </form>
    </>}
  </div>;
}

export function StaffDecisionResponses({ cycleId, responses, nextCursor, onLoadMore, canResolve = false }: { cycleId: string; responses: DecisionResponseRow[]; nextCursor?: string | null; onLoadMore?: () => void; canResolve?: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [cycleId]);
  return <><Link className="rr-clients__back" href={`/renewals/${cycleId}`}>Back to renewal</Link><div className="rr-dashboard__page-heading"><h1 ref={heading} tabIndex={-1}>Client responses</h1><p>Client instructions and questions, separate from provider completion.</p></div>
    {!responses.length ? <section className="rr-dashboard__state rr-dashboard__state--compact"><h2>No responses loaded</h2><p>Responses will appear here after the client verifies their email and responds.</p></section> : <ul className="rr-decision-responses">{responses.map(response => <li key={response.id}><div className="rr-decision-responses__heading"><h2>{response.choice === "approve" ? "Renewal approved" : response.choice === "cancel" ? "Client instructed: do not renew" : "Client question"}</h2><span>Revision {response.request.revision}</span></div><p className="rr-decision-responses__meta">{response.request.recipientEmail} <span>·</span> <time dateTime={response.createdAt}>{response.createdAt.replace("T", " ").replace(/\.\d+Z$/, " UTC")}</time></p>
      <dl><div><dt>Quoted service</dt><dd>{response.request.service}</dd></div><div><dt>Frozen quote</dt><dd>{displayMoney(response.request.amountMinor, response.request.currency)}</dd></div><div><dt>Term</dt><dd>{response.request.term}</dd></div><div><dt>Response deadline</dt><dd>{renewalDate(response.request.respondBy)}</dd></div></dl>
      {response.question && <blockquote>{response.question}</blockquote>}
      <p className="rr-decision-responses__note">{response.choice === "question" ? response.resolution ? `Resolution recorded: ${response.resolution.note}` : "Unresolved question. Follow-up is required; this is not a final client decision." : "Instruction recorded. Provider renewal/cancellation and agency invoicing are separate actions."}</p>
      {response.choice === "question" && !response.resolution && canResolve && <Link className="rr-clients__outline-action" href={`/renewals/${cycleId}/responses/${response.id}/resolve`}>Record resolution</Link>}
    </li>)}</ul>}
    {nextCursor && <button className="rr-clients__outline-action" type="button" onClick={onLoadMore} disabled={!onLoadMore}>Load more responses</button>}
  </>;
}
