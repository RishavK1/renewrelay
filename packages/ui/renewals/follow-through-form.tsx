"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { completeCycle, setBilling, setBlocker } from "../../contracts/renewals";
import { resolveDecisionQuestion } from "../../contracts/decisions";
import { AuthField, AuthNotice, AuthSuccessMark } from "../auth/auth-fields";
import { NativeSelect } from "../primitives/native-select";
import { useDecisionAction } from "../decisions/use-preview-action";
import type { DecisionResponseRow } from "../decisions/contracts";
import type { RenewalDetailRecord } from "./contracts";
import type { FollowThroughAction, FollowThroughCommand, FollowThroughResult } from "./follow-through-contracts";
import { renewalDate } from "./renewal-views";
import { displayMoney } from "./money";

type Mode = FollowThroughCommand["operation"];
type Props = { mode: Mode; record: RenewalDetailRecord; response?: DecisionResponseRow; canWrite: boolean; today: string; action: FollowThroughAction; preview?: boolean; clientName?: string; onContinue?: () => void };
const titles: Record<Mode, string> = { complete: "Record provider outcome", billing: "Track agency invoicing", "clear-blocker": "Clear provider blocker", "resolve-question": "Resolve client question" };
const invoiceLabels = { not_applicable: "Not applicable", to_invoice: "To invoice", invoiced: "Invoiced" };

function NoteField({ id, label, value, onChange, locked, error, hint, maxLength = 1000 }: { id: string; label: string; value: string; onChange: (value: string) => void; locked: boolean; error?: string; hint?: string; maxLength?: number }) {
  return <div className="rr-auth__field"><div className="rr-auth__label-row"><label htmlFor={id}>{label}</label></div><textarea id={id} name={id} value={value} rows={4} maxLength={maxLength} readOnly={locked} onChange={event => onChange(event.target.value)} aria-invalid={!!error} aria-describedby={[error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined} />{hint && <p className="rr-auth__hint" id={`${id}-hint`}>{hint}</p>}{error && <p className="rr-auth__field-error" id={`${id}-error`}>{error}</p>}</div>;
}
function ReviewList({ values }: { values: Record<string, ReactNode> }) { return <dl className="rr-follow__review-list">{Object.entries(values).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>; }
function CommandReview({ command, record }: { command: FollowThroughCommand; record: RenewalDetailRecord }) {
  if (command.operation === "resolve-question") return <ReviewList values={{ "Resolution note": command.input.note, "Client instruction": "Unchanged", "Client email": "No message will be sent by this action" }} />;
  if (command.operation === "clear-blocker") return <ReviewList values={{ "Current blocker": record.cycle.blockedReason, "Reason for clearing": command.input.reason, "Provider outcome": "Not recorded by clearing this blocker" }} />;
  if (command.operation === "billing") return <ReviewList values={{ "Invoice status": invoiceLabels[command.input.status], "Invoice reference": command.input.invoiceReference ?? "Not recorded", "Reference replacement": "This save replaces the previously recorded invoice reference.", "Invoice creation": "Handled separately in your invoicing system" }} />;
  const input = command.input;
  return <ReviewList values={{ "Provider outcome": input.outcome === "renewed" ? "Renewed" : "Cancelled", "Performed on": renewalDate(input.performedOn), "Provider reference": input.providerReference ?? "Not recorded", "Outcome note": input.note ?? "Not recorded", "Agency invoice status after recording": record.cycle.payer === "agency" && record.cycle.rebillable ? "To invoice" : "Not applicable", ...(input.next ? { "Next expiry": renewalDate(input.next.expiryOn), "Next provider notice": renewalDate(input.next.noticeBy), "Next client response": renewalDate(input.next.respondBy), "Next cycle": "One open cycle for the same item" } : { "Next cycle": "None" }) }} />;
}

export function FollowThroughForm({ mode, record, response, canWrite, today, action, preview = false, clientName, onContinue }: Props) {
  const { cycle, item } = record;
  const [performedOn, setPerformedOn] = useState(today);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState(cycle.billingStatus);
  const [invoiceReference, setInvoiceReference] = useState(cycle.invoiceReference ?? "");
  const [expiryOn, setExpiryOn] = useState(record.suggestedNext?.expiryOn ?? "");
  const [noticeBy, setNoticeBy] = useState(record.suggestedNext?.noticeBy ?? "");
  const [respondBy, setRespondBy] = useState(record.suggestedNext?.respondBy ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reviewed, setReviewed] = useState<FollowThroughCommand | null>(null);
  const [saved, setSaved] = useState<Extract<FollowThroughResult, { status: "success" }> | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const state = useDecisionAction(action);
  const eligible = mode === "resolve-question" ? response?.choice === "question" && !response.resolution : mode === "clear-blocker" ? !cycle.closedAt && cycle.state === "ready" && !!cycle.blockedReason && record.allowedActions.includes("blocker") : mode === "billing" ? ["renewed", "cancelled"].includes(cycle.state) && cycle.payer === "agency" && cycle.rebillable && record.allowedActions.includes("billing") : !cycle.closedAt && cycle.state === "ready" && !cycle.blockedReason && !!cycle.intendedAction && record.allowedActions.includes("complete");
  const conflict = !!reviewed && reviewed.input.expectedVersion !== cycle.version && !state.frozen;
  const rejected = !!state.failure && ["stale_version", "invalid_transition", "question_resolved", "not_found", "forbidden", "unauthenticated", "mfa_required", "workspace_read_only", "workspace_deleting", "idempotency_conflict"].includes(state.failure.code);
  const locked = state.pending || !!state.frozen;
  const forbidden = !canWrite || !eligible || rejected;
  const needsNext = mode === "complete" && cycle.intendedAction === "renew" && item.recurrence !== "once";
  const back = mode === "resolve-question" ? `/renewals/${cycle.id}/responses` : `/renewals/${cycle.id}`;
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [mode, reviewed, saved]);
  useEffect(() => { if (Object.keys(errors).length) errorSummary.current?.focus(); }, [errors]);
  function review(event: FormEvent) {
    event.preventDefault(); if (forbidden || locked) return;
    let command: FollowThroughCommand;
    const version = cycle.version;
    const parsed = mode === "complete" ? completeCycle.safeParse({ expectedVersion: version, outcome: cycle.intendedAction === "renew" ? "renewed" : "cancelled", performedOn, ...(reference.trim() ? { providerReference: reference } : {}), ...(note.trim() ? { note } : {}), ...(needsNext ? { next: { expiryOn, noticeBy: noticeBy || null, respondBy: respondBy || null } } : {}) }) : mode === "billing" ? setBilling.safeParse({ expectedVersion: version, status: invoiceStatus, ...(invoiceStatus === "invoiced" && invoiceReference.trim() ? { invoiceReference } : {}) }) : mode === "clear-blocker" ? setBlocker.safeParse({ expectedVersion: version, blocked: false, reason: note }) : resolveDecisionQuestion.safeParse({ expectedVersion: version, note });
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) { const field = issue.path.join(".") || "form"; fields[field] ??= issue.message; }
      setErrors(fields); return;
    }
    // Each branch parses its exact backend schema, preserving discriminated payloads.
    if (mode === "complete") {
      const result = completeCycle.parse(parsed.data);
      if (result.performedOn > today) { setErrors({ performedOn: "The action date cannot be in the future." }); return; }
      if (result.next && (result.next.expiryOn <= cycle.expiryOn || result.next.expiryOn <= result.performedOn)) { setErrors({ "next.expiryOn": "Next expiry must follow this term’s expiry and the provider action date." }); return; }
      command = { operation: "complete", input: result };
    } else if (mode === "billing") command = { operation: "billing", input: setBilling.parse(parsed.data) };
    else if (mode === "clear-blocker") command = { operation: "clear-blocker", input: setBlocker.parse(parsed.data) };
    else if (response) command = { operation: "resolve-question", responseId: response.id, input: resolveDecisionQuestion.parse(parsed.data) };
    else return;
    setErrors({}); state.clearFailure(); setReviewed(command);
  }
  async function confirm() {
    if (!reviewed || forbidden || state.pending || conflict && !state.frozen) return;
    const result = await state.run(reviewed);
    if (result?.status === "success") setSaved(result);
  }
  return <div className="rr-follow"><Link className="rr-clients__back" href={back}>{mode === "resolve-question" ? "Back to responses" : "Back to renewal"}</Link>
    <div className="rr-dashboard__page-heading"><h1 ref={heading} tabIndex={-1}>{saved ? preview ? "Preview updated" : "Record updated" : reviewed ? "Review before recording" : titles[mode]}</h1><p>{clientName && <>{clientName} <span aria-hidden="true">/</span> </>}{cycle.service} <span aria-hidden="true">/</span> {cycle.provider}</p></div>
    {saved ? <section className="rr-follow__success"><AuthSuccessMark /><h2>{mode === "resolve-question" ? "Resolution recorded" : mode === "clear-blocker" ? "Blocker cleared" : mode === "billing" ? "Invoice tracking updated" : "Provider outcome recorded"}</h2><p>{preview ? "Only the temporary preview was updated. No backend record, provider action, invoice or email was created." : mode === "resolve-question" ? "The internal resolution is recorded. No answer was emailed by this action." : "The record reflects the work you entered. Provider operations and invoice creation are handled separately."}</p><div className="rr-follow__actions"><Link className="rr-dashboard__primary" href={mode === "resolve-question" ? `/renewals/${cycle.id}/responses` : `/renewals/${cycle.id}`}>View updated record</Link>{mode === "clear-blocker" && <button type="button" className="rr-clients__outline-action" onClick={onContinue} disabled={!onContinue}>Continue to provider outcome</button>}{saved.successorId && <Link className="rr-clients__outline-action" href={`/renewals/${saved.successorId}`}>View next cycle</Link>}{mode === "complete" && cycle.payer === "agency" && cycle.rebillable && <button className="rr-clients__outline-action" type="button" onClick={onContinue} disabled={!onContinue}>Review invoice tracking</button>}</div></section> : mode === "resolve-question" && response?.resolution ? <section className="rr-follow__panel"><h2>Resolution already recorded</h2><ReviewList values={{ Question: response.question, "Resolution note": response.resolution.note, "Recorded at (UTC)": response.resolution.createdAt.replace("T", " ").replace(/\.\d+Z$/, " UTC") }} /><p className="rr-follow__hint">This question can only be resolved once. The client instruction remains separate.</p><Link className="rr-clients__outline-action" href={back}>View client responses</Link></section> : <>
      <section className="rr-follow__context"><h2>{mode === "resolve-question" ? "Client question" : mode === "clear-blocker" ? "Recorded blocker" : mode === "billing" ? "Completed service" : "Recorded instruction"}</h2>{mode === "resolve-question" ? <><blockquote>{response?.question}</blockquote><p>Revision {response?.request.revision} · {response?.request.recipientEmail}</p></> : mode === "clear-blocker" ? <p>{cycle.blockedReason}</p> : mode === "billing" ? <ReviewList values={{ "Provider outcome": cycle.state === "renewed" ? "Renewed" : "Cancelled", "Performed on": renewalDate(cycle.performedOn), "Client quote": displayMoney(cycle.clientQuoteMinor, cycle.currency), "Current invoice status": invoiceLabels[cycle.billingStatus] }} /> : <><strong>{cycle.intendedAction === "renew" ? "Renew this service" : cycle.intendedAction === "cancel" ? "Do not renew this service" : "No instruction recorded"}</strong><p>Record the outcome only after the provider work is complete. This form does not contact or change the provider.</p></>}</section>
      {forbidden && <AuthNotice error>{!canWrite ? "This workspace is read-only. Changes are unavailable." : rejected ? "This action needs fresh record data or restored access. Return to the record before continuing." : "This action isn’t available for the current record. Return to its details to review the instruction, blocker or recorded resolution."}</AuthNotice>}
      {reviewed ? <section className="rr-follow__panel" aria-busy={state.pending}><h2>What will be recorded</h2><CommandReview command={reviewed} record={record} />{conflict && <AuthNotice error>The record changed while you were reviewing. Return to its details and review the current version.</AuthNotice>}<p className="rr-follow__hint">{mode === "complete" ? "Recording this outcome closes this cycle. Check the action date, evidence and next term carefully." : mode === "resolve-question" ? "This records an internal resolution. It doesn’t email the client or approve the renewal." : mode === "billing" ? "This replaces the recorded tracking status and reference. It doesn’t issue an invoice or record a payment." : "This clears the blocker without recording a provider outcome."}</p><div className="rr-follow__actions"><button className="rr-dashboard__primary" type="button" disabled={forbidden || state.pending || conflict || state.remaining > 0} onClick={confirm}>{state.pending ? "Recording…" : state.remaining > 0 ? `Try again in ${state.remaining}s` : state.frozen ? "Retry original update" : preview ? "Confirm preview update" : "Confirm record"}</button><button className="rr-clients__outline-action" type="button" disabled={locked || rejected} onClick={() => setReviewed(null)}>Edit details</button></div></section> : <form onSubmit={review} noValidate className="rr-follow__panel rr-follow__form">
        {Object.keys(errors).length > 0 && <div className="rr-follow__errors" role="alert" tabIndex={-1} ref={errorSummary}><h2>Check these details</h2><ul>{Object.entries(errors).map(([key, message]) => <li key={key}>{message}</li>)}</ul></div>}
        <fieldset disabled={forbidden || locked}>
          {mode === "complete" ? <><h2>Provider action</h2><AuthField id="performedOn" name="performedOn" label={`Performed on (${cycle.timezone})`} type="date" max={today} value={performedOn} onChange={event => setPerformedOn(event.target.value)} error={errors.performedOn} /><AuthField id="providerReference" label="Provider reference (optional)" value={reference} maxLength={160} onChange={event => setReference(event.target.value)} error={errors.providerReference} hint="Add the provider’s confirmation or transaction reference." /><NoteField id="note" label="Outcome note (optional)" value={note} onChange={setNote} locked={locked} error={errors.note} hint="Provide a reference or an explanatory note. Use one paragraph, up to 1,000 characters." />{needsNext && <section className="rr-follow__next"><h2>Confirm the next term</h2><p>A renewed recurring service creates one next cycle. Check each date against the agreed term.</p><AuthField id="next-expiry" label="Next expiry date" type="date" value={expiryOn} onChange={event => setExpiryOn(event.target.value)} error={errors["next.expiryOn"]} /><div className="rr-follow__date-grid"><AuthField id="next-notice" label="Next provider notice (optional)" type="date" value={noticeBy} onChange={event => setNoticeBy(event.target.value)} error={errors["next.noticeBy"]} /><AuthField id="next-response" label="Next client response (optional)" type="date" value={respondBy} onChange={event => setRespondBy(event.target.value)} error={errors["next.respondBy"]} /></div><p className="rr-follow__hint">All dates use {cycle.timezone}. These dates are confirmed by you, not an automatic provider schedule.</p></section>}</> : mode === "billing" ? <><h2>Invoice tracking</h2><div className="rr-auth__field"><div className="rr-auth__label-row"><label htmlFor="invoice-status">Invoice status</label></div><NativeSelect id="invoice-status" value={invoiceStatus} onChange={event => setInvoiceStatus(event.target.value as typeof invoiceStatus)}>{Object.entries(invoiceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect></div>{invoiceStatus === "invoiced" && <AuthField id="invoiceReference" label="Invoice reference (optional)" value={invoiceReference} maxLength={160} onChange={event => setInvoiceReference(event.target.value)} error={errors.invoiceReference} />}<p className="rr-follow__hint">Track the agency invoice from your invoicing system. Saving another status clears its recorded reference. This is separate from your RenewRelay subscription.</p></> : <NoteField id="note" label={mode === "clear-blocker" ? "Why can this blocker be cleared?" : "Resolution note"} value={note} onChange={setNote} locked={locked} error={errors.note ?? errors.reason} hint={mode === "clear-blocker" ? "Record the reason in one paragraph, up to 1,000 characters." : "Record how the question was addressed. Internal note only; no client email is sent. Use one paragraph, up to 1,000 characters."} />}
        </fieldset><button className="rr-dashboard__primary" type="submit" disabled={forbidden || locked}>Review update</button>
      </form>}
      {state.failure && <AuthNotice error>{state.failure.message}{state.frozen && <p>Your original update is held for retry. Keep these details unchanged while its result is unknown.</p>}</AuthNotice>}
    </>}
  </div>;
}
