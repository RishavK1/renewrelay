"use client";

import { isUnconfirmedResult } from "../decisions/action-policy";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { createRenewal, schedule, type CreateRenewal } from "../../contracts/renewals";
import { AuthField, AuthNotice } from "../auth/auth-fields";
import { NativeSelect } from "../primitives/native-select";
import type { ClientView } from "../clients/contracts";
import type { OperatorOption, RenewalCreateAction, RenewalCreateResult } from "./contracts";
import { displayMoney, minorAmount } from "./money";

const stages = ["Service", "Dates", "Costs & terms", "Review"];
const stageFields = [["clientId", "service", "provider", "operatorId", "recurrence"], ["expiryOn", "noticeBy", "respondBy"], ["currency", "payer", "supplierCostMinor", "clientQuoteMinor", "term", "rebillable", "autoRenew"], ["mode"]];
type Draft = Omit<CreateRenewal, "noticeBy" | "respondBy" | "term" | "supplierCostMinor" | "clientQuoteMinor" | "payer" | "recurrence"> & { noticeBy: string; respondBy: string; term: string; cost: string; quote: string; payer: "" | CreateRenewal["payer"]; recurrence: "" | CreateRenewal["recurrence"] };
type Failure = Extract<RenewalCreateResult, { status: "error" }>;

export function RenewalForm({ clients, operators, timezone, action, initialClientId, canWrite, preview = false }: { clients: ClientView[]; operators: OperatorOption[]; timezone: string; action: RenewalCreateAction; initialClientId?: string; canWrite: boolean; preview?: boolean }) {
  const activeClients = clients.filter(client => !client.archivedAt);
  const activeOperators = operators.filter(operator => !operator.removedAt);
  const [draft, setDraft] = useState<Draft>({ clientId: activeClients.some(row => row.id === initialClientId) ? initialClientId! : "", operatorId: "", service: "", provider: "", recurrence: "", expiryOn: "", noticeBy: "", respondBy: "", term: "", currency: "", cost: "", quote: "", payer: "", rebillable: false, autoRenew: false, mode: "activate" });
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [pending, setPending] = useState(false);
  const [snapshot, setSnapshot] = useState<CreateRenewal | null>(null);
  const [confirmed, setConfirmed] = useState<Extract<RenewalCreateResult, { status: "success" }> | null>(null);
  const [review, setReview] = useState<CreateRenewal | null>(null);
  const [retryUntil, setRetryUntil] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const request = useRef<AbortController | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const currencies = Intl.supportedValuesOf("currency");
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step, confirmed]);
  useEffect(() => {
    if (!retryUntil) return;
    const sync = () => setRemaining(Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000)));
    sync(); const interval = window.setInterval(sync, 1000); return () => window.clearInterval(interval);
  }, [retryUntil]);
  const blocked = !canWrite || !!failure && ["idempotency_conflict", "workspace_read_only", "workspace_deleting", "forbidden", "unauthenticated", "mfa_required", "email_unverified", "item_limit"].includes(failure.code);
  const locked = pending || !!snapshot || blocked;
  function change<K extends keyof Draft>(field: K, value: Draft[K]) {
    if (locked) return;
    setDraft(previous => ({ ...previous, [field]: value, ...(field === "payer" && value !== "agency" ? { rebillable: false } : {}) }));
    setErrors({}); setFailure(null);
  }
  function validate(all = false): CreateRenewal | null {
    const cost = minorAmount(draft.cost, draft.currency), quote = minorAmount(draft.quote, draft.currency);
    const { cost: _cost, quote: _quote, ...raw } = draft;
    const result = createRenewal.safeParse({ ...raw, noticeBy: draft.noticeBy || null, respondBy: draft.respondBy || null, term: draft.term.trim() || null, supplierCostMinor: cost.value, clientQuoteMinor: quote.value });
    const fields: Record<string, string> = {};
    if (!result.success) for (const issue of result.error.issues) {
      const field = String(issue.path[0] ?? "_request");
      if (all || stageFields[step]!.includes(field)) fields[field] = issue.message;
    }
    if (all || step === 0) {
      if (!activeClients.some(row => row.id === draft.clientId)) fields.clientId = "Choose an active client.";
      if (!activeOperators.some(row => row.userId === draft.operatorId)) fields.operatorId = "Choose an active team member.";
      if (!draft.service.trim()) fields.service = "Enter the service name.";
      if (!draft.provider.trim()) fields.provider = "Enter the provider name.";
      if (!draft.recurrence) fields.recurrence = "Choose a recurrence.";
    }
    if (all || step === 1) {
      const dates = schedule.safeParse({ expiryOn: draft.expiryOn, noticeBy: draft.noticeBy || null, respondBy: draft.respondBy || null });
      if (!dates.success) for (const issue of dates.error.issues) fields[String(issue.path[0])] = issue.message;
      if (!draft.expiryOn) fields.expiryOn = "Enter the expiry date.";
    }
    if (all || step === 2) {
      if (!draft.currency) fields.currency = "Choose a currency.";
      if (!draft.payer) fields.payer = "Choose who pays the provider.";
      if (cost.error) fields.supplierCostMinor = cost.error;
      if (quote.error) fields.clientQuoteMinor = quote.error;
    }
    setErrors(fields);
    if (Object.keys(fields).length) {
      const first = Object.keys(fields)[0]!;
      if (all) { const index = stageFields.findIndex(group => group.includes(first)); if (index >= 0) setStep(index); }
      window.requestAnimationFrame(() => (form.current?.elements.namedItem(first) as HTMLElement | null)?.focus());
      return null;
    }
    if (!all && step < 3) {
      if (step === 2 && result.success) setReview(result.data);
      setStep(previous => previous + 1);
    }
    return result.success ? result.data : null;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (request.current || remaining > 0 || blocked) return;
    if (step < 3) { validate(); return; }
    const input = snapshot ?? validate(true); if (!input) return;
    const controller = new AbortController(); request.current = controller; setPending(true); setFailure(null);
    try {
      const result = await action(input, controller.signal);
      if (controller.signal.aborted) return;
      if (result.status === "success") { setReview(input); setConfirmed(result); setSnapshot(null); }
      else {
        setFailure(result); setSnapshot(isUnconfirmedResult(result.code) ? input : null);
        if (result.retryAfterSeconds) { setRemaining(result.retryAfterSeconds); setRetryUntil(Date.now() + result.retryAfterSeconds * 1000); }
        const fields: Record<string, string> = {};
        for (const [field, values] of Object.entries(result.fieldErrors ?? {})) if (values[0]) fields[field] = values[0];
        setErrors(fields);
        const index = stageFields.findIndex(group => group.some(field => !!fields[field])); if (index >= 0) setStep(index);
      }
    } catch {
      if (!controller.signal.aborted) { setSnapshot(input); setFailure({ status: "error", code: "connection_error", message: "The result couldn’t be confirmed. Retry this reviewed request before changing the renewal." }); }
    } finally { if (!controller.signal.aborted) { request.current = null; setPending(false); } }
  }
  function select(field: "clientId" | "operatorId" | "recurrence" | "payer" | "currency", label: string, options: { value: string; label: string }[], hint?: string) {
    return <div className="rr-auth__field"><div className="rr-auth__label-row"><label htmlFor={`renewal-${field}`}>{label}</label></div><NativeSelect id={`renewal-${field}`} name={field} value={draft[field]} onChange={event => change(field, event.target.value as Draft[typeof field])} disabled={locked} required aria-invalid={errors[field] ? true : undefined} aria-describedby={`renewal-${field}-hint${errors[field] ? ` renewal-${field}-error` : ""}`}><option value="" disabled>Choose {label.toLowerCase()}</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</NativeSelect><p id={`renewal-${field}-hint`} className="rr-auth__hint">{hint}</p>{errors[field] && <p id={`renewal-${field}-error`} className="rr-auth__field-error">{errors[field]}</p>}</div>;
  }
  const clientName = activeClients.find(row => row.id === draft.clientId)?.name ?? "Your client";
  const summary = review && <dl className="rr-renewal__review">
    {Object.entries({ Client: clientName, Service: review.service, Provider: review.provider, "Assigned to": activeOperators.find(row => row.userId === review.operatorId)?.label ?? "Team member", Recurrence: review.recurrence === "once" ? "One time" : review.recurrence, "Expiry date": review.expiryOn, "Provider notice": review.noticeBy ?? "Not recorded", "Client response": review.respondBy ?? "Not recorded", Timezone: timezone, "Provider paid by": review.payer === "agency" ? "Agency" : "Client", "Supplier cost (internal)": displayMoney(review.supplierCostMinor, review.currency), "Client quote": displayMoney(review.clientQuoteMinor, review.currency), Terms: review.term ?? "Not recorded", Rebillable: review.rebillable ? "Yes" : "No", "Provider auto-renew": review.autoRenew ? "Enabled at provider" : "Not recorded as enabled" }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
  </dl>;
  if (!activeClients.length || !activeOperators.length) return <div className="rr-clients__loading"><h1>Add a renewal</h1><p>{!activeClients.length ? "Add an active client before setting up a renewal." : "An active workspace member is required to assign this renewal."}</p><Link className="rr-dashboard__primary" href="/clients">Go to clients</Link></div>;
  if (confirmed) return <div className="rr-renewal"><span className="rr-auth__success-mark" aria-hidden="true"><Check size={26} /></span><div className="rr-dashboard__page-heading"><h1 ref={heading} tabIndex={-1}>{preview ? "Renewal preview ready" : "Renewal added"}</h1><p>{confirmed.cycle.state === "draft" ? "Saved as a draft for later activation." : "Open for tracking. Provider completion is a separate action."}</p></div>{preview && <AuthNotice>No backend renewal was created, provider contacted, message sent or charge made. This record is temporary preview data.</AuthNotice>}{summary}<Link className="rr-dashboard__primary" href={`/renewals/${confirmed.cycle.id}`}>{preview ? "View renewal preview" : "View renewal"}</Link><Link className="rr-clients__back" href="/dashboard">All renewals</Link></div>;
  return <div className="rr-renewal">
    <Link className="rr-clients__back" href="/clients" onClick={event => { if (pending) event.preventDefault(); }}><ArrowLeft size={16} aria-hidden="true" />Back to clients</Link>
    <div className="rr-dashboard__page-heading"><h1 ref={heading} tabIndex={-1}>Add a renewal</h1><p>Set the service, dates and terms your team needs to follow through.</p></div>
    <ol className="rr-renewal__steps" aria-label="Renewal setup progress">{stages.map((stage, index) => <li key={stage} aria-current={step === index ? "step" : undefined} data-complete={index < step}><span>{index + 1}</span>{stage}</li>)}</ol>
    <form ref={form} onSubmit={submit} noValidate aria-busy={pending}>
      <section className="rr-renewal__panel" aria-labelledby="renewal-step-title"><h2 id="renewal-step-title">{stages[step]}</h2>
        {step === 0 && <div className="rr-renewal__fields">
          {select("clientId", "Client", activeClients.map(client => ({ value: client.id, label: client.name })))}
          <AuthField label="Service name" id="renewal-service" name="service" value={draft.service} maxLength={120} onChange={event => change("service", event.target.value)} readOnly={locked} placeholder="e.g. Website hosting" required error={errors.service} />
          <AuthField label="Provider" id="renewal-provider" name="provider" value={draft.provider} maxLength={120} onChange={event => change("provider", event.target.value)} readOnly={locked} placeholder="e.g. Hosting provider" required error={errors.provider} />
          {select("operatorId", "Assigned team member", activeOperators.map(operator => ({ value: operator.userId, label: operator.label })), "The person responsible for the next action.")}
          {select("recurrence", "Recurrence", [{ value: "once", label: "One time" }, { value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }], "Tracks the service’s renewal pattern. It does not renew with the provider.")}
        </div>}
        {step === 1 && <><p className="rr-renewal__context">Dates use the workspace timezone: <strong>{timezone}</strong>.</p><div className="rr-renewal__fields">{([ ["expiryOn", "Expiry date", "When the current service term expires."], ["noticeBy", "Provider notice date (optional)", "Last date to notify the provider; on or before expiry."], ["respondBy", "Client response date (optional)", "On or before provider notice, or expiry when no notice date is recorded."] ] as const).map(([field, label, hint]) => <AuthField key={field} type="date" name={field} id={`renewal-${field}`} label={label} value={draft[field]} onChange={event => change(field, event.target.value)} readOnly={locked} required={field === "expiryOn"} error={errors[field]} hint={hint} />)}</div></>}
        {step === 2 && <div className="rr-renewal__fields">
          {select("payer", "Who pays the provider", [{ value: "agency", label: "Our agency" }, { value: "client", label: "The client" }])}
          {select("currency", "Currency", currencies.map(code => ({ value: code, label: code })), "All amounts use this currency. No currency conversion is performed.")}
          <AuthField label="Supplier cost (optional, internal)" id="renewal-supplierCostMinor" name="supplierCostMinor" value={draft.cost} inputMode="decimal" onChange={event => change("cost", event.target.value)} readOnly={locked} error={errors.supplierCostMinor} placeholder="e.g. 1200.00" hint="Leave blank if unknown. Use plain decimals without commas." />
          <AuthField label="Client quote (optional)" id="renewal-clientQuoteMinor" name="clientQuoteMinor" value={draft.quote} inputMode="decimal" onChange={event => change("quote", event.target.value)} readOnly={locked} error={errors.clientQuoteMinor} placeholder="e.g. 1500.00" hint="Blank means not recorded; zero is an explicit zero quote." />
          <AuthField label="Term / quote description (optional)" id="renewal-term" name="term" value={draft.term} onChange={event => change("term", event.target.value)} readOnly={locked} maxLength={160} error={errors.term} placeholder="e.g. 12 months of website hosting" hint="Quote and term are needed later before requesting renewal approval." />
          <label className="rr-renewal__checkbox"><input type="checkbox" checked={draft.rebillable} disabled={locked || draft.payer !== "agency"} onChange={event => change("rebillable", event.target.checked)} /><span>Rebillable to the client<small>Available only when your agency pays the provider.</small></span></label>
          <label className="rr-renewal__checkbox"><input type="checkbox" checked={draft.autoRenew} disabled={locked} onChange={event => change("autoRenew", event.target.checked)} /><span>Auto-renew is enabled at the provider<small>Records the provider’s setting. It does not enable auto-renew there.</small></span></label>
        </div>}
        {step === 3 && <>{summary}<fieldset className="rr-renewal__mode" disabled={locked}><legend>How should this record start?</legend><label><input type="radio" name="mode" checked={draft.mode === "activate"} onChange={() => change("mode", "activate")} />Track now <small>Open for team follow-up; no message or provider action.</small></label><label><input type="radio" name="mode" checked={draft.mode === "draft"} onChange={() => change("mode", "draft")} />Save as draft <small>Keep a complete record for later activation.</small></label></fieldset></>}
      </section>
      {failure && <AuthNotice error>{failure.message}{failure.recovery && <Link className="rr-auth__notice-link" href={failure.recovery}>Restore account access</Link>}</AuthNotice>}
      <div className="rr-renewal__actions"><button type="button" className="rr-clients__outline-action" disabled={step === 0 || locked} onClick={() => { setErrors({}); setStep(previous => previous - 1); }}>Back</button><button type="submit" className="rr-dashboard__primary" disabled={pending || blocked || remaining > 0}>{pending ? "Saving…" : remaining > 0 ? `Try again in ${remaining}s` : snapshot ? "Retry reviewed request" : step < 3 ? "Continue" : draft.mode === "draft" ? "Save as draft" : "Add renewal"}</button></div>
      {preview && <p className="rr-renewal__preview">UI preview only. No client request, provider renewal or payment is made.</p>}
    </form>
  </div>;
}
