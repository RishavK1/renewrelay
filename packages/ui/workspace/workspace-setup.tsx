"use client";

import { isUnconfirmedResult } from "../decisions/action-policy";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { createWorkspace } from "../../contracts/api";
import { AuthShell } from "../auth/auth-shell";
import { AuthField, AuthHeading, AuthNotice, AuthSuccessMark } from "../auth/auth-fields";
import { NativeSelect, NativeSelectOption, NativeSelectOptGroup } from "../primitives/native-select";
import type { WorkspaceCreateAction, WorkspaceCreateResult, WorkspaceDraft, WorkspaceView } from "./contracts";
import { workspaceTimezones, timezoneDescription } from "./timezones";

type Failure = Extract<WorkspaceCreateResult, { status: "error" }>;
type Props = { action: WorkspaceCreateAction; preview?: boolean; onCreated?: (workspace: WorkspaceView) => void; onContinue?: (workspace: WorkspaceView) => void };
const recoveryText = { login: "Log in again", "check-email": "Verify your email", "setup-authenticator": "Set up authenticator", "two-factor": "Verify authenticator" };

function WorkspaceSummary({ name, timezone }: WorkspaceDraft) {
  return <>
    <p className="rr-auth__aside-label">Workspace preview</p>
    <div className="rr-auth__aside-heading"><h2>Your agency.<br />One shared home.</h2><p>A place for your client renewals, decisions and the work that follows.</p></div>
    <div className="rr-workspace__summary">
      <div className="rr-workspace__identity"><span className="rr-workspace__identity-icon" aria-hidden="true"><Building2 size={24} strokeWidth={1.5} /></span><span>RenewRelay workspace</span></div>
      <h3 title={name.trim() || "Your workspace"}>{name.trim() || "Your workspace"}</h3>
      <dl><div><dt>Timezone</dt><dd>{timezone || "Choose a timezone"}</dd></div><div><dt>Your role after creation</dt><dd>Owner</dd></div></dl>
      <p>Preview of your setup. Your trial begins when the workspace is created.</p>
    </div>
    <p className="rr-workspace__aside-note">Keep the details clear.<br />Give every renewal a next step.</p>
    <span className="rr-auth__signature" aria-hidden="true">RenewRelay</span>
  </>;
}

export function WorkspaceSetup({ action, preview = false, onCreated, onContinue }: Props) {
  const [draft, setDraft] = useState<WorkspaceDraft>({ name: "", timezone: "" });
  const [zones, setZones] = useState<string[]>(["UTC"]);
  const [detection, setDetection] = useState<"detecting" | "detected" | "unavailable" | "selected">("detecting");
  const [offset, setOffset] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof WorkspaceDraft, string>>>({});
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [created, setCreated] = useState<WorkspaceView | null>(null);
  const [retryDraft, setRetryDraft] = useState<WorkspaceDraft | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const request = useRef<AbortController | null>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    let detected = "";
    try { detected = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* Choose explicitly below. */ }
    const valid = createWorkspace.shape.timezone.safeParse(detected).success;
    setZones(workspaceTimezones(valid ? detected : undefined));
    setDraft(previous => ({ ...previous, timezone: valid ? detected : "UTC" }));
    setDetection(valid ? "detected" : "unavailable");
  }, []);
  useEffect(() => { setOffset(timezoneDescription(draft.timezone)); }, [draft.timezone]);
  useEffect(() => {
    if (!retryAt) return;
    const sync = () => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    sync(); const timer = window.setInterval(sync, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);
  const groups = useMemo(() => {
    const grouped = new Map<string, string[]>();
    for (const zone of zones) {
      const region = zone.includes("/") ? zone.split("/")[0]! : "Universal";
      grouped.set(region, [...(grouped.get(region) ?? []), zone]);
    }
    return [...grouped.entries()];
  }, [zones]);
  const blocked = failure?.code === "idempotency_conflict";
  const locked = pending || !!retryDraft || blocked;
  function focusField(field: string) { (form.current?.elements.namedItem(field) as HTMLElement | null)?.focus(); }
  function change(field: keyof WorkspaceDraft, value: string) {
    if (locked) return;
    setDraft(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined }));
    setFailure(null);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current || remaining > 0 || detection === "detecting" || blocked) return;
    const parsed = createWorkspace.safeParse(retryDraft ?? draft);
    if (!parsed.success) {
      const fields: Partial<Record<keyof WorkspaceDraft, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "name") fields.name = draft.name.trim() ? "Use no more than 120 characters." : "Enter a workspace name.";
        if (field === "timezone") fields.timezone = "Select a valid timezone.";
      }
      setErrors(fields); focusField(fields.name ? "name" : "timezone"); return;
    }
    const controller = new AbortController();
    request.current = controller;
    setPending(true); setFailure(null); setErrors({});
    try {
      const result = await action(parsed.data, controller.signal);
      if (controller.signal.aborted) return;
      if (result.status === "success") {
        setRetryDraft(null); setCreated(result.workspace); onCreated?.(result.workspace);
      } else {
        setFailure(result);
        setRetryDraft(isUnconfirmedResult(result.code) ? parsed.data : null);
        if (result.retryAfterSeconds) { setRemaining(result.retryAfterSeconds); setRetryAt(Date.now() + result.retryAfterSeconds * 1000); }
        const fieldErrors = { name: result.fieldErrors?.name?.[0], timezone: result.fieldErrors?.timezone?.[0] };
        setErrors(fieldErrors);
        if (fieldErrors.name || fieldErrors.timezone) window.requestAnimationFrame(() => focusField(fieldErrors.name ? "name" : "timezone"));
      }
    } catch {
      if (!controller.signal.aborted) {
        setRetryDraft(parsed.data);
        setFailure({ status: "error", code: "connection_error", message: "The result couldn’t be confirmed. Retry the same request before changing your details." });
      }
    } finally {
      if (!controller.signal.aborted) { setPending(false); request.current = null; }
    }
  }
  return <AuthShell screen="workspace-setup" preview={preview} previewMessage="Design preview. No workspace or trial is created. Use sample details." asideContent={<WorkspaceSummary {...(created ?? draft)} />}>
    {created ? <>
      <AuthSuccessMark /><AuthHeading title={preview ? "Your setup looks good" : "Your workspace is ready"}>{preview ? "Here’s a preview of your workspace details." : "Your agency now has a shared home for its renewals."}</AuthHeading>
      {preview && <AuthNotice>No workspace or trial was created. This is a UI preview.</AuthNotice>}
      <dl className="rr-workspace__result"><div><dt>Workspace name</dt><dd>{created.name}</dd></div><div><dt>Timezone</dt><dd>{created.timezone}</dd></div><div><dt>Your role</dt><dd>{created.role === "owner" ? "Owner" : created.role}</dd></div></dl>
      {preview && <><button type="button" className="rr-auth__submit rr-auth__after-form" onClick={() => onContinue?.(created)} disabled={!onContinue}>Preview your workspace</button><Link className="rr-auth__text-button" href="/workspaces">Choose another workspace</Link><button className="rr-auth__text-button" type="button" onClick={() => setCreated(null)}>Back to setup preview</button><a className="rr-auth__text-button" href="/auth-complete">Back to account preview</a></>}
    </> : <>
      <p className="rr-workspace__intro-label">Workspace setup</p>
      <AuthHeading title="Create your workspace">Give your agency’s renewals a shared home. Start with a name and the timezone your team works in.</AuthHeading>
      <form ref={form} className="rr-auth__form" onSubmit={submit} noValidate aria-busy={pending}>
        <AuthField label="Workspace name" id="workspace-name" name="name" value={draft.name} readOnly={locked} maxLength={120} autoComplete="organization" placeholder="e.g. Northline Studio" hint="Use your agency or team name. You’ll be the workspace owner." error={errors.name} onChange={event => change("name", event.target.value)} required />
        <div className="rr-auth__field">
          <div className="rr-auth__label-row"><label htmlFor="workspace-timezone">Timezone</label>{detection === "detected" && <span className="rr-workspace__detected">Detected from your device</span>}</div>
          <NativeSelect id="workspace-timezone" name="timezone" value={draft.timezone} onChange={event => { change("timezone", event.target.value); setDetection("selected"); }} disabled={locked || detection === "detecting"} required aria-invalid={errors.timezone ? true : undefined} aria-describedby={`workspace-timezone-hint${errors.timezone ? " workspace-timezone-error" : ""}`}>
            <NativeSelectOption value="" disabled>{detection === "detecting" ? "Detecting your timezone…" : "Choose a timezone"}</NativeSelectOption>
            {groups.map(([region, values]) => <NativeSelectOptGroup key={region} label={region}>{values.map(zone => <NativeSelectOption key={zone} value={zone}>{zone.replaceAll("_", " ")}</NativeSelectOption>)}</NativeSelectOptGroup>)}
          </NativeSelect>
          <p className="rr-auth__hint" id="workspace-timezone-hint">{detection === "detecting" ? "Checking your device setting." : <>{offset}{detection === "unavailable" && ". Detection wasn’t available; UTC is selected. Choose your team’s timezone."}<br />Used for your workspace’s renewal dates and reminders.</>}</p>
          {errors.timezone && <p className="rr-auth__field-error" id="workspace-timezone-error">{errors.timezone}</p>}
        </div>
        <div className="rr-workspace__trial"><span>Your trial starts here</span><p><strong>14 days</strong> to get your renewal process in place.</p><ul><li>10 renewal items</li><li>3 team seats</li></ul></div>
        {failure && <AuthNotice error>{failure.message}{failure.recovery && <a className="rr-auth__notice-link" href={`/${failure.recovery}`}>{recoveryText[failure.recovery]}</a>}{blocked && <a className="rr-auth__notice-link" href="/auth-complete">Return to your account</a>}</AuthNotice>}
        <button className="rr-auth__submit" type="submit" disabled={pending || remaining > 0 || detection === "detecting" || blocked}>{pending ? <><span className="rr-auth__spinner" aria-hidden="true" />Creating workspace…</> : remaining > 0 ? `Try again in ${remaining}s` : retryDraft ? "Retry workspace request" : "Create workspace"}</button>
        <p className="rr-workspace__security-note">Workspace creation requires an authenticator-verified session. Your trial begins only after successful creation.</p>
      </form>
    </>}
  </AuthShell>;
}
