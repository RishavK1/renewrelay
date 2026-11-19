"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "../../../../packages/ui/auth/auth-shell";
import { AuthBack, AuthHeading, AuthNotice, AuthSuccessMark } from "../../../../packages/ui/auth/auth-fields";
import { AuthenticatorSetup, CredentialsForm, EmailForm, ResetPasswordForm, TwoFactorForm } from "../../../../packages/ui/auth/auth-forms";
import { authScreens, type AuthAction, type AuthScreen } from "../../../../packages/ui/auth/contracts";

type Scenario = "normal" | "invalid" | "network" | "rate-limit" | "email-unverified" | "mfa" | "expired" | "reauth";
const scenarios: { value: Scenario; label: string }[] = [
  { value: "normal", label: "Normal preview flow" }, { value: "invalid", label: "Invalid credentials / code" },
  { value: "network", label: "Connection failure" }, { value: "rate-limit", label: "Rate limited (10-second sample)" },
  { value: "email-unverified", label: "Email verification required" }, { value: "mfa", label: "Login requires authenticator" },
  { value: "expired", label: "Expired link / challenge" }, { value: "reauth", label: "Recent login required" },
];
const SAMPLE_KEY = "JBSWY3DPEHPK3PXP";
const SAMPLE_CODES = ["DEMO1-A1B2C", "DEMO2-D3E4F", "DEMO3-G5H6J", "DEMO4-K7M8N", "DEMO5-P9Q2R", "DEMO6-S3T4V", "DEMO7-W5X6Y", "DEMO8-Z7A8B", "DEMO9-C9D2E", "DEMO0-F3G4H"];

function previewDelay(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new Error("Preview cancelled")); return; }
    const abort = () => { window.clearTimeout(timer); reject(new Error("Preview cancelled")); };
    const timer = window.setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 550);
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** Development-only local host. No token parsing, auth client, fetch or storage. */
export function AuthPreview({ screen }: { screen: AuthScreen }) {
  const router = useRouter();
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [revision, setRevision] = useState(0);
  const action: AuthAction = async (command, signal) => {
    await previewDelay(signal);
    if (scenario === "network") throw new Error("Synthetic connection failure");
    if (scenario === "rate-limit") return { status: "error", message: "Too many attempts. Wait a moment before trying again. (Preview)", code: "rate_limited", retryAfterSeconds: 10 };
    if (scenario === "invalid") return { status: "error", message: command.operation.includes("totp") || command.operation === "verify-backup-code" ? "That code isn’t valid. Check it and try again. (Preview)" : "The details couldn’t be verified. Check them and try again. (Preview)" };
    if (scenario === "reauth") return { status: "error", code: "reauthentication_required", message: "Log in again before changing security settings. (Preview)" };
    if (scenario === "expired") return { status: "error", code: command.operation === "reset-password" ? "invalid_token" : "challenge_expired", message: "This link or sign-in request is no longer valid. Start again to continue. (Preview)" };
    if (scenario === "email-unverified" && command.operation === "sign-in") return { status: "success", next: "check-email" };
    switch (command.operation) {
      case "sign-up": return { status: "success", next: "check-email" };
      case "sign-in": return { status: "success", next: scenario === "mfa" ? "two-factor" : "auth-complete" };
      case "verify-totp": case "verify-backup-code": return { status: "success", next: "auth-complete" };
      default: return { status: "success" };
    }
  };
  const props = { action, onNavigate: (next: AuthScreen) => router.push(`/${next}`), preview: true };
  return <>
    <AuthShell screen={screen} preview>
      <div key={`${screen}-${scenario}-${revision}`}>
        {(screen === "login" || screen === "signup") && <CredentialsForm mode={screen} {...props} />}
        {screen === "check-email" && <EmailForm kind="verification" {...props} />}
        {screen === "forgot-password" && <EmailForm kind="reset" {...props} />}
        {screen === "reset-password" && <ResetPasswordForm {...props} invalidLink={scenario === "expired"} />}
        {screen === "two-factor" && <>
          <TwoFactorForm {...props} />
          {(scenario === "expired" || scenario === "reauth") && <a className="rr-auth__text-button" href="/login">Restart sign-in</a>}
        </>}
        {screen === "setup-authenticator" && <AuthenticatorSetup {...props} setupKey={SAMPLE_KEY} recoveryCodes={SAMPLE_CODES} qrImage="/auth-sample-qr.svg" />}
        {screen === "verify-email" && (["network", "rate-limit", "invalid"].includes(scenario) ? <>
          <AuthBack /><AuthHeading title="Verification isn’t complete">{scenario === "network" ? "Check your connection and try the verification link again." : scenario === "rate-limit" ? "There have been too many attempts. Wait a moment before trying again." : "This verification link couldn’t be confirmed. Request another link to continue."}</AuthHeading>
          <AuthNotice error>Preview of an unsuccessful verification. No email address was verified.</AuthNotice>
          <a className="rr-auth__submit" href="/check-email">Request another link</a>
        </> : scenario === "expired" ? <>
          <AuthBack /><AuthHeading title="This link is no longer valid">Request a new verification link to continue.</AuthHeading><a className="rr-auth__submit" href="/check-email">Request another link</a>
        </> : <>
          <AuthSuccessMark /><AuthHeading title="Email verified">Your email is verified. You can now log in.</AuthHeading><AuthNotice>Preview of the verification result. No email address was verified.</AuthNotice><a className="rr-auth__submit" href="/login">Continue to log in</a>
        </>)}
        {screen === "auth-complete" && <>
          <AuthSuccessMark /><AuthHeading title="Ready for your workspace">Choose an existing workspace or create a shared home for your agency’s renewals.</AuthHeading>
          <AuthNotice>UI preview only. You are not signed in, and no workspace or trial has been created.</AuthNotice>
          <p className="rr-auth__hint rr-auth__after-form">Creating a workspace requires authenticator verification. Owner and admin access also requires it.</p>
          <a className="rr-auth__submit rr-auth__after-form" href="/workspaces">Choose workspace</a><a className="rr-auth__text-button" href="/workspace-setup">Create a workspace</a><a className="rr-auth__text-button" href="/setup-authenticator">Preview authenticator setup</a><AuthBack href="/">Return to homepage</AuthBack>
        </>}
      </div>
    </AuthShell>
    <details className="rr-auth__review">
      <summary>Local preview tools</summary>
      <p>Use sample details only. Outcomes are simulated; these controls will not appear in the connected product.</p>
      <div className="rr-auth__review-controls">
        <label htmlFor="preview-scenario">Submission scenario<select id="preview-scenario" value={scenario} onChange={event => setScenario(event.target.value as Scenario)}>{scenarios.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <button className="rr-auth__text-button" type="button" onClick={() => setRevision(previous => previous + 1)}>Reset this screen</button>
      </div>
      <nav aria-label="Authentication preview screens">{authScreens.map(item => <a key={item} href={`/${item}`} aria-current={screen === item ? "page" : undefined}>{item.replaceAll("-", " ")}</a>)}</nav>
    </details>
  </>;
}
