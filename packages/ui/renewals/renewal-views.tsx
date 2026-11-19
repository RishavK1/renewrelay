"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { NativeSelect } from "../primitives/native-select";
import { displayMoney } from "./money";
import type { RenewalDetailRecord, RenewalQueueRow, RenewalStatus } from "./contracts";

export const renewalStatusLabels: Record<RenewalStatus, string> = { draft: "Draft", open: "Open", ready: "Ready for operator", renewed: "Renewed", cancelled: "Cancelled", withdrawn: "Withdrawn" };
const guidance: Record<RenewalStatus, string> = {
  draft: "Review the draft before activating it for follow-up.",
  open: "Review the client decision requirements and plan the next team action.",
  ready: "The recorded instruction is ready for the team to carry out. Provider completion is still separate.",
  renewed: "A provider renewal outcome has been recorded.",
  cancelled: "A provider cancellation outcome has been recorded.",
  withdrawn: "This cycle has been withdrawn from active tracking.",
};
const invoiceLabels = { not_applicable: "Not applicable", to_invoice: "To invoice", invoiced: "Invoiced" };
export function renewalDate(value: string | null) {
  if (!value) return "Not recorded";
  const [year, month, day] = value.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(day)} ${months[Number(month) - 1] ?? month} ${year}`;
}
export function RenewalStatusBadge({ state }: { state: RenewalStatus }) { return <span className="rr-queue__status" data-state={state}>{renewalStatusLabels[state]}</span>; }

export function RenewalQueue({ rows, clientNames, operatorNames, status, onStatusChange, canWrite, nextCursor, onLoadMore, clientHref, filters, filtered = false, onClearFilters, canImport = false }: { rows: RenewalQueueRow[]; clientNames: Record<string, string>; operatorNames: Record<string, string>; status: RenewalStatus | "all"; onStatusChange: (status: RenewalStatus | "all") => void; canWrite: boolean; canImport?: boolean; nextCursor?: string | null; onLoadMore?: () => void; clientHref?: string; filters?: ReactNode; filtered?: boolean; onClearFilters?: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  return <>
    <div className="rr-clients__heading"><div className="rr-dashboard__page-heading"><h1 ref={heading} tabIndex={-1}>Renewals</h1><p>Keep the next action clear, from client decision to provider follow-through.</p></div>{canWrite && <div className="rr-clients__heading-actions">{canImport && <Link className="rr-clients__outline-action" href="/renewals/import">Import CSV</Link>}<Link className="rr-dashboard__primary" href="/renewals/new"><Plus size={17} aria-hidden="true" />Add renewal</Link></div>}</div>
    {filters}
    {filters && clientHref && <Link className="rr-clients__back" href={clientHref}>Back to client</Link>}
    {!filters && <div className="rr-queue__toolbar"><label htmlFor="renewal-status-filter">Status</label><NativeSelect id="renewal-status-filter" value={status} onChange={event => onStatusChange(event.target.value as RenewalStatus | "all")}><option value="all">All statuses</option>{Object.entries(renewalStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect>{clientHref && <Link href={clientHref} className="rr-clients__back">Back to client</Link>}</div>}
    {!rows.length ? <section className="rr-dashboard__state rr-dashboard__state--compact"><h2>{filtered ? "No renewals match these filters" : status === "all" ? "No renewals to show" : "No renewals match this status"}</h2><p>{filtered ? "Adjust or clear the filters to review other records." : status === "all" ? "Add a service to begin tracking its dates and next steps." : "Choose another status to review the other renewal records."}</p>{(filtered || status !== "all") && <button type="button" className="rr-clients__text-action" onClick={() => onClearFilters ? onClearFilters() : onStatusChange("all")}>Clear filters</button>}</section> : <div className="rr-queue__panel">
      <div className="rr-queue__columns" aria-hidden="true"><span>Service / client</span><span>Status</span><span>Next action</span><span>Assigned to</span></div>
      <ul className="rr-queue__rows">{rows.map(row => <li key={row.id}>
        <Link className="rr-queue__service" href={`/renewals/${row.id}`}><strong>{row.service}</strong><span>{clientNames[row.clientId] ?? "Client details not loaded"}</span><small>{row.provider}</small></Link>
        <div className="rr-queue__state"><RenewalStatusBadge state={row.state} />{row.blockedReason && <span className="rr-queue__flag">Blocked</span>}</div>
        <div className="rr-queue__date"><span className="rr-queue__mobile-label">Next action</span>{row.closedAt ? <span>Completed / closed</span> : row.state === "draft" ? <span>Not active</span> : <><time dateTime={row.nextActionOn}>{renewalDate(row.nextActionOn)}</time>{row.overdue && <small className="rr-queue__overdue">Overdue</small>}</>}</div>
        <div className="rr-queue__operator"><span className="rr-queue__mobile-label">Assigned to</span>{operatorNames[row.operatorId] ?? "Member details not loaded"}</div>
      </li>)}</ul>
      {nextCursor && <button className="rr-clients__text-action" type="button" disabled={!onLoadMore} onClick={onLoadMore}>Load more renewals</button>}
    </div>}
  </>;
}

function Details({ values }: { values: Record<string, string> }) {
  return <dl className="rr-renewal-record__values">{Object.entries(values).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

export function RenewalDetails({ record, clientName, operatorName, preview = false, canWrite = false, hasUnresolvedQuestions = false, hasActiveCycle }: { record: RenewalDetailRecord; clientName: string; operatorName: string; preview?: boolean; canWrite?: boolean; hasUnresolvedQuestions?: boolean; hasActiveCycle?: boolean }) {
  const { cycle, item } = record;
  const canRequest = canWrite && !hasUnresolvedQuestions && record.allowedActions.includes("issue");
  const canAssign = !item.archivedAt && (hasActiveCycle ?? !cycle.closedAt);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [cycle.id]);
  return <>
    <Link href="/dashboard" className="rr-clients__back"><ArrowLeft size={16} aria-hidden="true" />All renewals</Link>
    <div className="rr-dashboard__page-heading rr-renewal-record__heading"><RenewalStatusBadge state={cycle.state} /><h1 ref={heading} tabIndex={-1}>{cycle.service}</h1><p>{clientName} <span aria-hidden="true">/</span> {cycle.provider}</p></div>
    {item.archivedAt && <p className="rr-clients__information" role="status">Archived item. This historical cycle remains available for review.</p>}
    {hasUnresolvedQuestions && <p className="rr-clients__information" role="status">Resolve the client’s questions in Client responses before requesting a new decision.</p>}
    <nav className="rr-renewal-record__decision-links" aria-label="Renewal workflow">
      {canWrite && record.allowedActions.includes("activate") ? <Link className="rr-dashboard__primary" href={`/renewals/${cycle.id}/activate`}>Activate draft</Link> : cycle.state === "ready" || record.allowedActions.includes("billing") ? <Link className="rr-dashboard__primary" href={`/renewals/${cycle.id}/follow-through`}>Follow-through</Link> : canRequest ? <Link className="rr-dashboard__primary" href={`/renewals/${cycle.id}/request`}>Request client decision</Link> : null}
      <Link className="rr-clients__outline-action" href={`/renewals/${cycle.id}/responses`}>Client responses</Link>
      <Link className="rr-clients__outline-action" href={`/renewals/${cycle.id}/history`}>Activity history</Link>
    </nav>
    {canWrite && <details className="rr-organization__management"><summary>Manage record</summary><nav aria-label="Record management">
      {record.allowedActions.includes("revise") && <Link className="rr-clients__outline-action" href={`/renewals/${cycle.id}/edit`}>Edit details</Link>}
      {canAssign && <Link className="rr-clients__outline-action" href={`/renewals/${cycle.id}/assignment`}>Assignment & recurrence</Link>}
      {record.allowedActions.includes("record_offline") && <Link className="rr-clients__outline-action" href={`/renewals/${cycle.id}/record-offline`}>Record offline instruction</Link>}
      {cycle.state === "ready" && canRequest && <Link className="rr-clients__outline-action" href={`/renewals/${cycle.id}/request`}>Request a new decision</Link>}
      {record.allowedActions.includes("withdraw") && <Link className="rr-clients__outline-action" href={`/renewals/${cycle.id}/withdraw`}>Withdraw cycle</Link>}
      {!item.archivedAt && <Link className="rr-clients__outline-action" href={`/renewals/${cycle.id}/archive`}>Archive item</Link>}
      {record.allowedActions.includes("correct") && <Link className="rr-clients__outline-action" href={`/renewals/${cycle.id}/correct`}>Append correction</Link>}
    </nav></details>}
    <section className="rr-renewal-record__next" aria-labelledby="renewal-next-step"><div><span>Next step</span><h2 id="renewal-next-step">{cycle.blockedReason ? "Resolve the recorded blocker" : cycle.closedAt ? "Review the recorded outcome" : cycle.state === "draft" ? "Review and activate the draft" : "Follow through on this renewal"}</h2><p>{cycle.blockedReason ?? guidance[cycle.state]}</p></div>{!cycle.closedAt && cycle.state !== "draft" && <div className="rr-renewal-record__next-date"><span>Next action date</span><strong>{renewalDate(cycle.nextActionOn)}</strong>{cycle.overdue && <small>Overdue</small>}</div>}</section>
    <div className="rr-renewal-record__grid">
      <section className="rr-clients__section"><div className="rr-clients__section-heading"><div><h2>Service & responsibility</h2><p>Who and what this record belongs to.</p></div></div><Details values={{ Client: clientName, Provider: cycle.provider, "Assigned to": operatorName, Recurrence: item.recurrence === "once" ? "One time" : item.recurrence === "monthly" ? "Monthly" : "Yearly", "Recorded instruction": cycle.intendedAction === "renew" ? "Renew" : cycle.intendedAction === "cancel" ? "Cancel" : "Not recorded", "Provider auto-renew": cycle.autoRenew ? "Recorded as enabled" : "Not recorded as enabled" }} /></section>
      <section className="rr-clients__section"><div className="rr-clients__section-heading"><div><h2>Dates</h2><p>Record timezone: {cycle.timezone}</p></div></div><Details values={{ "Expiry date": renewalDate(cycle.expiryOn), "Provider notice date": renewalDate(cycle.noticeBy), "Client response date": renewalDate(cycle.respondBy), "Next action date": cycle.state === "draft" ? "Not active — draft" : cycle.closedAt ? "Cycle closed" : renewalDate(cycle.nextActionOn) }} />{cycle.providerNoticeMissed && <p className="rr-renewal-record__warning">The recorded provider notice deadline has passed.</p>}</section>
      <section className="rr-clients__section"><div className="rr-clients__section-heading"><div><h2>Costs & client terms</h2><p>Supplier cost is internal staff information.</p></div></div><Details values={{ Currency: cycle.currency, "Supplier cost (internal)": displayMoney(cycle.supplierCostMinor, cycle.currency), "Client quote": displayMoney(cycle.clientQuoteMinor, cycle.currency), Terms: cycle.term ?? "Not recorded", "Provider paid by": cycle.payer === "agency" ? "Agency" : "Client", "Rebillable to client": cycle.rebillable ? "Yes" : "No" }} /></section>
      <section className="rr-clients__section"><div className="rr-clients__section-heading"><div><h2>Provider outcome & invoicing</h2><p>Separate from client approval and subscription billing.</p></div></div><Details values={{ "Provider outcome": cycle.state === "renewed" ? "Renewed" : cycle.state === "cancelled" ? "Cancelled" : "Not recorded", "Action performed on": renewalDate(cycle.performedOn), "Provider reference": cycle.providerReference ?? "Not recorded", "Outcome note": cycle.outcomeNote ?? "Not recorded", "Agency invoice status": invoiceLabels[cycle.billingStatus], "Invoice reference": cycle.invoiceReference ?? "Not recorded" }} /></section>
    </div>
    {preview && <p className="rr-renewal-record__preview">Preview record only. Client decisions, provider actions and agency invoice changes remain separate. No backend data is connected.</p>}
  </>;
}
