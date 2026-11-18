import { CalendarDays, Check, CircleCheck, FileText, MessageSquare, ShieldCheck } from "lucide-react";
import { hostingExample as example, sampleRenewals } from "./renewal-example";

export function RenewalDetails({ showQuote = false }: { showQuote?: boolean }) {
  return (
    <dl className="record-details">
      <div><dt>Service expiry</dt><dd>{example.expiry}</dd></div>
      <div><dt>Provider notice by</dt><dd>{example.providerNotice}</dd></div>
      <div><dt>Client response by</dt><dd>{example.respondBy}</dd></div>
      {showQuote && <div><dt>Client quote</dt><dd>{example.quote} <span className="detail-muted">/ {example.term}</span></dd></div>}
    </dl>
  );
}

export function PreparedRecord() {
  return (
    <div className="example-card">
      <div className="record-heading"><span className="record-icon"><CalendarDays size={20} aria-hidden="true" /></span><div><p className="record-eyebrow">{example.client}</p><h4>{example.service}</h4></div></div>
      <RenewalDetails showQuote />
      <div className="record-footer"><span>Assigned to</span><span className="person"><span className="avatar" aria-hidden="true">R</span>{example.teammate}</span></div>
    </div>
  );
}

export function DecisionRecord() {
  return (
    <div className="example-card">
      <div className="record-heading"><span className="record-icon"><MessageSquare size={20} aria-hidden="true" /></span><div><p className="record-eyebrow">Client decision</p><h4>{example.client}</h4></div></div>
      <div className="decision-receipt"><span className="receipt-check"><Check size={20} aria-hidden="true" /></span><div><strong>Renewal approved</strong><p>{example.service} · {example.term}</p></div></div>
      <dl className="record-details"><div><dt>Client quote</dt><dd>{example.quote}</dd></div><div><dt>Response recorded</dt><dd>4 Dec 2026</dd></div></dl>
      <p className="record-note">Your team reviews the response before taking action.</p>
      <p className="record-footnote">Questions stay visible for staff follow-up.</p>
    </div>
  );
}

export function CompletedRecord() {
  return (
    <div className="example-card">
      <div className="record-heading"><span className="record-icon"><CircleCheck size={20} aria-hidden="true" /></span><div><p className="record-eyebrow">Provider action recorded</p><h4>{example.service}</h4></div><span className="status-pill status-pill--ready">Renewed</span></div>
      <dl className="record-details"><div><dt>Client</dt><dd>{example.client}</dd></div><div><dt>Recorded by</dt><dd>{example.teammate}</dd></div><div><dt>Performed on</dt><dd>{example.performedOn}</dd></div><div><dt>Provider reference</dt><dd>{example.reference}</dd></div></dl>
      <div className="invoice-summary"><span><FileText size={16} aria-hidden="true" /> Agency invoice</span><strong>To invoice</strong></div>
      <p className="record-footnote">Client approval does not renew the service automatically.</p>
    </div>
  );
}

export function RenewalOverview() {
  return (
    <div className="product-window">
      <div className="product-window__bar"><span>Sample workspace</span><span>1 Dec 2026</span></div>
      <div className="workspace-layout">
        <aside className="workspace-sidebar" aria-hidden="true"><span className="workspace-sidebar__title">Workspace</span><span className="workspace-sidebar__active">Renewals</span><span>Clients</span><span>Team</span></aside>
        <div className="workspace-content">
          <div className="workspace-heading"><h3>Renewals</h3><span>Next actions</span></div>
          <div className="renewal-queue" role="table" aria-label="Sample renewal records">
            <div className="renewal-queue__head" role="row"><span role="columnheader">Service / client</span><span role="columnheader">Next action</span><span role="columnheader">Owner</span><span role="columnheader">Status</span></div>
            {sampleRenewals.map((record, index) => (
              <div className={`renewal-queue__row${index === 0 ? " renewal-queue__row--selected" : ""}`} role="row" key={record.client}>
                <div className="queue-service" role="cell"><strong>{record.service}</strong><span>{record.client}</span></div>
                <div role="cell"><span className="queue-mobile-label">Next action</span>{record.nextAction}</div>
                <div role="cell"><span className="queue-mobile-label">Owner</span>{record.owner}</div>
                <div role="cell"><span className={`status-pill status-pill--${record.tone}`}>{record.status}</span></div>
              </div>
            ))}
          </div>
          <div className="queue-detail"><p><CalendarDays size={16} aria-hidden="true" /> {example.client} · {example.service}</p><RenewalDetails /></div>
        </div>
      </div>
    </div>
  );
}

export function ClientDecisionPreview() {
  return (
    <div className="product-window product-window--client">
      <div className="product-window__bar"><span>Client view</span><span><ShieldCheck size={14} aria-hidden="true" /> After verification</span></div>
      <div className="client-preview">
        <p className="record-eyebrow">{example.client}</p>
        <h3>A decision for your hosting renewal.</h3>
        <p className="client-preview__intro">Review the details before telling your agency how you’d like to proceed.</p>
        <div className="client-quote"><span>{example.service}</span><strong>{example.quote}<span> / {example.term}</span></strong></div>
        <dl className="record-details"><div><dt>Service expiry</dt><dd>{example.expiry}</dd></div><div><dt>Please respond by</dt><dd>{example.respondBy}</dd></div></dl>
        <div className="client-choices"><p>Client choices</p><ul><li><Check size={14} aria-hidden="true" /> Approve renewal</li><li>Do not renew</li><li>Ask a question</li></ul></div>
        <p className="record-footnote">Read-only example. No decision is submitted.</p>
      </div>
    </div>
  );
}

export function TeamFollowThroughPreview() {
  return (
    <div className="product-window">
      <div className="product-window__bar"><span>Sample workspace</span><span>Team follow-through</span></div>
      <div className="follow-through-preview">
        <div className="follow-through-preview__intro"><span className="record-icon"><CircleCheck size={20} aria-hidden="true" /></span><h3>A response is in.<br />The next step is clear.</h3><p>Client approval, provider action and invoicing stay separate.</p><span className="person"><span className="avatar" aria-hidden="true">R</span>Assigned to {example.teammate}</span></div>
        <CompletedRecord />
      </div>
    </div>
  );
}
