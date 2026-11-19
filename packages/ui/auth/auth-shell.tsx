import type { ReactNode } from "react";

export function AuthShell({ children, screen, preview, asideContent, previewMessage }: { children: ReactNode; screen: string; preview?: boolean; asideContent?: ReactNode; previewMessage?: string }) {
  return (
    <div className="rr-auth" data-screen={screen}>
      <div className="rr-auth__column">
        <header className="rr-auth__header">
          <a className="rr-auth__brand" href="/" aria-label="RenewRelay home">RenewRelay</a>
          {preview && <span className="rr-auth__preview">UI preview</span>}
        </header>
        <main id="main-content" className="rr-auth__main">
          <div className="rr-auth__content">{children}</div>
        </main>
        <footer className="rr-auth__footnote">
          {preview ? (previewMessage ?? "Design preview. No account is created and no email is sent. Use sample details.") : "Client renewals, clearly under control."}
        </footer>
      </div>
      <aside className="rr-auth__aside" aria-label="About RenewRelay">
        {asideContent ?? <>
        <p className="rr-auth__aside-label">Less chasing. More clarity.</p>
        <div className="rr-auth__aside-heading">
          <h2>A clearer way to manage client renewals.</h2>
          <p>Keep renewal dates, client responses and your team’s next steps together.</p>
        </div>
        <div className="rr-auth__illustration" aria-hidden="true">
          <div className="rr-auth__orbit" />
          <div className="rr-auth__paper rr-auth__paper--back">
            <div className="rr-auth__paper-top"><span>Client response</span><span className="rr-auth__paper-status">Approved</span></div>
            <p>“Renew hosting for another year.”</p>
          </div>
          <div className="rr-auth__paper rr-auth__paper--front">
            <div className="rr-auth__paper-top"><span>Northline Studio</span><span>Hosting</span></div>
            <strong>Website hosting</strong>
            <div className="rr-auth__paper-bottom"><span>Expiry date</span><span>12 Dec 2026</span></div>
            <div className="rr-auth__paper-next"><span>Next step</span><p>Confirm renewal with provider</p></div>
          </div>
        </div>
        <span className="rr-auth__illustration-label">Illustrative renewal · sample data</span>
        <span className="rr-auth__signature" aria-hidden="true">RenewRelay</span>
        </>}
      </aside>
    </div>
  );
}
