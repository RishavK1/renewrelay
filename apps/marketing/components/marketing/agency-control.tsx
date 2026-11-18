import { ArrowDown, ArrowRight, Check, FileText, History, ListChecks, MailWarning } from "lucide-react";
import { BentoGrid, BentoGridItem } from "../ui/bento-grid";
import { PreviewAction } from "../ui/preview-action";
import { hostingExample as example, sampleRenewals } from "./renewal-example";

const nextActions: Record<string, string> = {
  "Northline Studio": "Follow up on the client’s decision.",
  "Oak & Field": "Review the instruction and handle the renewal.",
  "Lumen Works": "Resolve the provider access issue.",
};

function ActionList() {
  return (
    <div className="attention-list">
      <div className="attention-list__header"><span>Assigned work</span><span>1 Dec 2026</span></div>
      {sampleRenewals.map(record => (
        <div className="attention-row" key={record.client}>
          <div className="attention-row__top"><strong>{record.client}</strong><span className={`status-pill status-pill--${record.tone}`}>{record.status}</span></div>
          <p className="attention-row__service">{record.service}</p>
          <p className="attention-row__action">{nextActions[record.client]}</p>
          {record.tone === "blocked" && <p className="attention-blocker">Blocker: provider access needs to be restored.</p>}
          <div className="attention-row__meta"><span className="person"><span className="avatar" aria-hidden="true">{record.owner.slice(0, 1)}</span>{record.owner}</span><span>Next action · {record.nextAction}</span></div>
        </div>
      ))}
    </div>
  );
}

function FollowUpSummary() {
  return (
    <div className="follow-up-summary">
      <div><span className="follow-up-dot" aria-hidden="true" /><p><strong>Decision still outstanding</strong><span>Northline Studio · Hosting</span></p></div>
      <div><MailWarning size={17} aria-hidden="true" /><p><strong>Delivery needs attention</strong><span>Cedar Workshop · Domain renewal</span></p></div>
      <p className="follow-up-summary__note">A sent message is not a client decision.</p>
    </div>
  );
}

function InvoiceSummary() {
  return (
    <div className="invoice-example">
      <div className="invoice-example__outcome"><Check size={16} aria-hidden="true" /><span>Provider renewal recorded</span></div>
      <p>{example.client} · {example.service}</p>
      <div className="invoice-example__amount"><strong>{example.quote}</strong><span>Sample client quote</span></div>
      <div className="invoice-summary"><span>Agency invoice</span><strong>To invoice</strong></div>
    </div>
  );
}

function RevisionHistory() {
  return (
    <div className="revision-example">
      <div className="revision-record revision-record--previous"><div><span>Earlier request</span><span className="revision-status">Superseded</span></div><strong>Lumen Works · Maintenance</strong><p>Previous terms · 2 Dec 2026</p><span className="revision-record__note">Earlier decision link revoked</span></div>
      <span className="revision-connector" aria-hidden="true"><ArrowRight className="revision-arrow-desktop" size={22} /><ArrowDown className="revision-arrow-mobile" size={22} /></span>
      <div className="revision-record revision-record--current"><div><span>Revised request</span><span className="revision-status">Awaiting response</span></div><strong>Lumen Works · Maintenance</strong><p>Updated terms · 3 Dec 2026</p><span className="revision-record__note">A current decision is needed</span></div>
    </div>
  );
}

export function AgencyControl() {
  return (
    <section id="agency-control" className="agency-control section-anchor" aria-labelledby="agency-title">
      <div className="page-container">
        <div className="section-heading"><h2 id="agency-title">Know what needs you. Keep the work moving.</h2><p>Unanswered requests, blocked renewals and work still to invoice deserve a clear next step—not another search through your inbox.</p></div>
        <BentoGrid>
          <BentoGridItem className="agency-bento__item--main" icon={<ListChecks size={20} />} title="Keep the next action visible." description="See work waiting on a client, ready for an operator or blocked by an issue—with the assigned teammate alongside it."><ActionList /></BentoGridItem>
          <BentoGridItem className="agency-bento__item--follow-up" icon={<MailWarning size={20} />} title="Follow up with context." description="Keep unanswered requests and delivery issues visible so your team knows what to follow up."><FollowUpSummary /></BentoGridItem>
          <BentoGridItem className="agency-bento__item--invoice" icon={<FileText size={20} />} title="Keep invoicing in view." description="Separate completed provider work from what still needs to be invoiced."><InvoiceSummary /></BentoGridItem>
          <BentoGridItem className="agency-bento__item--history" icon={<History size={20} />} title="Know which decision still applies." description="When renewal details change, earlier links are revoked and the revised terms need a current decision."><RevisionHistory /></BentoGridItem>
        </BentoGrid>
        <p className="example-disclosure">Illustrative agency work · Separate sample scenarios</p>
        <div className="agency-control__cta"><p>Give the next renewal a clearer process.</p><PreviewAction>Start your free trial</PreviewAction><p className="hero-trial-note"><span>14-day trial</span><span className="note-divider" aria-hidden="true">·</span><span>10 renewal items</span><span className="note-divider" aria-hidden="true">·</span><span>3 team seats</span></p></div>
      </div>
    </section>
  );
}
