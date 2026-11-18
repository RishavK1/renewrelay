import { Timeline } from "../ui/timeline";
import { PreviewAction } from "../ui/preview-action";
import { CompletedRecord, DecisionRecord, PreparedRecord } from "./renewal-illustrations";

export function RenewalWorkflow() {
  return (
    <section id="how-it-works" className="workflow-section section-anchor" aria-labelledby="workflow-title">
      <div className="page-container">
        <div className="section-heading">
          <h2 id="workflow-title">From a due date to a clear outcome.</h2>
          <p>Prepare the details, collect a decision, and record what your team does next.</p>
        </div>
        <p className="workflow-example-label">One example: Northline Studio’s hosting renewal</p>
        <Timeline data={[
          { id: "prepare", label: "Prepare", title: "Put the renewal in place.", description: "Add the service, dates and assigned teammate. Prepare the client quote and terms before asking for a decision.", content: <PreparedRecord /> },
          { id: "decide", label: "Decide", title: "Give the client a clear choice.", description: "Send a private decision request. Clients can approve, decline or ask a question after verification.", content: <DecisionRecord /> },
          { id: "follow-through", label: "Follow through", title: "Finish the work. Keep the record.", description: "Your team reviews the decision, handles the provider action, and records the outcome. Track invoicing separately where needed.", content: <CompletedRecord /> },
        ]} />
        <div className="workflow-cta">
          <PreviewAction>Start your free trial</PreviewAction>
          <p className="hero-trial-note"><span>14-day trial</span><span className="note-divider" aria-hidden="true">·</span><span>10 renewal items</span><span className="note-divider" aria-hidden="true">·</span><span>3 team seats</span></p>
          <p className="workflow-sample-note">Workflow illustrated with sample data.</p>
        </div>
      </div>
    </section>
  );
}
