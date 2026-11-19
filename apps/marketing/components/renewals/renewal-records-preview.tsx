"use client";
import { useTeamPreview } from "../team/team-preview-store";
import { usePreviewWritable } from "../settings/settings-preview-store";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardPreviewShell as DashboardShell } from "../team/dashboard-preview-shell";
import { RenewalsFirstState } from "../../../../packages/ui/dashboard/renewals-first-state";
import { AuthNotice } from "../../../../packages/ui/auth/auth-fields";
import { RenewalQueue, RenewalDetails } from "../../../../packages/ui/renewals/renewal-views";
import { QueueFilters } from "../../../../packages/ui/renewals/queue-filters";
import type { RenewalFilters } from "../../../../packages/ui/renewals/organization-contracts";
import { usePreviewOperators } from "../team/dashboard-preview-shell";
import type { RenewalStatus } from "../../../../packages/ui/renewals/contracts";
import { useClientPreview } from "../clients/client-preview-store";
import { previewToday, queuePreview } from "./renewal-fixtures";

type Scenario = "normal" | "loading" | "error" | "read-only" | "session" | "mfa" | "unavailable";
export function RenewalRecordsPreview({ cycleId, clientId }: { cycleId?: string; clientId?: string }) {
  const workspace = useTeamPreview().workspace;
  const previewOperators = usePreviewOperators();
  const store = useClientPreview();
  const router = useRouter();
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [filters, setFilters] = useState<RenewalFilters>({ limit: 25, ...(clientId ? { clientId } : {}) });
  const status = filters.status ?? "all";
  const clearFilters = () => setFilters({ limit: 25, ...(clientId ? { clientId } : {}) });
  const setStatus = (value: RenewalStatus | "all") => setFilters(previous => { const { status: _status, ...rest } = previous; return { ...rest, ...(value === "all" ? {} : { status: value }) }; });
  const filtered = Object.keys(filters).some(key => key !== "limit" && !(key === "clientId" && clientId));
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (retry.current) clearTimeout(retry.current); }, []);
  const trusted = scenario === "normal" || scenario === "read-only";
  const workspaceWritable = usePreviewWritable();
  const team = useTeamPreview();
  const canWrite = workspaceWritable && scenario === "normal";
  const canImport = canWrite && team.members.some(row => row.userId === "preview-owner" && row.role !== "member");
  const record = store.renewals.find(row => row.cycle.id === cycleId);
  const clientNames = Object.fromEntries(store.clients.map(client => [client.id, client.name]));
  const operatorNames = Object.fromEntries(previewOperators.map(member => [member.userId, member.label]));
  // Filter only the complete synthetic pool. Production adapter uses server filters/cursors.
  const today = previewToday();
  const end = new Date(`${today}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 29);
  const throughDue = end.toISOString().slice(0, 10);
  const pool = store.renewals.filter(row => {
    const c = row.cycle;
    if ((clientId || filters.clientId) && row.item.clientId !== (clientId || filters.clientId)) return false;
    if (!filters.status && !filters.billingStatus && !filters.itemId && row.item.archivedAt) return false;
    if (filters.status && c.state !== filters.status || filters.itemId && c.itemId !== filters.itemId || filters.operatorId && c.operatorId !== filters.operatorId || filters.billingStatus && c.billingStatus !== filters.billingStatus) return false;
    if (filters.provider && c.provider.toLowerCase() !== filters.provider.toLowerCase() || filters.from && c.nextActionOn < filters.from || filters.through && c.nextActionOn > filters.through) return false;
    const requests = store.decisions.filter(request => request.cycleId === c.id && !request.superseded);
    switch (filters.bucket) {
      case "waiting_on_client": return c.state === "open" && !c.closedAt && requests.some(request => !request.terms.decided);
      case "ready_for_operator": return c.state === "ready";
      case "blocked": return !c.closedAt && !!c.blockedReason;
      case "overdue": return !c.closedAt && c.state !== "draft" && c.nextActionOn < today;
      case "due_soon": return !c.closedAt && c.state !== "draft" && c.nextActionOn >= today && c.nextActionOn <= throughDue;
      case "delivery_failed": return !c.closedAt && requests.some(request => !request.terms.decided && store.deliveryFailedRequestIds.includes(request.id));
      default: return true;
    }
  });
  const rows = pool.map(queuePreview).sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.nextActionOn.localeCompare(b.nextActionOn) || a.id.localeCompare(b.id));
  const missing = !!cycleId && !record || !!clientId && !store.clients.some(client => client.id === clientId);
  return <>
    <DashboardShell workspace={trusted ? workspace : null} clientsHref="/clients" preview>
      {scenario === "read-only" && <AuthNotice>Read-only workspace. Records remain visible; creating or changing renewals is unavailable.</AuthNotice>}
      {scenario === "loading" ? <div className="rr-clients__loading" role="status">Loading renewal records…</div> : scenario === "error" ? <div className="rr-clients__loading"><h1>Renewals couldn’t load</h1><p>Check your connection and try again.</p><button className="rr-dashboard__primary" type="button" onClick={() => { setScenario("loading"); retry.current = setTimeout(() => setScenario("normal"), 550); }}>Try again</button></div> : scenario === "session" || scenario === "mfa" ? <div className="rr-clients__loading"><h1>{scenario === "session" ? "Log in to continue" : "Verify your sign-in"}</h1><p>Restore account access before opening this workspace’s renewals.</p><Link className="rr-dashboard__primary" href={scenario === "session" ? "/login" : "/two-factor"}>Continue</Link></div> : scenario === "unavailable" || missing ? <div className="rr-clients__loading"><h1>Renewal isn’t available</h1><p>This record isn’t available in the current preview. Add a renewal or load sample records to review one.</p><Link className="rr-dashboard__primary" href="/dashboard">All renewals</Link></div> : record ? <RenewalDetails record={record} clientName={clientNames[record.item.clientId] ?? "Client details not loaded"} operatorName={operatorNames[record.cycle.operatorId] ?? "Member details not loaded"} canWrite={canWrite} hasUnresolvedQuestions={store.decisions.some(request => request.cycleId === record.cycle.id && request.responses.some(response => response.choice === "question" && !response.resolution))} hasActiveCycle={store.renewals.some(row => row.item.id === record.item.id && !row.cycle.closedAt)} preview /> : !store.clients.length && !filtered ? <RenewalsFirstState importHref={canImport ? "/renewals/import" : undefined} state={{ kind: "new-workspace", canCreateClient: canWrite }} preview onAddClient={() => router.push("/clients")} /> : !store.renewals.length && !filtered && !clientId ? <RenewalsFirstState importHref={canImport ? "/renewals/import" : undefined} state={canWrite ? { kind: "existing-clients" } : { kind: "read-only" }} preview /> : <RenewalQueue filters={<QueueFilters applied={filters} clients={clientNames} operators={operatorNames} fixedClientId={clientId} onApply={setFilters} />} filtered={filtered} onClearFilters={clearFilters} rows={rows} clientNames={clientNames} operatorNames={operatorNames} status={status} onStatusChange={setStatus} canWrite={canWrite} canImport={canImport} clientHref={clientId ? `/clients/${clientId}` : undefined} />}
    </DashboardShell>
    <details className="rr-auth__review"><summary>Local preview tools</summary><p>Synthetic in-memory records only. Filters apply to this complete fixture set; no live record, provider, email or payment action occurs.</p><div className="rr-auth__review-controls"><label htmlFor="renewal-view-scenario">Screen state<select id="renewal-view-scenario" value={scenario} onChange={event => { if (retry.current) clearTimeout(retry.current); setScenario(event.target.value as Scenario); }}>{["normal", "loading", "error", "read-only", "session", "mfa", "unavailable"].map(value => <option key={value}>{value}</option>)}</select></label><button className="rr-clients__outline-action" type="button" onClick={() => { store.loadOrganizationSamples(); setScenario("normal"); clearFilters(); }}>Load sample renewals</button><button className="rr-clients__text-action" type="button" onClick={() => { store.clear(); clearFilters(); }}>Clear preview records</button></div><nav aria-label="Renewal preview navigation"><Link href="/renewals">Renewal list</Link><Link href="/renewals/new">Add renewal</Link><Link href="/clients">Clients</Link></nav></details>
  </>;
}
