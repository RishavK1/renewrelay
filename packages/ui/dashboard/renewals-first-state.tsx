"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, LockKeyhole, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import type { DashboardState } from "./contracts";
import Link from "next/link";

function ClientOutline() {
  return <svg className="rr-dashboard__empty-illustration" viewBox="0 0 224 164" fill="none" aria-hidden="true">
    <rect x="48" y="17" width="134" height="126" rx="16" fill="#EEF5FC" stroke="#D5E3EF" transform="rotate(7 115 80)" />
    <rect x="27" y="31" width="150" height="116" rx="16" fill="#FCFBF8" stroke="#B6CBDD" />
    <rect x="43" y="48" width="39" height="39" rx="12" fill="#C3DFFE" />
    <circle cx="62.5" cy="61.5" r="5" stroke="#365878" strokeWidth="1.5" />
    <path d="M53.5 78v-2a9 9 0 0 1 18 0v2" stroke="#365878" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M95 58h47M95 73h30M44 105h115M44 119h74" stroke="#B6CBDD" strokeWidth="3" strokeLinecap="round" />
    <circle cx="175" cy="124" r="20" fill="#071A31" stroke="#FFFFFF" strokeWidth="5" />
    <path d="M175 117v14M168 124h14" stroke="#C3DFFE" strokeWidth="1.8" strokeLinecap="round" />
  </svg>;
}

const authCopy = {
  session: { title: "Log in to continue", detail: "Your session has expired. Sign in again to open this workspace.", action: "Log in again" },
  email: { title: "Verify your email first", detail: "Confirm your email address before opening your workspace.", action: "Verify email" },
  mfa: { title: "Verify your sign-in", detail: "Owner and admin access requires a verified authenticator session.", action: "Continue verification" },
};

export function RenewalsFirstState({ state, preview = false, onAddClient, onRetry, importHref }: { state: DashboardState; preview?: boolean; onAddClient?: () => void; onRetry?: () => void; importHref?: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [state.kind]);
  return <>
    <div className="rr-dashboard__page-heading"><h1 ref={heading} tabIndex={-1}>Renewals</h1><p>Keep client renewals and next steps in one place.</p></div>
    <section className="rr-dashboard__state" aria-labelledby="renewals-state-title" aria-live="polite" aria-busy={state.kind === "loading"}>
      {state.kind === "new-workspace" && <>
        <ClientOutline /><h2 id="renewals-state-title">Start with your first client</h2><p>Add a client, then track the services your agency manages for them.</p>
        {state.canCreateClient ? <>
          <button className="rr-dashboard__primary" type="button" disabled={!onAddClient} aria-describedby={!onAddClient && preview ? "client-preview-note" : undefined} onClick={onAddClient}><Plus size={18} aria-hidden="true" />Add your first client</button>
          {!onAddClient && preview && <span id="client-preview-note" className="rr-dashboard__action-note">Client form comes next in this preview.</span>}
        </> : <p className="rr-dashboard__state-note">You can view workspace records. Adding clients requires write access.</p>}
      </>}
      {state.kind === "loading" && <div role="status" className="rr-dashboard__loading"><span className="rr-dashboard__loading-mark" aria-hidden="true" /><h2 id="renewals-state-title">Loading your workspace</h2><p>Getting your workspace and renewal access ready.</p></div>}
      {state.kind === "error" && <><span className="rr-dashboard__state-icon" aria-hidden="true"><RefreshCw size={25} /></span><h2 id="renewals-state-title">Your workspace couldn’t load</h2><p>Check your connection and try again. Your records haven’t been changed.</p>{onRetry && <button className="rr-dashboard__primary" type="button" onClick={onRetry}>Try again</button>}</>}
      {state.kind === "auth-required" && <><span className="rr-dashboard__state-icon" aria-hidden="true"><ShieldCheck size={26} strokeWidth={1.5} /></span><h2 id="renewals-state-title">{authCopy[state.reason].title}</h2><p>{authCopy[state.reason].detail}</p><a className="rr-dashboard__primary" href={state.recoveryHref}>{authCopy[state.reason].action}<ArrowRight size={17} aria-hidden="true" /></a></>}
      {state.kind === "read-only" && <><span className="rr-dashboard__state-icon" aria-hidden="true"><LockKeyhole size={25} strokeWidth={1.5} /></span><h2 id="renewals-state-title">This workspace is read-only</h2><p>Existing records can be read and exported. Creating clients and updating renewals are currently unavailable.</p><p className="rr-dashboard__state-note">A workspace owner can review subscription access.</p></>}
      {state.kind === "unavailable" && <><span className="rr-dashboard__state-icon" aria-hidden="true"><LockKeyhole size={25} strokeWidth={1.5} /></span><h2 id="renewals-state-title">This workspace isn’t available</h2><p>The workspace may no longer be available to your account. Check with your workspace owner.</p></>}
      {state.kind === "deleting" && <><h2 id="renewals-state-title">Workspace scheduled for deletion</h2><p>Operational access is closed while this workspace is scheduled for deletion.</p><p className="rr-dashboard__state-note">The workspace owner can review its deletion and billing status.</p></>}
      {state.kind === "existing-clients" && <><ClientOutline /><h2 id="renewals-state-title">Set up your first renewal</h2><p>Choose a client and record the services your agency manages for them.</p><Link className="rr-dashboard__primary" href="/renewals/new">Add renewal</Link></>}
      {importHref && (state.kind === "existing-clients" || state.kind === "new-workspace" && state.canCreateClient) && <div className="rr-dashboard__actions"><Link className="rr-clients__outline-action" href={importHref}>Import CSV</Link></div>}
    </section>
  </>;
}
