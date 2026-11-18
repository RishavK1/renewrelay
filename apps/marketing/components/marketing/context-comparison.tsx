import { ArrowDown, CalendarDays, Check, FileText, Mail, MessageSquare } from "lucide-react";
import { Compare } from "../ui/compare";
import { hostingExample as example } from "./renewal-example";

function ScatteredContext() {
  return (
    <div className="context-scene context-scene--scattered">
      <div className="context-fragment context-fragment--date">
        <div className="context-fragment__label"><CalendarDays size={16} /> Renewal sheet</div>
        <strong>{example.service}</strong><p>{example.client}</p>
        <div className="fragment-date"><span>Expires</span><strong>{example.expiry}</strong></div>
        <span className="fragment-question">Who is handling this?</span>
      </div>
      <div className="context-fragment context-fragment--quote">
        <div className="context-fragment__label"><Mail size={16} /> Quote email</div>
        <strong>{example.quote} for {example.term}</strong><p>Hosting renewal for {example.client}.</p>
        <span className="fragment-question">Which terms were approved?</span>
      </div>
      <div className="context-fragment context-fragment--reply">
        <div className="context-fragment__label"><MessageSquare size={16} /> Client reply</div>
        <strong>“Yes, please renew.”</strong><p>A response in a separate thread.</p>
        <span className="fragment-question">Was the provider action recorded?</span>
      </div>
    </div>
  );
}

function ConnectedContext() {
  return (
    <div className="context-scene context-scene--connected">
      <div className="connected-record">
        <div className="connected-record__header"><span className="record-icon"><FileText size={20} /></span><div><p>{example.client}</p><strong>{example.service}</strong></div></div>
        <dl className="record-details">
          <div><dt>Quoted terms</dt><dd>{example.quote} / {example.term}</dd></div>
          <div><dt>Client decision</dt><dd className="connected-decision"><Check size={15} /> Approved · 4 Dec</dd></div>
          <div><dt>Assigned teammate</dt><dd>{example.teammate}</dd></div>
          <div><dt>Provider action</dt><dd>Still to perform</dd></div>
        </dl>
        <div className="connected-next"><span>Next action</span><strong>Review approval and handle the renewal.</strong></div>
      </div>
    </div>
  );
}

const contextQuestions = [
  { question: "Which quote did the client agree to?", answer: "Keep the response connected to the quoted terms." },
  { question: "Who is handling this renewal?", answer: "Keep an assigned teammate and the next action visible." },
  { question: "Did the work happen, or did someone just reply?", answer: "Record the provider outcome separately from the client’s decision." },
];

export function ContextComparison() {
  return (
    <section className="context-section" aria-labelledby="context-title">
      <div className="page-container">
        <div className="section-heading context-heading"><h2 id="context-title">The deadline is only part of the job.</h2><p>The date is in a spreadsheet. The quote is in an email. The client’s reply is in another thread. Bring the details and the next action into one renewal record.</p></div>
        <Compare firstLabel="Scattered context" secondLabel="One renewal record" firstContent={<ScatteredContext />} secondContent={<ConnectedContext />} />
        <p className="context-sample-note">Sample scenario · Northline Studio, before provider action</p>
        <div className="context-questions">{contextQuestions.map(({ question, answer }) => <div key={question}><h3>{question}</h3><p>{answer}</p></div>)}</div>
        <p className="context-closing">A reply, a completed renewal and an invoice are different things.</p>
        <a className="section-text-link" href="#agency-control">See what needs attention <ArrowDown size={17} aria-hidden="true" /></a>
      </div>
    </section>
  );
}
