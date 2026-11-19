"use client";

import { isUnconfirmedResult } from "../decisions/action-policy";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { createContact, updateContact, updateClient } from "../../contracts/api";
import { AuthField, AuthNotice } from "../auth/auth-fields";
import type { ClientEditorTarget, ClientRecordAction, ClientRecordCommand, ClientRecordResult, ClientView, ContactView } from "./contracts";

type Props = { open: boolean; target: ClientEditorTarget; canWrite: boolean; action: ClientRecordAction; onClose: () => void; onSaved: (record: ClientView | ContactView) => void; preview?: boolean };
type Failure = Extract<ClientRecordResult, { status: "error" }>;

export function ClientRecordEditor({ open, target, canWrite, action, onClose, onSaved, preview }: Props) {
  const isClient = target.kind === "client";
  const existing = target.kind === "contact-edit" ? target.contact : null;
  const title = isClient ? "Edit client name" : existing ? "Edit contact" : "Add a contact";
  const [name, setName] = useState(isClient ? target.client.name : existing?.name ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [pending, setPending] = useState(false);
  const [retryCommand, setRetryCommand] = useState<ClientRecordCommand | null>(null);
  const [retryUntil, setRetryUntil] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const request = useRef<AbortController | null>(null);
  const returnTarget = useRef<HTMLElement | null>(null);
  const blocked = !canWrite || !!failure && ["stale_version", "idempotency_conflict", "workspace_read_only", "archived", "forbidden", "unauthenticated", "mfa_required", "email_unverified", "workspace_deleting", "not_found"].includes(failure.code);
  const locked = pending || !!retryCommand || blocked;
  function focus(field: string) { (form.current?.elements.namedItem(field) as HTMLElement | null)?.focus(); }
  function close() { if (!request.current) dialog.current?.close(); }
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) { returnTarget.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; element.showModal(); focus("name"); }
    else if (!open && element?.open) element.close();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  useEffect(() => {
    if (!retryUntil) return;
    const sync = () => setRemaining(Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000)));
    sync(); const interval = window.setInterval(sync, 1000);
    return () => window.clearInterval(interval);
  }, [retryUntil]);
  function change(field: "name" | "email", value: string) {
    if (locked) return;
    if (field === "name") setName(value); else setEmail(value);
    setErrors(previous => ({ ...previous, [field]: "" })); setFailure(null);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (request.current || blocked || remaining > 0) return;
    let command = retryCommand;
    if (!command) {
      const input = isClient ? { name, expectedVersion: target.client.version } : existing ? { name, email: email.trim(), expectedVersion: existing.version } : { name, email: email.trim() };
      const schema = isClient ? updateClient : existing ? updateContact : createContact;
      const parsed = schema.safeParse(input);
      if (!parsed.success) {
        const fields: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          if (issue.path[0] === "name") fields.name = name.trim() ? "Use no more than 120 characters." : "Enter a name.";
          if (issue.path[0] === "email") fields.email = "Enter a valid email address of no more than 254 characters.";
        }
        setErrors(fields); focus(fields.name ? "name" : "email"); return;
      }
      // Construct each operation from its own shared schema, including version.
      if (isClient) command = { operation: "client.update", clientId: target.client.id, input: updateClient.parse(input) };
      else if (existing) command = { operation: "contact.update", clientId: target.client.id, contactId: existing.id, input: updateContact.parse(input) };
      else command = { operation: "contact.create", clientId: target.client.id, input: createContact.parse(input) };
    }
    const controller = new AbortController(); request.current = controller; setPending(true); setFailure(null); setErrors({});
    try {
      const result = await action(command, controller.signal);
      if (controller.signal.aborted) return;
      if (result.status === "success") { setRetryCommand(null); onSaved(result.record); }
      else {
        setFailure(result); setRetryCommand(isUnconfirmedResult(result.code) ? command : null);
        const fields: Record<string, string> = {};
        for (const field of ["name", "email"]) { const message = result.fieldErrors?.[field]?.[0]; if (message) fields[field] = message; }
        setErrors(fields); if (Object.keys(fields).length) window.requestAnimationFrame(() => focus(fields.name ? "name" : "email"));
        if (result.retryAfterSeconds) { setRemaining(result.retryAfterSeconds); setRetryUntil(Date.now() + result.retryAfterSeconds * 1000); }
      }
    } catch {
      if (!controller.signal.aborted) { setRetryCommand(command); setFailure({ status: "error", code: "connection_error", message: "The result couldn’t be confirmed. Retry the same request before changing these details." }); }
    } finally { if (!controller.signal.aborted) { request.current = null; setPending(false); } }
  }
  return <dialog ref={dialog} className="rr-client-dialog" aria-labelledby="client-editor-title" aria-describedby="client-editor-description" onCancel={event => { if (request.current) event.preventDefault(); }} onClose={() => {
    onClose();
    window.requestAnimationFrame(() => { if (returnTarget.current?.isConnected) returnTarget.current.focus(); else document.querySelector<HTMLElement>(".rr-dashboard__page-heading h1")?.focus(); });
  }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  }}>
    <button type="button" className="rr-client-dialog__close rr-dashboard__icon-button" onClick={close} disabled={pending} aria-label="Close editor"><X size={20} aria-hidden="true" /></button>
    <p className="rr-client-dialog__workspace">{target.client.name}</p><h2 id="client-editor-title">{title}</h2>
    <p id="client-editor-description">{isClient ? "Use the name your team recognises." : "Keep the right person’s name and email with this client. Saving a contact doesn’t send them an email."}</p>
    <form ref={form} onSubmit={submit} noValidate aria-busy={pending}>
      <AuthField id="record-name" name="name" label={isClient ? "Client name" : "Full name"} value={name} onChange={event => change("name", event.target.value)} readOnly={locked} maxLength={120} autoComplete="off" required error={errors.name} />
      {!isClient && <AuthField id="record-email" name="email" label="Email address" value={email} type="email" inputMode="email" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={254} onChange={event => change("email", event.target.value)} readOnly={locked} required error={errors.email} />}
      {existing && email.trim().toLowerCase() !== existing.email.toLowerCase() && <AuthNotice>Changing this email invalidates existing decision links for open renewals. Send a new decision request when needed.</AuthNotice>}
      {failure && <AuthNotice error>{failure.message}{failure.recovery && <a className="rr-auth__notice-link" href={failure.recovery}>Restore account access</a>}{failure.code === "stale_version" && <p>Close this editor and review the latest record before editing again.</p>}</AuthNotice>}
      {preview && <p className="rr-client-dialog__preview">Preview only. Changes stay in this browser’s temporary UI session.</p>}
      <div className="rr-client-dialog__actions"><button type="button" className="rr-client-dialog__cancel" onClick={close} disabled={pending}>Cancel</button><button type="submit" className="rr-client-dialog__submit" disabled={pending || blocked || remaining > 0}>{pending ? "Saving…" : remaining > 0 ? `Try again in ${remaining}s` : retryCommand ? "Retry request" : target.kind === "contact-create" ? "Add contact" : "Save changes"}</button></div>
    </form>
  </dialog>;
}
