"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Copy, Download } from "lucide-react";
import { AuthBack, AuthField, AuthHeading, AuthNotice, AuthSuccessMark, PasswordField } from "./auth-fields";
import { passwordRule, type AuthAction, type AuthCommand, type AuthResult, type AuthScreen } from "./contracts";

type Props = { action: AuthAction; onNavigate: (screen: AuthScreen) => void; preview?: boolean };
type Errors = Record<string, string>;

function useSubmission(action: AuthAction, onNavigate: Props["onNavigate"]) {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<AuthResult | null>(null);
  const [retryUntil, setRetryUntil] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!retryUntil) return;
    const sync = () => setRemaining(Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000)));
    sync();
    const interval = window.setInterval(sync, 1000);
    return () => window.clearInterval(interval);
  }, [retryUntil]);
  async function submit(command: AuthCommand): Promise<boolean> {
    if (request.current || remaining > 0) return false;
    const controller = new AbortController();
    request.current = controller;
    setPending(true); setNotice(null);
    try {
      const result = await action(command, controller.signal);
      if (controller.signal.aborted) return false;
      if (result.status === "error" && result.retryAfterSeconds) {
        setRemaining(result.retryAfterSeconds);
        setRetryUntil(Date.now() + result.retryAfterSeconds * 1000);
      }
      setNotice(result);
      if (result.status === "success" && result.next) onNavigate(result.next);
      return result.status === "success";
    } catch {
      if (!controller.signal.aborted) setNotice({ status: "error", message: "We couldn’t complete that request. Check your connection and try again." });
      return false;
    } finally {
      if (!controller.signal.aborted) { setPending(false); request.current = null; }
    }
  }
  return { pending, notice, remaining, submit, clearNotice: () => setNotice(null) };
}

function Form({ children, onSubmit, pending }: { children: ReactNode; onSubmit: (values: FormData, form: HTMLFormElement) => void; pending: boolean }) {
  function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending) onSubmit(new FormData(event.currentTarget), event.currentTarget);
  }
  return <form className="rr-auth__form" onSubmit={handle} noValidate aria-busy={pending}>{children}</form>;
}
function read(values: FormData, field: string) { return String(values.get(field) ?? ""); }
function validate(values: FormData, mode: "login" | "signup" | "reset" | "email"): Errors {
  const errors: Errors = {};
  if (mode !== "reset") {
    const email = read(values, "email").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
  }
  if (mode === "signup" && !read(values, "name").trim()) errors.name = "Enter your full name.";
  if (mode !== "email") {
    const password = read(values, "password");
    if (!password) errors.password = "Enter your password.";
    else if (mode !== "login" && (password.length < passwordRule.min || password.length > passwordRule.max)) errors.password = "Use between 12 and 128 characters.";
    if (mode === "reset" && read(values, "confirmPassword") !== password) errors.confirmPassword = "The passwords don’t match.";
  }
  return errors;
}
function showErrors(errors: Errors, form: HTMLFormElement, setErrors: (errors: Errors) => void) {
  setErrors(errors);
  const first = Object.keys(errors)[0];
  if (first) (form.elements.namedItem(first) as HTMLInputElement | null)?.focus();
  return !!first;
}
function SubmissionNotice({ state }: { state: ReturnType<typeof useSubmission> }) {
  if (state.notice?.status !== "error") return null;
  return <AuthNotice error>{state.notice.message}
    {state.notice.code === "reauthentication_required" && <a className="rr-auth__notice-link" href="/login">Log in again</a>}
    {state.notice.code === "invalid_token" && <a className="rr-auth__notice-link" href="/forgot-password">Request a new reset link</a>}
  </AuthNotice>;
}
function Submit({ state, children }: { state: ReturnType<typeof useSubmission>; children: ReactNode }) {
  return <button className="rr-auth__submit" type="submit" disabled={state.pending || state.remaining > 0}>
    {state.pending ? <><span className="rr-auth__spinner" aria-hidden="true" />Please wait…</> : state.remaining > 0 ? `Try again in ${state.remaining}s` : children}
  </button>;
}

export function CredentialsForm({ mode, ...props }: Props & { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  const state = useSubmission(props.action, props.onNavigate);
  const [errors, setErrors] = useState<Errors>({});
  const clear = (name: string) => { setErrors(previous => ({ ...previous, [name]: "" })); state.clearNotice(); };
  return <>
    <AuthHeading title={signup ? "Create your account" : "Welcome back"}>{signup ? "Bring your client renewals into one clear workspace." : "Log in to your RenewRelay account."}</AuthHeading>
    <Form pending={state.pending} onSubmit={async (values, form) => {
      if (showErrors(validate(values, mode), form, setErrors)) return;
      const credentials = { email: read(values, "email").trim(), password: read(values, "password") };
      const success = await state.submit(signup ? { operation: "sign-up", name: read(values, "name").trim(), ...credentials } : { operation: "sign-in", ...credentials });
      if (success) form.reset();
    }}>
      {signup && <AuthField label="Full name" id="name" name="name" autoComplete="name" placeholder="Your full name" required error={errors.name} onChange={() => clear("name")} />}
      <AuthField label="Email address" id="email" name="email" type="email" autoComplete={signup ? "email" : "username"} inputMode="email" autoCapitalize="none" spellCheck={false} placeholder="you@youragency.com" required error={errors.email} onChange={() => clear("email")} />
      <PasswordField label="Password" name="password" autoComplete={signup ? "new-password" : "current-password"} required hint={signup ? "Use 12–128 characters. A longer passphrase works well." : undefined} error={errors.password} onChange={() => clear("password")} />
      {!signup && <a className="rr-auth__forgot-link" href="/forgot-password">Forgot password?</a>}
      <SubmissionNotice state={state} />
      <Submit state={state}>{signup ? "Create account" : "Log in"}</Submit>
    </Form>
    {signup && <p className="rr-auth__trial-note">Your 14-day trial begins when you create a workspace.</p>}
    <p className="rr-auth__switch">{signup ? "Already have an account?" : "New to RenewRelay?"} <a href={signup ? "/login" : "/signup"}>{signup ? "Log in" : "Create an account"}</a></p>
  </>;
}

export function EmailForm({ kind, ...props }: Props & { kind: "verification" | "reset" }) {
  const verification = kind === "verification";
  const state = useSubmission(props.action, props.onNavigate);
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState(false);
  const [recipient, setRecipient] = useState("");
  if (sent) return <>
    <AuthBack />
    <AuthSuccessMark />
    <AuthHeading title="Check your inbox">{verification ? "If this address needs verification, a new link will be sent to:" : "If an account exists for this address, a password reset link will be sent to:"}</AuthHeading>
    <p className="rr-auth__recipient">{recipient}</p>
    {props.preview && <AuthNotice>Preview only. No email was sent.</AuthNotice>}
    <p className="rr-auth__hint">Check your spam folder too. Use the link in the email to continue.</p>
    <button className="rr-auth__submit rr-auth__after-form" type="button" onClick={() => { setSent(false); state.clearNotice(); }}>Request another link</button>
  </>;
  return <>
    <AuthBack />
    <AuthHeading title={verification ? "Check your email" : "Reset your password"}>{verification ? "Open the verification link in your email to continue. You can request another link below." : "Enter your account’s email address and we’ll help you get back in."}</AuthHeading>
    <Form pending={state.pending} onSubmit={async (values, form) => {
      if (showErrors(validate(values, "email"), form, setErrors)) return;
      setSent(false);
      const email = read(values, "email").trim();
      if (await state.submit({ operation: verification ? "send-verification" : "request-reset", email })) { setRecipient(email); setSent(true); }
    }}>
      <AuthField label="Email address" name="email" id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required placeholder="you@youragency.com" defaultValue={recipient} error={errors.email} onChange={() => { setErrors({}); state.clearNotice(); }} />
      <SubmissionNotice state={state} />
      <Submit state={state}>{verification ? "Resend verification email" : "Send reset link"}</Submit>
    </Form>
    <p className="rr-auth__hint rr-auth__after-form">Check your spam folder if the email doesn’t appear.</p>
    {verification && <p className="rr-auth__switch">Used another address? <a href="/signup">Back to signup</a></p>}
  </>;
}

export function ResetPasswordForm(props: Props & { invalidLink?: boolean }) {
  const state = useSubmission(props.action, props.onNavigate);
  const [errors, setErrors] = useState<Errors>({});
  const [saved, setSaved] = useState(false);
  if (props.invalidLink) return <><AuthBack /><AuthHeading title="This link has expired">Request a new password reset link to continue.</AuthHeading><a className="rr-auth__submit" href="/forgot-password">Request another link</a></>;
  if (saved) return <><AuthSuccessMark /><AuthHeading title="Password updated">Log in with your new password to continue.</AuthHeading>{props.preview && <AuthNotice>Preview only. No password was changed.</AuthNotice>}<a className="rr-auth__submit" href="/login">Continue to log in</a></>;
  return <><AuthBack /><AuthHeading title="Choose a new password">Use a password you haven’t used for this account before.</AuthHeading>
    <Form pending={state.pending} onSubmit={async (values, form) => {
      if (showErrors(validate(values, "reset"), form, setErrors)) return;
      if (await state.submit({ operation: "reset-password", newPassword: read(values, "password") })) { form.reset(); setSaved(true); }
    }}>
      <PasswordField label="New password" id="password" name="password" autoComplete="new-password" required hint="Use between 12 and 128 characters." error={errors.password} onChange={() => { setErrors(previous => ({ ...previous, password: "", confirmPassword: "" })); state.clearNotice(); }} />
      <PasswordField label="Confirm new password" id="confirmPassword" name="confirmPassword" autoComplete="new-password" required error={errors.confirmPassword} onChange={() => { setErrors(previous => ({ ...previous, confirmPassword: "" })); state.clearNotice(); }} />
      <SubmissionNotice state={state} /><Submit state={state}>Save password</Submit>
    </Form></>;
}

export function TwoFactorForm(props: Props & { enrollment?: boolean; onVerified?: () => void }) {
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState("");
  const state = useSubmission(props.action, props.enrollment ? () => {} : props.onNavigate);
  return <>
    {!props.enrollment && <AuthBack />}
    <AuthHeading title={props.enrollment ? "Confirm your authenticator" : recovery ? "Use a recovery code" : "Verify it’s you"}>
      {recovery ? "Enter one of the recovery codes you saved when setting up your authenticator. Each code works once." : "Enter the 6-digit code from your authenticator app."}
    </AuthHeading>
    <Form key={recovery ? "recovery" : "totp"} pending={state.pending} onSubmit={async (values, form) => {
      const code = read(values, "code").trim();
      if (recovery ? !code : !/^\d{6}$/.test(code)) { setError(recovery ? "Enter a recovery code." : "Enter the 6-digit authenticator code."); (form.elements.namedItem("code") as HTMLInputElement)?.focus(); return; }
      setError("");
      if (await state.submit({ operation: recovery ? "verify-backup-code" : "verify-totp", code })) { form.reset(); if (props.enrollment) props.onVerified?.(); }
    }}>
      <AuthField label={recovery ? "Recovery code" : "Authenticator code"} id="code" name="code" className={recovery ? "rr-auth__recovery-input" : "rr-auth__code"} type="text" inputMode={recovery ? "text" : "numeric"} autoComplete={recovery ? "off" : "one-time-code"} autoCapitalize="none" spellCheck={false} placeholder={recovery ? "Enter your recovery code" : "000000"} required hint={recovery ? "You can paste a complete recovery code." : "Codes change regularly. Use the current code shown in your app."} error={error} onChange={() => { setError(""); state.clearNotice(); }} />
      <SubmissionNotice state={state} /><Submit state={state}>{props.enrollment ? "Confirm authenticator" : "Verify and continue"}</Submit>
    </Form>
    {!props.enrollment && <button className="rr-auth__text-button" type="button" disabled={state.pending} onClick={() => { setRecovery(!recovery); setError(""); state.clearNotice(); }}>{recovery ? "Use an authenticator code" : "Use a recovery code"}</button>}
  </>;
}

/** Synthetic enrollment material is explicitly supplied by the preview host.
 * In the real app this is ephemeral adapter data, never a bundled fixture.
 */
function EnrollmentProgress({ step }: { step: number }) {
  return <div className="rr-auth__progress" aria-label={`Authenticator setup, step ${step} of 4`}>
    <ol>{["Confirm password", "Add account", "Verify code", "Save codes"].map((label, index) => <li key={label} aria-current={index + 1 === step ? "step" : undefined} data-complete={index + 1 < step}><span className="rr-auth__sr-only">{label}</span></li>)}</ol>
    <p>Step {step} of 4 <span>{["Confirm password", "Add account", "Verify code", "Save codes"][step - 1]}</span></p>
  </div>;
}

export function AuthenticatorSetup(props: Props & { setupKey: string; recoveryCodes: readonly string[]; qrImage?: string }) {
  const [step, setStep] = useState<"password" | "setup" | "verify" | "save">("password");
  const [passwordError, setPasswordError] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const state = useSubmission(props.action, () => {});
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopyMessage("Copied to clipboard."); }
    catch { setCopyMessage("Couldn’t copy. Select and copy the text below instead."); }
  }
  function moveTo(next: typeof step) { setCopyMessage(""); setStep(next); }
  if (step === "verify") return <><EnrollmentProgress step={3} /><button className="rr-auth__text-button rr-auth__back" type="button" onClick={() => moveTo("setup")}>Back to setup key</button><TwoFactorForm {...props} enrollment onVerified={() => moveTo("save")} /></>;
  if (step === "save") return <>
    <EnrollmentProgress step={4} /><AuthHeading title="Save your recovery codes">Keep these somewhere safe. You can use a code if you lose access to your authenticator. Each code works once.</AuthHeading>
    {props.preview && <AuthNotice>Sample codes for this preview. They cannot access any account.</AuthNotice>}
    <div className="rr-auth__codes" aria-label="Recovery codes">{props.recoveryCodes.map(code => <code key={code}>{code}</code>)}</div>
    <div className="rr-auth__code-actions">
      <button type="button" onClick={() => copy(props.recoveryCodes.join("\n"))}><Copy size={16} aria-hidden="true" />Copy codes</button>
      <button type="button" onClick={() => {
        try {
          const url = URL.createObjectURL(new Blob([`${props.preview ? "RENEWRELAY PREVIEW — SAMPLE CODES ONLY\n" : "RenewRelay recovery codes\n"}${props.recoveryCodes.join("\n")}`], { type: "text/plain" }));
          const link = document.createElement("a"); link.href = url; link.download = props.preview ? "renewrelay-sample-codes.txt" : "renewrelay-recovery-codes.txt";
          document.body.appendChild(link);
          try { link.click(); setCopyMessage("Download requested. Check your downloads before continuing."); }
          finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
        } catch { setCopyMessage("Couldn’t download. Copy the codes or select and save the text instead."); }
      }}><Download size={16} aria-hidden="true" />Download</button>
    </div>
    <p className="rr-auth__hint" role="status">{copyMessage}</p>
    <label className="rr-auth__checkbox"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />I’ve saved my recovery codes</label>
    <button className="rr-auth__submit" type="button" disabled={!acknowledged} onClick={() => props.onNavigate("auth-complete")}>Continue</button>
  </>;
  if (step === "setup") return <>
    <EnrollmentProgress step={2} /><AuthHeading title="Add to your authenticator">{props.qrImage ? "Scan the QR code with your authenticator app, or enter the setup key manually using time-based codes." : "In your authenticator app, add an account with the setup key below. Choose time-based codes."}</AuthHeading>
    {props.preview && <AuthNotice>Sample setup key only. No authenticator is connected to an account in this preview.</AuthNotice>}
    {props.qrImage && <div className="rr-auth__qr"><img src={props.qrImage} width={184} height={184} alt={props.preview ? "Sample authenticator QR code for the UI preview" : "Scan to add RenewRelay to your authenticator app"} /><span>{props.preview ? "Sample QR · no account connection" : "Scan with your authenticator app"}</span></div>}
    <ol className="rr-auth__steps"><li>Open your authenticator app and add an account.</li><li>Scan the code, or enter “RenewRelay” and the setup key below.</li><li>Return here to confirm the code.</li></ol>
    <div className="rr-auth__setup-key"><span>Manual setup key</span><code>{props.setupKey}</code><button type="button" onClick={() => copy(props.setupKey)}><Copy size={16} aria-hidden="true" />Copy setup key</button></div>
    <p className="rr-auth__hint" role="status">{copyMessage}</p>
    <button className="rr-auth__submit" type="button" onClick={() => moveTo("verify")}>I’ve added the account</button>
  </>;
  return <><AuthBack /><EnrollmentProgress step={1} /><AuthHeading title="Add an authenticator">Add an extra step to protect your account. It’s required to create a workspace and for owner or admin access.</AuthHeading>
    <Form pending={state.pending} onSubmit={async (values, form) => {
      const password = read(values, "password");
      if (!password) { setPasswordError("Enter your current password."); (form.elements.namedItem("password") as HTMLInputElement)?.focus(); return; }
      if (await state.submit({ operation: "enable-totp", password })) { form.reset(); moveTo("setup"); }
    }}>
      <PasswordField label="Confirm your password" name="password" autoComplete="current-password" required error={passwordError} onChange={() => { setPasswordError(""); state.clearNotice(); }} />
      <SubmissionNotice state={state} /><Submit state={state}>Set up authenticator</Submit>
    </Form></>;
}
