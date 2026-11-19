"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { activateDraft, editCycle, offlineDecision } from "../../contracts/renewals";
import { AuthField, AuthNotice, AuthSuccessMark } from "../auth/auth-fields";
import { NativeSelect } from "../primitives/native-select";
import { useDecisionAction } from "../decisions/use-preview-action";
import type { RenewalDetailRecord } from "./contracts";
import type { RenewalEditAction, RenewalEditCommand } from "./edit-contracts";
import { displayMoney, minorAmount, moneyInput } from "./money";
import { renewalDate } from "./renewal-views";

type Mode = RenewalEditCommand["operation"];
type Props = { mode: Mode; record: RenewalDetailRecord; clientName: string; canWrite: boolean; today: string; action: RenewalEditAction; preview?: boolean };
const titles: Record<Mode, string> = { revise: "Edit renewal details", activate: "Activate draft", "record-offline": "Record offline instruction" };
const currencyCodes = Intl.supportedValuesOf("currency");
function Note({ id, label, value, onChange, error, hint }: { id: string; label: string; value: string; onChange: (value: string) => void; error?: string; hint: string }) {
  return <div className="rr-auth__field"><div className="rr-auth__label-row"><label htmlFor={id}>{label}</label></div><textarea id={id} rows={4} maxLength={1000} value={value} onChange={event => onChange(event.target.value)} aria-invalid={!!error} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`} /><p id={`${id}-hint`} className="rr-auth__hint">{hint}</p>{error && <p id={`${id}-error`} className="rr-auth__field-error">{error}</p>}</div>;
}
function Values({ values }: { values: Record<string, ReactNode> }) { return <dl className="rr-follow__review-list">{Object.entries(values).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>; }
function terms(record: RenewalDetailRecord) {
  const c = record.cycle;
  return { Service: c.service, Provider: c.provider, Currency: c.currency, "Expiry date": renewalDate(c.expiryOn), "Provider notice": renewalDate(c.noticeBy), "Client response": renewalDate(c.respondBy), "Supplier cost (internal)": displayMoney(c.supplierCostMinor, c.currency), "Client quote": displayMoney(c.clientQuoteMinor, c.currency), Term: c.term ?? "Not recorded", "Paid by": c.payer === "agency" ? "Agency" : "Client", Rebillable: c.rebillable ? "Yes" : "No", "Provider auto-renew": c.autoRenew ? "Recorded as enabled" : "Not recorded as enabled" };
}
function Changes({ command, record }: { command: Extract<RenewalEditCommand, { operation: "revise" }>; record: RenewalDetailRecord }) {
  const after = terms({ ...record, cycle: { ...record.cycle, ...command.input } });
  const before = terms(record);
  const changed = Object.keys(before).filter(key => before[key as keyof typeof before] !== after[key as keyof typeof after]);
  return <><table className="rr-renewal-edit__changes"><caption>Changes to this renewal</caption><thead><tr><th scope="col">Field</th><th scope="col">Current</th><th scope="col">Updated</th></tr></thead><tbody>{changed.map(key => <tr key={key}><th scope="row">{key}</th><td>{before[key as keyof typeof before]}</td><td>{after[key as keyof typeof after]}</td></tr>)}</tbody></table>{command.input.providerAgreement && <Values values={{ "Provider agreement": command.input.providerAgreement }} />}</>;
}

export function RenewalEditForm({ mode, record, clientName, canWrite, today, action, preview = false }: Props) {
  const c = record.cycle;
  const [service, setService] = useState(c.service), [provider, setProvider] = useState(c.provider);
  const [expiryOn, setExpiryOn] = useState(c.expiryOn), [noticeBy, setNoticeBy] = useState(c.noticeBy ?? ""), [respondBy, setRespondBy] = useState(c.respondBy ?? "");
  const [payer, setPayer] = useState(c.payer), [rebillable, setRebillable] = useState(c.rebillable), [autoRenew, setAutoRenew] = useState(c.autoRenew);
  const [currency, setCurrency] = useState(c.currency), [cost, setCost] = useState(moneyInput(c.supplierCostMinor, c.currency)), [quote, setQuote] = useState(moneyInput(c.clientQuoteMinor, c.currency));
  const [term, setTerm] = useState(c.term ?? ""), [agreement, setAgreement] = useState("");
  const [instruction, setInstruction] = useState<"" | "renew" | "cancel">(""), [source, setSource] = useState(""), [instructedOn, setInstructedOn] = useState(today), [reason, setReason] = useState("");
  const [currencyChanged, setCurrencyChanged] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reviewed, setReviewed] = useState<RenewalEditCommand | null>(null);
  const [saved, setSaved] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null), errorSummary = useRef<HTMLDivElement>(null);
  const state = useDecisionAction(action);
  const allowed = mode === "revise" ? !c.closedAt && record.allowedActions.includes("revise") : mode === "activate" ? c.state === "draft" && record.allowedActions.includes("activate") : c.state === "open" && !c.closedAt && record.allowedActions.includes("record_offline");
  const rejected = !!state.failure && ["stale_version", "invalid_transition", "forbidden", "not_found", "unauthenticated", "mfa_required", "workspace_read_only", "workspace_deleting", "idempotency_conflict"].includes(state.failure.code);
  const disabled = !canWrite || !allowed || rejected;
  const needsAgreement = !!c.noticeBy && (!noticeBy || noticeBy > c.noticeBy);
  const conflict = !!reviewed && reviewed.input.expectedVersion !== c.version && !state.frozen;
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [mode, reviewed, saved]);
  useEffect(() => { if (Object.keys(errors).length) errorSummary.current?.focus(); }, [errors]);
  function review(event: FormEvent) {
    event.preventDefault(); if (disabled || state.pending || state.frozen) return;
    let command: RenewalEditCommand;
    if (mode === "revise") {
      const supplier = minorAmount(cost, currency), client = minorAmount(quote, currency);
      if (supplier.error || client.error) { setErrors({ ...(supplier.error ? { supplierCostMinor: supplier.error } : {}), ...(client.error ? { clientQuoteMinor: client.error } : {}) }); return; }
      const parsed = editCycle.safeParse({ expectedVersion: c.version, service, provider, expiryOn, noticeBy: noticeBy || null, respondBy: respondBy || null, payer, rebillable, autoRenew, currency, supplierCostMinor: supplier.value, clientQuoteMinor: client.value, term: term.trim() ? term : null, ...(needsAgreement ? { providerAgreement: agreement } : {}) });
      if (!parsed.success) { showIssues(parsed.error.issues); return; }
      if (needsAgreement && !parsed.data.providerAgreement) { setErrors({ providerAgreement: "Record the provider agreement before extending or removing this notice deadline." }); return; }
      const fields = ["service", "provider", "expiryOn", "noticeBy", "respondBy", "payer", "rebillable", "autoRenew", "currency", "supplierCostMinor", "clientQuoteMinor", "term"] as const;
      if (!fields.some(field => c[field] !== parsed.data[field])) { setErrors({ form: "Change at least one renewal detail before saving." }); return; }
      command = { operation: "revise", input: parsed.data };
    } else if (mode === "activate") {
      const parsed = activateDraft.safeParse({ expectedVersion: c.version });
      if (!parsed.success) { showIssues(parsed.error.issues); return; }
      command = { operation: "activate", input: parsed.data };
    } else {
      const parsed = offlineDecision.safeParse({ expectedVersion: c.version, action: instruction, source, instructedOn, reason });
      if (!parsed.success) { showIssues(parsed.error.issues); return; }
      if (parsed.data.instructedOn > today) { setErrors({ instructedOn: "The instruction date cannot be in the future." }); return; }
      if (parsed.data.action === "renew" && (c.clientQuoteMinor === null || !c.term)) { setErrors({ quote: "Record a client quote and term before recording approval to renew." }); return; }
      command = { operation: "record-offline", input: parsed.data };
    }
    setErrors({}); state.clearFailure(); setReviewed(command);
  }
  function showIssues(issues: { path: PropertyKey[]; message: string }[]) { const next: Record<string, string> = {}; for (const issue of issues) next[issue.path.join(".") || "form"] ??= issue.message; setErrors(next); }
  async function confirm() { if (!reviewed || disabled || conflict || state.pending) return; const result = await state.run(reviewed); if (result?.status === "success") setSaved(true); }
  return <div className="rr-follow rr-renewal-edit"><Link className="rr-clients__back" href={`/renewals/${c.id}`}>Back to renewal</Link><div className="rr-dashboard__page-heading"><h1 ref={heading} tabIndex={-1}>{saved ? preview ? "Preview updated" : "Renewal updated" : reviewed ? "Review before recording" : titles[mode]}</h1><p>{clientName} <span aria-hidden="true">/</span> {c.service}</p></div>
    {saved ? <section className="rr-follow__success"><AuthSuccessMark /><h2>{mode === "revise" ? "Renewal details updated" : mode === "activate" ? "Draft activated" : "Offline instruction recorded"}</h2><p>{preview ? "Only the in-memory preview was updated. No backend record, email, provider operation or payment was created." : mode === "revise" ? "Previous decision access has been revoked. Review the updated renewal before requesting a new client decision." : mode === "activate" ? "The cycle is open for tracking. Client requests and provider work are separate steps." : "The cycle is ready for provider follow-through. Its provider outcome has not been recorded."}</p><div className="rr-follow__actions"><Link className="rr-dashboard__primary" href={`/renewals/${c.id}`}>View updated renewal</Link>{mode === "record-offline" && <Link className="rr-clients__outline-action" href={`/renewals/${c.id}/follow-through`}>Continue to follow-through</Link>}</div></section> : <>
      {disabled && <AuthNotice error>{!canWrite ? "This workspace is read-only. Changes are unavailable." : "This action isn’t available for the current record or access state. Return to the renewal and review its current details."}</AuthNotice>}
      {reviewed ? <section className="rr-follow__panel" aria-busy={state.pending}><h2>What will change</h2>{reviewed.operation === "revise" ? <Changes command={reviewed} record={record} /> : reviewed.operation === "activate" ? <><Values values={terms(record)} /><p className="rr-follow__hint">Activation starts tracking this draft. It does not request client approval or perform provider work.</p>{c.nextActionOn < today && <AuthNotice>The next action date is already past. This renewal will enter active tracking as overdue.</AuthNotice>}</> : <><Values values={{ Instruction: reviewed.input.action === "renew" ? "Renew" : "Do not renew", Source: reviewed.input.source, "Instructed on": renewalDate(reviewed.input.instructedOn), Reason: reviewed.input.reason, "Current quote": displayMoney(c.clientQuoteMinor, c.currency), Term: c.term ?? "Not recorded", "Next action date": renewalDate(c.noticeBy ?? c.expiryOn) }} /><p className="rr-follow__hint">This records an instruction received outside RenewRelay. Provider renewal or cancellation still requires separate follow-through.</p></>}
        {(reviewed.operation === "revise" || reviewed.operation === "record-offline") && <AuthNotice>{reviewed.operation === "revise" ? `Existing decision links will stop working and the current instruction will be cleared. ${c.state === "draft" ? "The cycle stays a draft." : "The cycle returns to Open."}` : "Existing decision links will stop working. The cycle becomes ready with this instruction."}</AuthNotice>}
        {conflict && <AuthNotice error>This renewal changed while you were reviewing. Return to its details and review the current version.</AuthNotice>}<div className="rr-follow__actions"><button className="rr-dashboard__primary" type="button" disabled={disabled || conflict || state.pending || state.remaining > 0} onClick={confirm}>{state.pending ? "Recording…" : state.remaining > 0 ? `Try again in ${state.remaining}s` : state.frozen ? "Retry original update" : preview ? "Confirm preview update" : "Confirm update"}</button><button className="rr-clients__outline-action" type="button" disabled={!!state.frozen || state.pending || rejected} onClick={() => setReviewed(null)}>Edit details</button></div>
      </section> : <form className="rr-follow__panel rr-follow__form" onSubmit={review} noValidate>
        {Object.keys(errors).length > 0 && <div className="rr-follow__errors" ref={errorSummary} tabIndex={-1} role="alert"><h2>Check these details</h2><ul>{Object.entries(errors).map(([key, value]) => <li key={key}>{value}</li>)}</ul>{errors.quote && <Link className="rr-auth__notice-link" href={`/renewals/${c.id}/edit`}>Edit quote and term</Link>}</div>}
        <fieldset disabled={disabled || state.pending}>
          {mode === "revise" ? <>
            <section className="rr-renewal-edit__section"><h2>Service</h2><div className="rr-follow__date-grid"><AuthField id="edit-service" label="Service name" value={service} maxLength={120} error={errors.service} onChange={event => setService(event.target.value)} /><AuthField id="edit-provider" label="Provider" value={provider} maxLength={120} error={errors.provider} onChange={event => setProvider(event.target.value)} /></div></section>
            <section className="rr-renewal-edit__section"><h2>Dates</h2><p className="rr-follow__hint">Dates use {c.timezone}.</p><AuthField id="edit-expiry" label="Expiry date" type="date" value={expiryOn} error={errors.expiryOn} onChange={event => setExpiryOn(event.target.value)} /><div className="rr-follow__date-grid"><AuthField id="edit-notice" label="Provider notice (optional)" type="date" value={noticeBy} error={errors.noticeBy} onChange={event => setNoticeBy(event.target.value)} /><AuthField id="edit-response" label="Client response (optional)" type="date" value={respondBy} error={errors.respondBy} onChange={event => setRespondBy(event.target.value)} /></div>{needsAgreement && <Note id="providerAgreement" label="Provider agreement" value={agreement} onChange={setAgreement} error={errors.providerAgreement} hint="Record the provider’s agreement to extend or remove the original notice deadline. One paragraph, up to 1,000 characters." />}</section>
            <section className="rr-renewal-edit__section"><h2>Responsibility</h2><div className="rr-auth__field"><div className="rr-auth__label-row"><label htmlFor="edit-payer">Provider paid by</label></div><NativeSelect id="edit-payer" value={payer} onChange={event => { const value = event.target.value as typeof payer; setPayer(value); if (value === "client") setRebillable(false); }}><option value="agency">Agency</option><option value="client">Client</option></NativeSelect></div><label className="rr-renewal-edit__check"><input type="checkbox" checked={rebillable} disabled={payer !== "agency"} onChange={event => setRebillable(event.target.checked)} /><span>Rebillable to the client</span></label><label className="rr-renewal-edit__check"><input type="checkbox" checked={autoRenew} onChange={event => setAutoRenew(event.target.checked)} /><span>Provider auto-renew is recorded as enabled</span></label><p className="rr-follow__hint">This records the provider setting; it doesn’t change it at the provider.</p></section>
            <section className="rr-renewal-edit__section"><h2>Costs & client terms</h2><div className="rr-auth__field"><div className="rr-auth__label-row"><label htmlFor="edit-currency">Currency</label></div><NativeSelect id="edit-currency" value={currency} onChange={event => { setCurrency(event.target.value); setCost(""); setQuote(""); setCurrencyChanged(true); }}>{currencyCodes.map(value => <option key={value}>{value}</option>)}</NativeSelect></div>{currencyChanged && <AuthNotice>Amounts were cleared when the currency changed. Enter the costs and quote in the selected currency.</AuthNotice>}<div className="rr-follow__date-grid"><AuthField id="edit-cost" label="Supplier cost (internal, optional)" inputMode="decimal" value={cost} error={errors.supplierCostMinor} onChange={event => setCost(event.target.value)} /><AuthField id="edit-quote" label="Client quote (optional)" hint="Leave blank if unrecorded; enter 0 for a zero quote." inputMode="decimal" value={quote} error={errors.clientQuoteMinor} onChange={event => setQuote(event.target.value)} /></div><AuthField id="edit-term" label="Client term (optional)" value={term} maxLength={160} error={errors.term} onChange={event => setTerm(event.target.value)} hint="Describe the service period covered by the client quote." /></section>
          </> : mode === "activate" ? <section className="rr-renewal-edit__section"><h2>Draft details</h2><Values values={terms(record)} /><p className="rr-follow__hint">Review the service and dates before activating.</p><Link className="rr-clients__outline-action" href={`/renewals/${c.id}/edit`}>Edit draft details</Link></section> : <section className="rr-renewal-edit__section"><h2>Client instruction</h2><Values values={{ "Client quote": displayMoney(c.clientQuoteMinor, c.currency), Term: c.term ?? "Not recorded" }} /><div className="rr-auth__field"><div className="rr-auth__label-row"><label htmlFor="offline-action">Instruction received</label></div><NativeSelect id="offline-action" value={instruction} onChange={event => setInstruction(event.target.value as typeof instruction)} aria-invalid={!!errors.action}><option value="" disabled>Choose an instruction</option><option value="renew">Renew</option><option value="cancel">Do not renew</option></NativeSelect></div><AuthField id="offline-source" label="Source" value={source} maxLength={120} error={errors.source} placeholder="e.g. email conversation or phone call" onChange={event => setSource(event.target.value)} /><AuthField id="offline-date" label={`Instruction date (${c.timezone})`} type="date" max={today} value={instructedOn} error={errors.instructedOn} onChange={event => setInstructedOn(event.target.value)} /><Note id="offline-reason" label="Reason / instruction details" value={reason} onChange={setReason} error={errors.reason} hint="Record what the client instructed and why. One paragraph, up to 1,000 characters." /></section>}
        </fieldset><button className="rr-dashboard__primary" type="submit" disabled={disabled || state.pending}>Review update</button>
      </form>}
      {state.failure && <AuthNotice error>{state.failure.message}{state.frozen && <p>Your original update is held for retry. Its details remain unchanged until the result is confirmed.</p>}</AuthNotice>}
    </>}
  </div>;
}
