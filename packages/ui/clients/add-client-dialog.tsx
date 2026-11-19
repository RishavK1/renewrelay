"use client";

import { isUnconfirmedResult } from "../decisions/action-policy";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, X } from "lucide-react";
import { createClient } from "../../contracts/api";
import { AuthField, AuthNotice } from "../auth/auth-fields";
import type { ClientCreateAction, ClientCreateResult, ClientDraft, ClientView } from "./contracts";

type Props = {
  open: boolean;
  workspace: { id: string; name: string };
  canCreateClient: boolean;
  action: ClientCreateAction;
  onClose: () => void;
  onCreated: (client: ClientView) => void;
  preview?: boolean;
};
type Failure = Extract<ClientCreateResult, { status: "error" }>;
const recoveryLabel = { "/login": "Log in again", "/check-email": "Verify email", "/two-factor": "Verify authenticator", "/setup-authenticator": "Set up authenticator" };

export function AddClientDialog({ open, workspace, canCreateClient, action, onClose, onCreated, preview = false }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const successHeading = useRef<HTMLHeadingElement>(null);
  const returnTarget = useRef<HTMLElement | null>(null);
  const request = useRef<AbortController | null>(null);
  const [name, setName] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<ClientView | null>(null);
  const [retryDraft, setRetryDraft] = useState<ClientDraft | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  function focusName() { (form.current?.elements.namedItem("name") as HTMLInputElement | null)?.focus(); }
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open) {
      if (!element.open) { returnTarget.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; element.showModal(); }
      if (created) successHeading.current?.focus(); else focusName();
    } else if (element.open) element.close();
  }, [open, created]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  useEffect(() => {
    if (!retryAt) return;
    const sync = () => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    sync(); const timer = window.setInterval(sync, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);
  const conflict = failure?.code === "idempotency_conflict";
  const accessBlocked = !!failure && ["workspace_read_only", "workspace_deleting", "forbidden", "not_found", "unauthenticated", "email_unverified", "mfa_required"].includes(failure.code);
  const locked = pending || !!retryDraft || conflict || accessBlocked || !canCreateClient;
  function close() { if (!request.current) dialog.current?.close(); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current || remaining > 0 || conflict || accessBlocked || !canCreateClient) return;
    const parsed = createClient.safeParse(retryDraft ?? { name });
    if (!parsed.success) { setFieldError(name.trim() ? "Use no more than 120 characters." : "Enter a client name."); focusName(); return; }
    const controller = new AbortController(); request.current = controller;
    setPending(true); setFailure(null); setFieldError("");
    try {
      const result = await action(parsed.data, controller.signal);
      if (controller.signal.aborted) return;
      if (result.status === "success") {
        setCreated(result.client); setRetryDraft(null); onCreated(result.client);
      } else {
        setFailure(result); setRetryDraft(isUnconfirmedResult(result.code) ? parsed.data : null);
        const message = result.fieldErrors?.name?.[0];
        if (message) { setFieldError(message); window.requestAnimationFrame(focusName); }
        if (result.retryAfterSeconds) { setRemaining(result.retryAfterSeconds); setRetryAt(Date.now() + result.retryAfterSeconds * 1000); }
      }
    } catch {
      if (!controller.signal.aborted) {
        setRetryDraft(parsed.data);
        setFailure({ status: "error", code: "connection_error", message: "The result couldn’t be confirmed. Retry the same request before changing the client name." });
      }
    } finally { if (!controller.signal.aborted) { request.current = null; setPending(false); } }
  }
  return <dialog ref={dialog} className="rr-client-dialog" aria-labelledby="add-client-title" aria-describedby="add-client-description" onCancel={event => { if (request.current) event.preventDefault(); }} onClose={() => {
    if (open) onClose();
    const target = returnTarget.current;
    window.requestAnimationFrame(() => {
      if (target?.isConnected && !target.hasAttribute("disabled")) target.focus();
      else document.querySelector<HTMLElement>(".rr-dashboard__page-heading h1")?.focus();
    });
    if (created) { setCreated(null); setName(""); setFailure(null); }
  }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  }}>
    <button className="rr-client-dialog__close rr-dashboard__icon-button" type="button" disabled={pending} onClick={close} aria-label="Close add client"><X size={20} aria-hidden="true" /></button>
    {created ? <>
      <span className="rr-client-dialog__success" aria-hidden="true"><Check size={25} strokeWidth={1.7} /></span>
      <h2 ref={successHeading} tabIndex={-1} id="add-client-title">{preview ? "Client preview ready" : "Client added"}</h2>
      <p id="add-client-description">{preview ? "Here’s how the client confirmation will look." : "Your client is ready for the services you manage for them."}</p>
      <div className="rr-client-dialog__result"><span>Client name</span><strong>{created.name}</strong></div>
      {preview && <AuthNotice>No real client was created. This result exists only in the local preview.</AuthNotice>}
      <button className="rr-client-dialog__submit" type="button" onClick={close}>Done</button>
    </> : <>
      <p className="rr-client-dialog__workspace" title={workspace.name}>{workspace.name}</p>
      <h2 id="add-client-title">Add a client</h2>
      <p id="add-client-description">Start with their name. You can add contacts and renewal details in separate steps.</p>
      <form ref={form} onSubmit={submit} noValidate aria-busy={pending}>
        <AuthField label="Client name" id="client-name" name="name" value={name} onChange={event => { if (!locked) { setName(event.target.value); setFieldError(""); setFailure(null); } }} readOnly={locked} maxLength={120} autoComplete="off" placeholder="e.g. Acme Studio" hint="Use the name your team recognises. Up to 120 characters." error={fieldError} required />
        {!canCreateClient && <AuthNotice error>This workspace currently doesn’t permit adding clients.</AuthNotice>}
        {failure && <AuthNotice error>{failure.message}{failure.recovery && <a className="rr-auth__notice-link" href={failure.recovery}>{recoveryLabel[failure.recovery]}</a>}{conflict && <p className="rr-client-dialog__reconcile">Check your workspace’s client records before starting a new request.</p>}</AuthNotice>}
        {preview && <p className="rr-client-dialog__preview">UI preview only. Use a sample client name.</p>}
        <div className="rr-client-dialog__actions"><button className="rr-client-dialog__cancel" type="button" onClick={close} disabled={pending}>Cancel</button><button className="rr-client-dialog__submit" type="submit" disabled={pending || remaining > 0 || conflict || accessBlocked || !canCreateClient}>{pending ? "Adding client…" : remaining > 0 ? `Try again in ${remaining}s` : retryDraft ? "Retry client request" : "Add client"}</button></div>
      </form>
    </>}
  </dialog>;
}
