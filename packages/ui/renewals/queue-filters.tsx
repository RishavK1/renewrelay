"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { cycleFilter } from "../../contracts/renewals";
import { AuthField, AuthNotice } from "../auth/auth-fields";
import { NativeSelect } from "../primitives/native-select";
import { renewalStatusLabels } from "./renewal-views";
import type { RenewalFilters } from "./organization-contracts";
export function QueueFilters({ applied, clients, operators, fixedClientId, onApply }: { applied: RenewalFilters; clients: Record<string, string>; operators: Record<string, string>; fixedClientId?: string; onApply: (filters: RenewalFilters) => void }) {
  const [error, setError] = useState("");
  const [reset, setReset] = useState(0);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget), input: Record<string, string> = {};
    for (const [key, value] of data) if (typeof value === "string" && value.trim()) input[key] = value.trim();
    if (fixedClientId) input.clientId = fixedClientId;
    const parsed = cycleFilter.safeParse(input);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check your filters."); return; }
    setError(""); onApply(parsed.data);
  }
  function select(id: string, label: string, options: Record<string, string>, value?: string) { return <div className="rr-auth__field"><label htmlFor={`filter-${id}`}>{label}</label><NativeSelect id={`filter-${id}`} name={id} defaultValue={value ?? ""}><option value="">All</option>{Object.entries(options).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</NativeSelect></div>; }
  const count = Object.keys(applied).filter(key => key !== "limit" && !(key === "clientId" && fixedClientId)).length;
  return <details className="rr-organization__filters"><summary>Search & filters{count ? ` · ${count} applied` : ""}</summary><form key={`${JSON.stringify(applied)}-${reset}`} className="rr-organization__filter-form" onSubmit={submit} noValidate><div className="rr-organization__filter-grid">
    <AuthField id="filter-provider" name="provider" label="Provider name" defaultValue={applied.provider ?? ""} maxLength={120} hint="Exact provider name; letter case doesn’t matter." />
    {select("status", "Status", renewalStatusLabels, applied.status)}
    {select("bucket", "Work queue", { waiting_on_client: "Waiting on client", ready_for_operator: "Ready for operator", due_soon: "Due within 30 days", overdue: "Overdue", blocked: "Blocked", delivery_failed: "Delivery needs attention" }, applied.bucket)}
    {!fixedClientId && select("clientId", "Client", clients, applied.clientId)}
    {select("operatorId", "Assigned member", operators, applied.operatorId)}
    {select("billingStatus", "Agency invoice status", { not_applicable: "Not applicable", to_invoice: "To invoice", invoiced: "Invoiced" }, applied.billingStatus)}
    <AuthField id="filter-from" name="from" type="date" label="Next action from" defaultValue={applied.from ?? ""} /><AuthField id="filter-through" name="through" type="date" label="Next action through" defaultValue={applied.through ?? ""} />
  </div><p className="rr-auth__hint">Archived items are hidden by default. Choose a status or agency invoice status to include matching archived items.</p>{error && <div ref={errorRef} tabIndex={-1}><AuthNotice error>{error}</AuthNotice></div>}<div className="rr-follow__actions"><button className="rr-dashboard__primary" type="submit">Apply filters</button><button className="rr-clients__outline-action" type="button" onClick={() => { setError(""); setReset(value => value + 1); onApply({ limit: 25, ...(fixedClientId ? { clientId: fixedClientId } : {}) }); }}>Clear filters</button></div></form></details>;
}
