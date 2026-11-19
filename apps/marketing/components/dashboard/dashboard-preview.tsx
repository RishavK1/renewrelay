"use client";
import { useTeamPreview } from "../team/team-preview-store";
import { usePreviewWritable } from "../settings/settings-preview-store";

import { useEffect, useRef, useState } from "react";
import { DashboardPreviewShell as DashboardShell } from "../team/dashboard-preview-shell";
import { RenewalsFirstState } from "../../../../packages/ui/dashboard/renewals-first-state";
import type { DashboardState } from "../../../../packages/ui/dashboard/contracts";
import { AddClientDialog } from "../../../../packages/ui/clients/add-client-dialog";
import type { ClientCreateAction, ClientView } from "../../../../packages/ui/clients/contracts";
import { useClientPreview } from "../clients/client-preview-store";
import { RenewalRecordsPreview } from "../renewals/renewal-records-preview";

type Scenario = "new-workspace" | "loading" | "error" | "read-only" | "session" | "email" | "mfa" | "unavailable" | "deleting" | "existing-clients";
const scenarios: { value: Scenario; label: string }[] = [
  { value: "new-workspace", label: "New workspace — no clients" }, { value: "loading", label: "Loading" },
  { value: "error", label: "Connection failure" }, { value: "read-only", label: "Read-only workspace" },
  { value: "session", label: "Expired session" }, { value: "email", label: "Email verification required" },
  { value: "mfa", label: "Authenticator verification required" }, { value: "unavailable", label: "Workspace unavailable" },
  { value: "deleting", label: "Workspace scheduled for deletion" }, { value: "existing-clients", label: "Existing clients — no renewals" },
];
type ClientScenario = "normal" | "validation" | "connection" | "rate-limit" | "session" | "email" | "mfa" | "read-only" | "conflict";
const clientScenarios: { value: ClientScenario; label: string }[] = [
  { value: "normal", label: "Successful client preview" }, { value: "validation", label: "Server field error" },
  { value: "connection", label: "Unconfirmed connection result" }, { value: "rate-limit", label: "Rate limit (10-second sample)" },
  { value: "session", label: "Expired session" }, { value: "email", label: "Email verification required" },
  { value: "mfa", label: "Authenticator verification required" }, { value: "read-only", label: "Workspace became read-only" },
  { value: "conflict", label: "Conflicting request" },
];

function viewState(scenario: Scenario): DashboardState {
  if (scenario === "new-workspace") return { kind: scenario, canCreateClient: true };
  if (scenario === "session") return { kind: "auth-required", reason: "session", recoveryHref: "/login" };
  if (scenario === "email") return { kind: "auth-required", reason: "email", recoveryHref: "/check-email" };
  if (scenario === "mfa") return { kind: "auth-required", reason: "mfa", recoveryHref: "/two-factor" };
  return { kind: scenario };
}

export function DashboardPreview() {
  const clientStore = useClientPreview();
  const [scenario, setScenario] = useState<Scenario>("new-workspace");
  const [clientScenario, setClientScenario] = useState<ClientScenario>("normal");
  const [clientOpen, setClientOpen] = useState(false);
  const [sampleClient, setSampleClient] = useState<ClientView | null>(null);
  const [clientRevision, setClientRevision] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const team = useTeamPreview();
  const sampleWorkspace = team.workspace;
  const workspaceWritable = usePreviewWritable();
  const state = viewState(!workspaceWritable ? "read-only" : scenario === "new-workspace" && clientStore.clients.length ? "existing-clients" : scenario);
  const trustedContext = ["new-workspace", "existing-clients", "read-only"].includes(scenario);
  function select(next: Scenario) { if (timer.current) clearTimeout(timer.current); setSampleClient(null); setScenario(next); }
  const createClient: ClientCreateAction = async (draft, signal) => {
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) { reject(new Error("Cancelled")); return; }
      const abort = () => { window.clearTimeout(timeout); reject(new Error("Cancelled")); };
      const timeout = window.setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 650);
      signal.addEventListener("abort", abort, { once: true });
    });
    switch (clientScenario) {
      case "connection": throw new Error("Synthetic unconfirmed result");
      case "validation": return { status: "error", code: "invalid_request", message: "Check the client name and try again.", fieldErrors: { name: ["Check the client name. (Sample server validation)"] } };
      case "rate-limit": return { status: "error", code: "rate_limited", message: "Too many requests. Wait a moment before trying again.", retryAfterSeconds: 10 };
      case "session": return { status: "error", code: "unauthenticated", message: "Your session has expired. Log in again to continue.", recovery: "/login" };
      case "email": return { status: "error", code: "email_unverified", message: "Verify your email before adding a client.", recovery: "/check-email" };
      case "mfa": return { status: "error", code: "mfa_required", message: "Verify your authenticator session to continue.", recovery: "/two-factor" };
      case "read-only": return { status: "error", code: "workspace_read_only", message: "This workspace is read-only. A workspace owner can review subscription access." };
      case "conflict": return { status: "error", code: "idempotency_conflict", message: "This request couldn’t be matched. Don’t submit another creation request until the previous result is resolved." };
      default: return { status: "success", client: { ...draft, id: "00000000-0000-4000-8000-000000000002", version: 1, archivedAt: null } };
    }
  };
  if (clientStore.renewals.length) return <RenewalRecordsPreview />;
  return <>
    <DashboardShell workspace={trustedContext ? sampleWorkspace : null} preview clientsHref="/clients">
      <RenewalsFirstState importHref={workspaceWritable && team.members.some(row => row.userId === "preview-owner" && row.role !== "member") ? "/renewals/import" : undefined} state={state} preview onAddClient={() => setClientOpen(true)} onRetry={() => {
        select("loading"); timer.current = setTimeout(() => setScenario("new-workspace"), 650);
      }} />
      <AddClientDialog key={clientRevision} open={clientOpen} workspace={sampleWorkspace} canCreateClient={workspaceWritable && (scenario === "new-workspace" || scenario === "existing-clients")} action={createClient} preview onCreated={client => { setSampleClient(client); clientStore.saveClient(client); }} onClose={() => {
        setClientOpen(false);
        if (sampleClient) setScenario("existing-clients");
      }} />
    </DashboardShell>
    <details className="rr-auth__review"><summary>Local preview tools</summary><p>Synthetic states only. No workspace records or access permissions are loaded.</p>
      <div className="rr-auth__review-controls"><label htmlFor="dashboard-preview-state">Workspace state<select id="dashboard-preview-state" value={scenario} onChange={event => select(event.target.value as Scenario)}>{scenarios.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div>
      <div className="rr-auth__review-controls"><label htmlFor="client-preview-state">Add client result<select id="client-preview-state" value={clientScenario} onChange={event => setClientScenario(event.target.value as ClientScenario)}>{clientScenarios.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><button className="rr-auth__text-button" type="button" onClick={() => { setClientRevision(previous => previous + 1); setClientScenario("normal"); select("new-workspace"); }}>Reset client preview</button></div>
      <nav aria-label="Preview navigation"><a href="/workspace-setup">Workspace setup</a><a href="/auth-complete">Account preview</a><a href="/">Homepage</a></nav>
      <button type="button" className="rr-clients__outline-action" onClick={() => clientStore.loadRenewals()}>Load sample renewals</button>
    </details>
  </>;
}
