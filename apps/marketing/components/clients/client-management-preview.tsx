"use client";
import { useTeamPreview } from "../team/team-preview-store";
import { usePreviewWritable } from "../settings/settings-preview-store";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DashboardPreviewShell as DashboardShell } from "../team/dashboard-preview-shell";
import { AuthNotice } from "../../../../packages/ui/auth/auth-fields";
import { AddClientDialog } from "../../../../packages/ui/clients/add-client-dialog";
import { ClientRecordEditor } from "../../../../packages/ui/clients/record-editor";
import { ClientsList, ClientDetails } from "../../../../packages/ui/clients/client-views";
import type { ClientCreateAction, ClientEditorTarget, ClientRecordAction, ClientRecordResult } from "../../../../packages/ui/clients/contracts";
import { useClientPreview } from "./client-preview-store";

type ViewState = "normal" | "loading" | "error" | "read-only" | "unavailable" | "session" | "mfa";
type MutationState = "normal" | "validation" | "connection" | "rate-limit" | "stale" | "read-only" | "session" | "mfa";
async function waitForPreview(signal: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new Error("Cancelled")); return; }
    const abort = () => { window.clearTimeout(timer); reject(new Error("Cancelled")); };
    const timer = window.setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 550);
    signal.addEventListener("abort", abort, { once: true });
  });
}

export function ClientManagementPreview({ clientId }: { clientId?: string }) {
  const workspace = useTeamPreview().workspace;
  const store = useClientPreview();
  const [view, setView] = useState<ViewState>("normal");
  const [mutation, setMutation] = useState<MutationState>("normal");
  const [addOpen, setAddOpen] = useState(false);
  const [editor, setEditor] = useState<ClientEditorTarget | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorSaved = useRef(false);
  useEffect(() => () => { if (retry.current) clearTimeout(retry.current); }, []);
  const client = store.clients.find(row => row.id === clientId);
  const trusted = view === "normal" || view === "read-only";
  const workspaceWritable = usePreviewWritable();
  const canWrite = workspaceWritable && view === "normal";
  function mutationFailure(): Extract<ClientRecordResult, { status: "error" }> | null {
    switch (mutation) {
      case "connection": throw new Error("Synthetic unconfirmed result");
      case "validation": return { status: "error", code: "invalid_request", message: "Check the highlighted field.", fieldErrors: { name: ["Review this name. (Sample server validation)"] } };
      case "rate-limit": return { status: "error", code: "rate_limited", message: "Too many attempts. Wait a moment and try again.", retryAfterSeconds: 10 };
      case "stale": return { status: "error", code: "stale_version", message: "This record has changed since you opened it. Review the latest details before saving." };
      case "read-only": return { status: "error", code: "workspace_read_only", message: "This workspace no longer permits changes. A workspace owner can review subscription access." };
      case "session": return { status: "error", code: "unauthenticated", message: "Log in again to continue.", recovery: "/login" };
      case "mfa": return { status: "error", code: "mfa_required", message: "Verify your authenticator session to continue.", recovery: "/two-factor" };
      default: return null;
    }
  }
  const addClient: ClientCreateAction = async (input, signal) => {
    await waitForPreview(signal);
    if (mutation === "stale") return { status: "error", code: "idempotency_conflict", message: "This request conflicts with an earlier attempt. Resolve the original request before creating another client." };
    const failure = mutationFailure(); if (failure) return failure;
    return { status: "success", client: { id: crypto.randomUUID(), ...input, version: 1, archivedAt: null } };
  };
  const saveRecord: ClientRecordAction = async (command, signal) => {
    await waitForPreview(signal);
    const failure = mutationFailure(); if (failure) return failure;
    const parent = store.clients.find(row => row.id === command.clientId);
    if (!parent) return { status: "error", code: "not_found", message: "This client is no longer available." };
    if (command.operation === "client.update") {
      if (parent.archivedAt) return { status: "error", code: "archived", message: "Archived clients cannot be renamed." };
      if (parent.version !== command.input.expectedVersion) return { status: "error", code: "stale_version", message: "The client changed. Review its latest details." };
      return { status: "success", record: { ...parent, name: command.input.name, version: parent.version + 1 } };
    }
    if (command.operation === "contact.create") {
      if (parent.archivedAt) return { status: "error", code: "archived", message: "New contacts cannot be added to an archived client." };
      return { status: "success", record: { id: crypto.randomUUID(), clientId: parent.id, ...command.input, version: 1, archivedAt: null } };
    }
    const contact = store.contacts.find(row => row.id === command.contactId && row.clientId === parent.id);
    if (!contact) return { status: "error", code: "not_found", message: "This contact is no longer available." };
    if (contact.archivedAt) return { status: "error", code: "archived", message: "Archived contacts cannot be edited." };
    if (contact.version !== command.input.expectedVersion) return { status: "error", code: "stale_version", message: "The contact changed. Review its latest details." };
    return { status: "success", record: { ...contact, name: command.input.name, email: command.input.email, version: contact.version + 1 } };
  };
  function openEditor(target: ClientEditorTarget) { setNotice(""); setEditor(target); setEditorOpen(true); }
  return <>
    <DashboardShell workspace={trusted ? workspace : null} clientsHref="/clients" activeSection="Clients" preview>
      {notice && <div className="rr-clients__notice"><AuthNotice>{notice}</AuthNotice></div>}
      {view === "read-only" && <p className="rr-clients__information">Read-only workspace. Existing records remain visible; changes are unavailable.</p>}
      {view === "loading" ? <div className="rr-clients__loading" role="status">Loading client records…</div> : view === "error" ? <div className="rr-clients__loading"><h1>Client records couldn’t load</h1><p>Check your connection and try again.</p><button type="button" className="rr-dashboard__primary" onClick={() => { setView("loading"); retry.current = setTimeout(() => setView("normal"), 550); }}>Try again</button></div> : view === "session" || view === "mfa" ? <div className="rr-clients__loading"><h1>{view === "session" ? "Log in to continue" : "Verify your sign-in"}</h1><p>Restore account access before opening client records.</p><Link className="rr-dashboard__primary" href={view === "session" ? "/login" : "/two-factor"}>Continue</Link></div> : view === "unavailable" || clientId && !client ? <div className="rr-clients__loading"><h1>Client isn’t available</h1><p>This client isn’t available in the current preview. Return to the list to add one.</p><Link className="rr-dashboard__primary" href="/clients">All clients</Link></div> : client ? <ClientDetails client={client} contacts={store.contacts.filter(row => row.clientId === client.id)} canWrite={canWrite} onRename={() => openEditor({ kind: "client", client })} onAddContact={() => openEditor({ kind: "contact-create", client })} onEditContact={contact => openEditor({ kind: "contact-edit", client, contact })} /> : <ClientsList clients={store.clients} canWrite={canWrite} onAdd={() => { setNotice(""); setAddOpen(true); }} />}
      <AddClientDialog key={`add-${revision}`} open={addOpen} workspace={workspace} canCreateClient={canWrite} action={addClient} preview onClose={() => setAddOpen(false)} onCreated={store.saveClient} />
      {editor && <ClientRecordEditor key={`${editor.kind}-${editor.kind === "contact-edit" ? editor.contact.id : editor.client.id}-${editor.kind === "contact-edit" ? editor.contact.version : editor.client.version}-${revision}`} target={editor} open={editorOpen} canWrite={canWrite} action={saveRecord} preview onClose={() => {
        setEditorOpen(false);
        if (editorSaved.current) { editorSaved.current = false; setEditor(null); }
      }} onSaved={record => {
        if ("email" in record) store.saveContact(record); else store.saveClient(record);
        editorSaved.current = true; setEditorOpen(false);
        setNotice("Preview saved. No backend record was changed and no email was sent.");
      }} />}
    </DashboardShell>
    <details className="rr-auth__review"><summary>Local preview tools</summary><p>Client and contact edits stay in memory during app navigation. Refreshing resets this synthetic session.</p>
      <div className="rr-auth__review-controls"><label htmlFor="client-view-state">Screen state<select id="client-view-state" value={view} onChange={event => { if (retry.current) clearTimeout(retry.current); setView(event.target.value as ViewState); }}>{["normal", "loading", "error", "read-only", "unavailable", "session", "mfa"].map(item => <option key={item}>{item}</option>)}</select></label><label htmlFor="record-mutation-state">Save result<select id="record-mutation-state" value={mutation} onChange={event => setMutation(event.target.value as MutationState)}>{["normal", "validation", "connection", "rate-limit", "stale", "read-only", "session", "mfa"].map(item => <option key={item}>{item}</option>)}</select></label></div>
      <div className="rr-auth__review-controls"><button className="rr-clients__outline-action" type="button" onClick={() => { store.loadSamples(); setNotice(""); setEditor(null); setRevision(previous => previous + 1); }}>Load sample clients</button><button className="rr-clients__text-action" type="button" onClick={() => { store.clear(); setNotice(""); setEditor(null); setRevision(previous => previous + 1); }}>Clear sample records</button><button className="rr-clients__text-action" type="button" onClick={() => { setRevision(previous => previous + 1); setEditor(null); setMutation("normal"); setView("normal"); }}>Reset form previews</button></div>
      <nav aria-label="Client preview navigation"><Link href="/clients">Clients list</Link><Link href="/dashboard">Renewals</Link></nav>
    </details>
  </>;
}
