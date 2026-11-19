"use client";
import { usePreviewWritable } from "../settings/settings-preview-store";
import { useTeamPreview } from "../team/team-preview-store";

import { useState } from "react";
import Link from "next/link";
import { DashboardPreviewShell as DashboardShell } from "../team/dashboard-preview-shell";
import { AuthNotice } from "../../../../packages/ui/auth/auth-fields";
import { RenewalForm } from "../../../../packages/ui/renewals/renewal-form";
import type { RenewalCreateAction, RenewalCreateResult } from "../../../../packages/ui/renewals/contracts";
import { useClientPreview } from "../clients/client-preview-store";
import { usePreviewOperators } from "../team/dashboard-preview-shell";
import { previewRenewal } from "./renewal-fixtures";

type Scenario = "normal" | "validation" | "connection" | "rate-limit" | "quota" | "read-only" | "session" | "mfa" | "invalid-operator" | "members-unavailable";
const options: { value: Scenario; label: string }[] = [
  { value: "normal", label: "Successful preview" }, { value: "validation", label: "Server field error" },
  { value: "connection", label: "Unconfirmed result" }, { value: "rate-limit", label: "Rate limit (10-second sample)" },
  { value: "quota", label: "Item limit reached" }, { value: "read-only", label: "Read-only workspace" },
  { value: "session", label: "Expired session" }, { value: "mfa", label: "MFA required" },
  { value: "invalid-operator", label: "Assigned member no longer active" }, { value: "members-unavailable", label: "No assignable members" },
];

export function RenewalPreview({ initialClientId }: { initialClientId?: string }) {
  const workspace = useTeamPreview().workspace;
  const operators = usePreviewOperators();
  const store = useClientPreview();
  const writable = usePreviewWritable();
  const team = useTeamPreview();
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [revision, setRevision] = useState(0);
  const action: RenewalCreateAction = async (input, signal): Promise<RenewalCreateResult> => {
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) { reject(new Error("Cancelled")); return; }
      const abort = () => { window.clearTimeout(timer); reject(new Error("Cancelled")); };
      const timer = window.setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 650);
      signal.addEventListener("abort", abort, { once: true });
    });
    switch (scenario) {
      case "connection": throw new Error("Synthetic unconfirmed result");
      case "validation": return { status: "error", code: "invalid_request", message: "Review the highlighted renewal details.", fieldErrors: { provider: ["Check the provider name. (Sample server error)"] } };
      case "rate-limit": return { status: "error", code: "rate_limited", message: "Too many attempts. Wait a moment before retrying.", retryAfterSeconds: 10 };
      case "quota": return { status: "error", code: "item_limit", message: "The workspace’s item allowance is in use. A workspace owner can review available capacity." };
      case "read-only": return { status: "error", code: "workspace_read_only", message: "This workspace currently permits reading and exporting only." };
      case "session": return { status: "error", code: "unauthenticated", message: "Log in again before creating a renewal.", recovery: "/login" };
      case "mfa": return { status: "error", code: "mfa_required", message: "Verify your authenticator session to continue.", recovery: "/two-factor" };
      case "invalid-operator": return { status: "error", code: "invalid_operator", message: "The assigned member is no longer active. Choose an active workspace member.", fieldErrors: { operatorId: ["Choose an active team member."] } };
      default: {
        const itemId = crypto.randomUUID();
        const record = previewRenewal(input, itemId, crypto.randomUUID(), team.workspace.timezone);
        store.saveRenewal(record);
        store.appendHistory({ entityId: record.item.id, event: "item.created", details: { cycleId: record.cycle.id } });
        store.appendHistory({ entityId: record.cycle.id, event: "cycle.created", details: { state: record.cycle.state } });
        if (record.cycle.overdue) store.appendHistory({ entityId: record.cycle.id, event: "cycle.activated_overdue", details: {} });
        return { status: "success", item: record.item, cycle: { id: record.cycle.id, itemId, version: record.cycle.version, state: input.mode === "draft" ? "draft" : "open" } };
      }
    }
  };
  return <>
    <DashboardShell workspace={workspace} clientsHref="/clients" preview>
      {scenario === "read-only" && <AuthNotice error>Read-only preview. New renewal creation is unavailable.</AuthNotice>}
      <RenewalForm key={revision} clients={store.clients} operators={scenario === "members-unavailable" ? [] : operators} timezone={team.workspace.timezone} action={action} initialClientId={initialClientId} canWrite={writable && scenario !== "read-only"} preview />
    </DashboardShell>
    <details className="rr-auth__review"><summary>Local preview tools</summary><p>Use sample data only. Successful previews stay in the in-memory renewal list; nothing is saved to the backend.</p><div className="rr-auth__review-controls"><label htmlFor="renewal-result">Save result<select id="renewal-result" value={scenario} onChange={event => setScenario(event.target.value as Scenario)}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><button className="rr-clients__outline-action" type="button" onClick={() => { store.loadSamples(); setRevision(previous => previous + 1); }}>Load sample clients</button><button className="rr-clients__text-action" type="button" onClick={() => { setScenario("normal"); setRevision(previous => previous + 1); }}>Reset renewal preview</button></div><nav aria-label="Renewal preview navigation"><Link href="/clients">Clients</Link><Link href="/dashboard">Renewals</Link></nav></details>
  </>;
}
