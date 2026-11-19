"use client";
import { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "../../../../packages/ui/dashboard/dashboard-shell";
import { TrackingScreen } from "../../../../packages/ui/tracking/tracking-screen";
import { canReadTracking } from "../../../../packages/ui/tracking/policy";
import type { AlertRow, DeliveryRow, TrackingData, TrackingMode, TrackingRead, TrackingRelated } from "../../../../packages/ui/tracking/contracts";
import { trackingPageInput } from "../../../../packages/ui/tracking/contracts";
import type { DecisionFailure } from "../../../../packages/ui/decisions/contracts";
import { useClientPreview } from "../clients/client-preview-store";
import { useTeamPreview } from "../team/team-preview-store";
import { useSettingsPreview } from "../settings/settings-preview-store";
const scenarios = ["normal", "loading", "empty", "load-error", "read-error", "rate", "session", "email", "mfa", "no-mfa", "admin", "member", "removed", "deleting", "read-only", "missing-related", "long-values", "access-lost"] as const;
type Scenario = typeof scenarios[number];
function pageOf<T extends { id: string }>(items: T[], after?: string, limit = 3) { const rows = items.filter(row => !after || row.id > after).sort((a,b) => a.id.localeCompare(b.id)); return { items: rows.slice(0,limit), nextCursor: rows.length > limit ? rows[limit - 1]!.id : null }; }
const fail = (code: string, message: string): DecisionFailure => ({ status: "error", code, message });
export function TrackingPreview({ mode }: { mode: TrackingMode }) {
  const store = useClientPreview(), team = useTeamPreview(), settings = useSettingsPreview();
  const [scenario, setScenario] = useState<Scenario>("normal"), [revision,setRevision] = useState(0);
  const actor = team.members.find(row => row.userId === "preview-owner");
  const role = scenario === "admin" ? "admin" : scenario === "member" ? "member" : actor?.role ?? "member";
  const deleting = settings.billing.mode === "deleting" || scenario === "deleting";
  const denied = !actor || scenario === "removed" || !canReadTracking(mode, role);
  const auth = ["session", "email", "mfa", "no-mfa"].includes(scenario);
  const empty = scenario === "empty";
  const alerts: AlertRow[] = empty ? [] : store.history.filter(row => ["cycle.blocked","cycle.activated_overdue"].includes(row.event)).map(({id,entityId,event,createdAt}) => ({id,entityId,event,createdAt}));
  const deliveries: DeliveryRow[] = empty ? [] : store.trackingDeliveries;
  const dataset: TrackingData = mode === "alerts" ? { mode, page: pageOf(alerts) } : { mode, page: pageOf(deliveries) };
  if (scenario === "long-values") {
    if (dataset.mode === "deliveries") dataset.page = { items: [{ id: "d2000000-0000-4000-8000-000000000001", requestId: "f2000000-0000-4000-8000-000000000001", kind: "unknown_".repeat(30), status: "new_provider_state_".repeat(20), attempts: 12, runAt: "2026-11-18T09:00:00Z", lastError: '<script>alert("sample")</script>\n' + "Diagnostic_reference_".repeat(60) }], nextCursor: null };
    else dataset.page = { items: [{ id:"a2000000-0000-4000-8000-000000000001", entityId:"f2000000-0000-4000-8000-000000000001", event:"cycle.blocked", createdAt:"2026-11-18T09:00:00Z" }], nextCursor: null };
  }
  const related: TrackingRelated = { cycles:{}, requests:{} };
  if (!["missing-related", "long-values"].includes(scenario)) for (const record of store.renewals) {
    const item = { cycleId: record.cycle.id, service: record.cycle.service, clientName: store.clients.find(row => row.id === record.item.clientId)?.name };
    related.cycles[record.cycle.id] = item;
    for (const request of store.decisions.filter(row => row.cycleId === record.cycle.id)) related.requests[request.id] = item;
  }
  const read: TrackingRead = async (query, signal) => {
    await new Promise<void>(resolve => { const timer=setTimeout(resolve,350); signal.addEventListener("abort",()=>{clearTimeout(timer);resolve();},{once:true}); });
    if (scenario === "read-error") return fail("temporarily_unavailable", "Records couldn’t refresh.");
    if (scenario === "rate") return { ...fail("rate_limited", "Wait before reading again."), retryAfterSeconds: 3 };
    if (scenario === "access-lost") return fail("forbidden", "Your access changed. These records are no longer available.");
    const parsed=trackingPageInput.safeParse({ ...query, ...(query.limit === undefined ? {} : { limit: String(query.limit) }) }); if (!parsed.success) return fail("invalid_request", "Check pagination parameters.");
    return mode === "alerts" ? {status:"success",mode,page:pageOf(alerts,parsed.data.after,parsed.data.limit)} : {status:"success",mode,page:pageOf(deliveries,parsed.data.after,parsed.data.limit)};
  };
  const loadSamples = () => { store.loadTrackingSamples(); setScenario("normal"); setRevision(n=>n+1); };
  const blockedHeading = deleting ? "Workspace deletion is requested" : denied ? "This view isn’t available" : auth ? "Verify account access" : scenario === "loading" ? "Loading records…" : "Records couldn’t load";
  const recovery = scenario === "session" ? "/login" : scenario === "email" ? "/check-email" : scenario === "no-mfa" ? "/setup-authenticator" : "/two-factor";
  return <><DashboardShell workspace={scenario === "session" || scenario === "removed" || !actor ? null : {...team.workspace,role}} activeSection={mode === "alerts" ? "Alerts" : "Deliveries"} preview clientsHref="/clients">
    {deleting || denied || auth || scenario === "loading" || scenario === "load-error" ? <section className="rr-follow__status" aria-busy={scenario === "loading"}><h1>{blockedHeading}</h1><p>{deleting ? "Operational reads are stopped. Review recovery options with the requesting owner." : denied ? mode === "alerts" && actor && scenario !== "removed" ? "Renewal alert records are available to the workspace owner only. Delivery tracking and renewals use their own access rules." : "Restore workspace access before reading these records." : auth ? "Restore your sign-in, verified email or authenticator before reading workspace records." : scenario === "loading" ? "Waiting for the authorized workspace records." : "Check your connection and try again."}</p><div className="rr-follow__actions">{deleting ? <Link className="rr-dashboard__primary" href="/settings/deletion">Review recovery options</Link> : auth ? <Link className="rr-dashboard__primary" href={recovery}>Continue</Link> : scenario === "load-error" ? <button className="rr-dashboard__primary" onClick={()=>setScenario("normal")}>Try again</button> : denied && <Link className="rr-dashboard__primary" href={actor && scenario !== "removed" ? "/deliveries" : "/workspace-setup"}>{actor && scenario !== "removed" ? "Delivery tracking" : "Workspace access"}</Link>}</div></section> : <>{(!settings.billing.writable || scenario === "read-only") && <p className="rr-clients__information">Read-only workspace. These records remain available; this screen does not send messages or change renewals.</p>}<TrackingScreen key={`${scenario}-${revision}-${role}-${store.history.length}-${store.trackingDeliveries.length}`} initial={dataset} related={related} read={read} pageSize={3} onLoadSamples={loadSamples} /></>}
  </DashboardShell><details className="rr-auth__review"><summary>Local preview tools</summary><p>Synthetic in-memory records only. No messages, retries, dismissals or backend requests are performed. Sample loading replaces the current fixture workspace records.</p><div className="rr-auth__review-controls"><label htmlFor="tracking-scenario">Screen state<select id="tracking-scenario" value={scenario} onChange={e=>setScenario(e.target.value as Scenario)}>{scenarios.map(value=><option key={value}>{value}</option>)}</select></label><button className="rr-clients__outline-action" onClick={loadSamples}>Load sample activity</button><button className="rr-clients__text-action" onClick={()=>{store.clear();setRevision(n=>n+1);}}>Clear preview records</button></div><nav className="rr-tracking__toolbar" aria-label="Tracking preview navigation"><Link href="/alerts">Renewal alerts</Link><Link href="/deliveries">Delivery tracking</Link></nav></details></>;
}
