import { PreviewAction } from "../ui/preview-action";

export function ClosingCta() {
  return (
    <section className="closing-section" aria-labelledby="closing-title">
      <div className="page-container">
        <div className="closing-panel">
          <div className="closing-panel__light" aria-hidden="true" />
          <div className="closing-panel__content">
            <h2 id="closing-title">Give every renewal<br />a clear next step.</h2>
            <p className="closing-description">Bring your clients, decisions and team’s follow-through together. Start with a few renewals and build a clearer process.</p>
            <PreviewAction className="button--sky">Start your free trial</PreviewAction>
            <p className="closing-trial-note">14-day trial <span aria-hidden="true">·</span> 10 renewal items <span aria-hidden="true">·</span> 3 team seats</p>
          </div>
        </div>
      </div>
    </section>
  );
}
