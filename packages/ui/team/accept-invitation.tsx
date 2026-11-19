"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AuthHeading, AuthNotice, AuthSuccessMark } from "../auth/auth-fields";
import { AuthShell } from "../auth/auth-shell";
import { useDecisionAction } from "../decisions/use-preview-action";
import type { AcceptTeamAction } from "./contracts";

type Account = { email: string; emailVerified: boolean; mfaRequired: boolean; mfaVerified: boolean };
export function AcceptTeamInvitation({ account, action, unavailable = false, preview = false }: { account: Account | null; action: AcceptTeamAction; unavailable?: boolean; preview?: boolean }) {
  const [accepted, setAccepted] = useState<Extract<Awaited<ReturnType<AcceptTeamAction>>, { status: "success" }> | null>(null);
  const heading = useRef<HTMLDivElement>(null);
  const state = useDecisionAction((_command: "accept", signal) => action(signal));
  const terminal = !!state.failure && ["not_found", "invite_unavailable", "already_member", "forbidden", "workspace_deleting", "idempotency_conflict", "unauthenticated", "email_unverified", "mfa_required"].includes(state.failure.code);
  const recovery = !account || state.failure?.code === "unauthenticated" ? "/login" : !account.emailVerified || state.failure?.code === "email_unverified" ? "/check-email" : account.mfaRequired && !account.mfaVerified || state.failure?.code === "mfa_required" ? "/two-factor" : null;
  useEffect(() => { heading.current?.querySelector<HTMLHeadingElement>("h1")?.focus({ preventScroll: true }); }, [accepted, unavailable]);
  async function accept() {
    if (unavailable || recovery || terminal || state.pending) return;
    const result = await state.run("accept");
    if (result?.status === "success") setAccepted(result);
  }
  return <AuthShell screen="accept-invitation" preview={preview} previewMessage="Invitation UI preview. No real invitation or membership is changed." asideContent={<>
      <p className="rr-auth__aside-label">Work moves better together.</p>
      <div className="rr-auth__aside-heading"><h2>One team.<br />Clear ownership.</h2><p>Keep renewal decisions and follow-through with the right people.</p></div>
      <div className="rr-team-accept__roles"><div><strong>Owner</strong><p>Oversee the workspace and its ownership.</p></div><div><strong>Admin</strong><p>Manage team access and renewal work.</p></div><div><strong>Member</strong><p>Work with clients and keep renewals moving.</p></div></div>
      <span className="rr-auth__signature" aria-hidden="true">RenewRelay</span>
    </>}>
    <div ref={heading} className="rr-team-accept">
      {accepted ? <><AuthSuccessMark /><AuthHeading title={preview ? "Invitation preview accepted" : "You’ve joined the workspace"}>Your membership is ready. Open the workspace to continue.</AuthHeading><AuthNotice>{preview ? "Only the sample invitation was accepted. You are not signed in to a real workspace." : "You now have access with the role assigned by the workspace manager."}</AuthNotice>{accepted.role !== "member" && !account?.mfaVerified ? <><p className="rr-auth__hint">Admin workspace access requires authenticator verification.</p><Link className="rr-auth__submit rr-auth__after-form" href="/setup-authenticator">Set up authenticator</Link></> : <Link className="rr-auth__submit rr-auth__after-form" href="/dashboard">Continue to workspace</Link>}</> : <>
        <AuthHeading title={unavailable ? "This invitation isn’t available" : "Join your team"}>{unavailable ? "Ask the workspace owner or an admin for a new invitation." : "Accept the invitation using the account with the email address it was sent to."}</AuthHeading>
        {!unavailable && <>
          {account && <div className="rr-team-accept__account"><span>Signed in as</span><strong>{account.email}</strong></div>}
          {recovery ? <><AuthNotice>{recovery === "/login" ? "Sign in with the invited email, then reopen this invitation from your email." : recovery === "/check-email" ? "Verify your email before accepting this invitation. Reopen it once verification is complete." : "Verify your authenticator session before accepting this invitation."}</AuthNotice><Link href={recovery} className="rr-auth__submit">{recovery === "/login" ? "Sign in to continue" : recovery === "/check-email" ? "Verify email" : "Verify authenticator"}</Link>{!account && <p className="rr-auth__switch">New to RenewRelay? <Link href="/signup">Create an account</Link></p>}</> : <><p className="rr-team-accept__hint">Workspace details are confirmed when the invitation is accepted. Nothing changes until you confirm.</p><button type="button" className="rr-auth__submit" onClick={accept} disabled={state.pending || terminal || state.remaining > 0}>{state.pending ? "Accepting…" : state.remaining > 0 ? `Try again in ${state.remaining}s` : state.frozen ? "Retry original acceptance" : preview ? "Accept invitation preview" : "Accept invitation"}</button></>}
          {state.failure && <AuthNotice error>{state.failure.message}{state.frozen && <p>The original acceptance is held for retry. Don’t start a different request while its result is unknown.</p>}{state.failure.code === "not_found" && <p>Use the account this invitation was sent to, or ask the manager for a new invitation. Invitation details are not shown to other accounts.</p>}{state.failure.code === "already_member" && <Link className="rr-auth__notice-link" href="/dashboard">Open workspace</Link>}</AuthNotice>}
        </>}
        <Link href="/" className="rr-auth__back rr-auth__after-form">Return to homepage</Link>
      </>}
    </div>
  </AuthShell>;
}
