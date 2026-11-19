"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { ImportFlow } from "../../../../packages/ui/imports/import-flow";
import { importColumns, importMaxBytes, type ImportAccess, type ImportAction, type ImportPreview as PreviewData, type ImportReceipt, type ImportTemplateAction } from "../../../../packages/ui/imports/contracts";
import { commitImport } from "../../../../packages/contracts/renewals";
import { canPreviewImport, canReadImportTemplate } from "../../../../packages/ui/imports/policy";
import { DashboardPreviewShell } from "../team/dashboard-preview-shell";
import { useTeamPreview } from "../team/team-preview-store";
import { useSettingsPreview } from "../settings/settings-preview-store";
import { useClientPreview } from "../clients/client-preview-store";
import { parsePreviewCsv, ImportCsvError, type ParsedImportRow } from "./parse-preview-csv";
import { inspectImportRows, duplicateImportLines } from "./import-preview-engine";
import { previewRenewal, previewToday } from "../renewals/renewal-fixtures";
import { AuthNotice } from "../../../../packages/ui/auth/auth-fields";
type Scenario = "normal" | "network" | "lost-receipt" | "rate" | "expired" | "stale" | "new-duplicates" | "inactive-reference" | "quota" | "preview-limit" | "session" | "email" | "mfa" | "as-member" | "as-admin" | "template-error" | "receipt-conflict" | "refresh-network";
const scenarios: Scenario[] = ["normal", "network", "lost-receipt", "rate", "expired", "stale", "new-duplicates", "inactive-reference", "quota", "preview-limit", "session", "email", "mfa", "as-member", "as-admin", "template-error", "receipt-conflict", "refresh-network"];
type Batch = { actorId: string; id: string; version: number; expiresAt: string; records: ParsedImportRow[]; warnedLines: number[]; result: ImportReceipt | null };
const clientId = "10000000-0000-4000-8000-000000000001";
function pause(signal: AbortSignal) { return new Promise<void>((resolve, reject) => { if (signal.aborted) { reject(new Error("Aborted")); return; } const cancel = () => { clearTimeout(timer); reject(new Error("Aborted")); }; const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, 350); signal.addEventListener("abort", cancel, { once: true }); }); }
function fixture(kind: "valid" | "invalid" | "duplicates" | "overdue") {
  const row = [clientId, "preview-owner", "Managed backup", "Example Cloud", "2027-12-20", "2027-12-10", "2027-12-01", "agency", "true", "false", "INR", "120000", "150000", "12 months of managed backup", "yearly", "draft"];
  const rows = kind === "duplicates" ? [row, row] : kind === "overdue" ? [[...row.slice(0, 4), "2000-12-20", "2000-12-10", "2000-12-01", ...row.slice(7, 15), ""]] : kind === "invalid" ? [[...row.slice(0, 4), "not-a-date", ...row.slice(5)]] : [row, [clientId, "preview-member", "Website care", "Agency service", "2027-11-20", "", "", "client", "false", "false", "INR", "", "", "", "monthly", "activate"]];
  return new File([importColumns.join(",") + "\r\n" + rows.map(values => values.join(",")).join("\r\n") + "\r\n"], `sample-${kind}.csv`, { type: "text/csv" });
}
export function ImportPreview() {
  const team = useTeamPreview(), settings = useSettingsPreview(), clients = useClientPreview();
  const latest = useRef({ team, settings, clients }); latest.current = { team, settings, clients };
  const batches = useRef(new Map<string, Batch>()), receipts = useRef(new Map<string, ImportReceipt>()), attempts = useRef(0);
  const [scenario, setScenario] = useState<Scenario>("normal"), [generation, setGeneration] = useState(0), [file, setFile] = useState<File | null>(null);
  const actor = team.members.find(row => row.userId === (scenario === "as-admin" ? "preview-admin" : scenario === "as-member" ? "preview-member" : "preview-owner"));
  const access: ImportAccess = { role: actor?.role ?? "member", writable: settings.billing.writable, deleting: settings.billing.mode === "deleting" };
  const fail = (code: string, message: string) => ({ status: "error" as const, code, message });
  const action: ImportAction = async (command, signal) => {
    await pause(signal);
    const key = command.operation === "commit" ? JSON.stringify(command) : null;
    const known = key && receipts.current.get(key);
    if (known) return { status: "success", operation: "commit", result: known };
    const source = latest.current, currentAccess = { ...access, writable: source.settings.billing.writable, deleting: source.settings.billing.mode === "deleting" };
    if (!canPreviewImport(currentAccess)) return fail(currentAccess.deleting ? "workspace_deleting" : currentAccess.role === "member" ? "forbidden" : "workspace_read_only", "Your current workspace access does not allow imports.");
    if (scenario === "rate") return { ...fail("rate_limited", "Too many import attempts. Wait before retrying."), retryAfterSeconds: 5 };
    if (scenario === "network" && attempts.current++ === 0) throw new Error("Synthetic unavailable response");
    const existing = [...new Map(source.clients.renewals.filter(row => !row.item.archivedAt).map(row => [row.item.id, { ...row.cycle, clientId: row.item.clientId }])).values()];
    const clientIds = new Set(source.clients.clients.filter(row => !row.archivedAt).map(row => row.id)), operatorIds = new Set(source.team.members.map(row => row.userId));
    const today = previewToday(source.team.workspace.timezone);
    const used = new Set(source.clients.renewals.filter(row => !row.item.archivedAt).map(row => row.item.id)).size;
    if (command.operation === "preview") {
      if (scenario === "refresh-network" && attempts.current++ === 1) throw new Error("Synthetic revalidation response lost");
      if (scenario === "preview-limit") return fail("preview_limit", "Ten import previews are already active. Reuse an existing file or wait for a preview to expire.");
      if (command.file.size > importMaxBytes) return fail("payload_too_large", "Choose a CSV file of at most 2 MiB.");
      const buffer = await command.file.arrayBuffer(); if (signal.aborted) throw new Error("Aborted");
      let csv: string;
      try { csv = new TextDecoder("utf-8", { fatal: true }).decode(buffer); } catch { return fail("invalid_csv", "Save the CSV in UTF-8 format and upload it again."); }
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)), byte => byte.toString(16).padStart(2, "0")).join("");
      const batchKey = `${source.team.workspace.id}:${actor?.userId ?? "unavailable"}:${hash}`;
      const previous = batches.current.get(batchKey);
      if (previous?.result) return { status: "success", operation: "preview", preview: { importId: previous.id, version: previous.version, committed: true, result: previous.result } };
      let parsed: ReturnType<typeof parsePreviewCsv>;
      try { parsed = parsePreviewCsv(csv); } catch (error) { return fail(error instanceof ImportCsvError ? error.code : "invalid_csv", error instanceof ImportCsvError ? error.message : "The CSV could not be read. Check its format and retry."); }
      const inspection = inspectImportRows(parsed.records, clientIds, operatorIds, existing, today), errors = [...parsed.errors, ...inspection.errors];
      let data: PreviewData;
      if (errors.length) data = { importId: null, version: null, committed: false, canCommit: false, errors: errors.slice(0, 200), totalErrors: errors.length, warnings: inspection.warnings };
      else {
        if ((!previous || Date.parse(previous.expiresAt) <= Date.now()) && [...batches.current.values()].filter(batch => batch.actorId === actor?.userId && !batch.result && Date.parse(batch.expiresAt) > Date.now()).length >= 10) return fail("preview_limit", "Ten import previews are already active. Reuse an existing file or wait for one to expire.");
        const expired = previous && Date.parse(previous.expiresAt) <= Date.now(), changed = previous && (expired || JSON.stringify(previous.warnedLines) !== JSON.stringify(inspection.warnedLines));
        const batch: Batch = { actorId: actor?.userId ?? "unavailable", id: previous?.id ?? crypto.randomUUID(), version: (previous?.version ?? 1) + (changed ? 1 : 0), expiresAt: previous && !expired ? previous.expiresAt : new Date(Date.now() + 24 * 3600000).toISOString(), records: parsed.records, warnedLines: inspection.warnedLines, result: null };
        batches.current.set(batchKey, batch);
        data = { importId: batch.id, version: batch.version, committed: false, canCommit: true, expiresAt: batch.expiresAt, remainingSlots: scenario === "quota" ? 0 : Math.max(0, source.settings.billing.limits.items - used), rows: batch.records.length, errors: [], totalErrors: 0, warnings: inspection.warnings };
      }
      return { status: "success", operation: "preview", preview: data };
    }
    if (scenario === "receipt-conflict") return fail("idempotency_conflict", "This import could not be matched to its original request. Resolve the receipt before starting another import.");
    if (!commitImport.safeParse(command.input).success) return fail("invalid_request", "Review the batch version and duplicate confirmation.");
    const batch = [...batches.current.values()].find(row => row.id === command.importId);
    if (!batch) return fail("not_found", "This preview is not loaded. Validate the file again.");
    if ((scenario === "stale" && attempts.current++ === 0) || batch.version !== command.input.expectedVersion) return fail("stale_version", "The preview version changed. Validate the file again.");
    if (batch.result) return { status: "success", operation: "commit", result: batch.result };
    if ((scenario === "expired" && attempts.current++ === 0) || Date.parse(batch.expiresAt) <= Date.now()) return fail("import_expired", "This import preview expired. Validate the file again before importing.");
    if (["new-duplicates", "inactive-reference"].includes(scenario) && attempts.current++ === 0) return fail("import_changed", "Duplicate or active-reference information changed. Validate the file again.");
    const duplicates = duplicateImportLines(batch.records, existing);
    if (duplicates.some(line => !batch.warnedLines.includes(line))) return fail("import_changed", "New possible duplicates were found. Validate the file again.");
    if (duplicates.length && !command.input.confirmPossibleDuplicates) return fail("duplicates_require_confirmation", "Review and confirm the possible duplicate records.");
    if (batch.records.some(row => !clientIds.has(row.input.clientId) || !operatorIds.has(row.input.operatorId) || !row.modeConfirmed && (row.input.respondBy ?? row.input.noticeBy ?? row.input.expiryOn) < today)) return fail("import_changed", "An active reference or date changed. Correct the file and validate it again.");
    if (scenario === "quota" || used + batch.records.length > source.settings.billing.limits.items) return fail("item_limit", "This batch exceeds the available renewal slots. Reduce the file or review workspace capacity.");
    const created = batch.records.map(row => previewRenewal(row.input, crypto.randomUUID(), crypto.randomUUID(), source.team.workspace.timezone));
    const result: ImportReceipt = { importId: batch.id, count: created.length, records: created.map(row => ({ itemId: row.item.id, cycleId: row.cycle.id })) };
    for (const row of created) {
      source.clients.saveRenewal(row);
      source.clients.appendHistory({ entityId: row.item.id, actorId: actor?.userId, event: "item.created", details: { cycleId: row.cycle.id } });
      source.clients.appendHistory({ entityId: row.cycle.id, actorId: actor?.userId, event: "cycle.created", details: { state: row.cycle.state } });
      if (row.cycle.state === "open" && row.cycle.overdue) source.clients.appendHistory({ entityId: row.cycle.id, actorId: actor?.userId, event: "cycle.activated_overdue", details: {} });
    }
    source.clients.appendHistory({ entityId: source.team.workspace.id, actorId: actor?.userId, event: "import.committed", details: { count: created.length } });
    batch.result = result; if (key) receipts.current.set(key, result);
    if (scenario === "lost-receipt" && attempts.current++ === 0) throw new Error("Synthetic committed receipt lost");
    return { status: "success", operation: "commit", result };
  };
  const templateAction: ImportTemplateAction = async signal => { await pause(signal); if (!canReadImportTemplate(access)) return fail("forbidden", "The CSV template is unavailable for this access."); if (scenario === "template-error") return fail("temporarily_unavailable", "The template couldn’t load. Check the connection and retry."); return { status: "success", csv: importColumns.join(",") + "\r\n" }; };
  function sample(kind: Parameters<typeof fixture>[0]) { if (!clients.clients.some(row => row.id === clientId)) clients.saveClient({ id: clientId, name: "Acme Studio", version: 1, archivedAt: null }); setFile(fixture(kind)); attempts.current = 0; setGeneration(value => value + 1); }
  const blocked = ["session", "email", "mfa"].includes(scenario);
  return <><DashboardPreviewShell workspace={blocked ? null : { ...team.workspace, role: access.role }} activeSection="Renewals" clientsHref="/clients" preview>{blocked ? <section className="rr-follow__status"><h1>{scenario === "session" ? "Sign in to continue" : scenario === "email" ? "Verify your email" : "Verify your sign-in"}</h1><p>Restore account access before uploading workspace records.</p><Link className="rr-dashboard__primary" href={scenario === "session" ? "/login" : scenario === "email" ? "/check-email" : "/two-factor"}>Continue</Link></section> : access.role === "member" ? <section className="rr-follow__status"><h1>Import access is restricted</h1><p>Ask an owner or admin to import this workspace’s renewals.</p><Link className="rr-clients__outline-action" href="/renewals">View renewals</Link></section> : <ImportFlow key={generation} workspaceName={team.workspace.name} timezone={team.workspace.timezone} access={access} action={action} templateAction={templateAction} initialFile={file} references={{ complete: true, clients: clients.clients.filter(row => !row.archivedAt).map(row => ({ id: row.id, label: row.name })), operators: team.members.map(row => ({ id: row.userId, label: row.email })) }} preview />}</DashboardPreviewShell><details className="rr-auth__review rr-import__tools"><summary>Local preview tools</summary><p>Synthetic files and staging only. Imported samples join the existing preview. No upload, API, provider, email or payment service is called. Refreshing clears staging and receipts.</p><div className="rr-auth__review-controls"><label htmlFor="import-scenario">Screen state<select id="import-scenario" value={scenario} onChange={event => { setScenario(event.target.value as Scenario); attempts.current = 0; setGeneration(value => value + 1); }}>{scenarios.map(value => <option key={value}>{value}</option>)}</select></label><label htmlFor="import-access">Sample access<select id="import-access" value={settings.billing.mode} onChange={event => { settings.setMode(event.target.value as typeof settings.billing.mode); setGeneration(value => value + 1); }}>{["paid", "trial", "read_only", "deleting"].map(value => <option key={value}>{value}</option>)}</select></label>{(["valid", "invalid", "duplicates", "overdue"] as const).map(kind => <button key={kind} className="rr-clients__outline-action" onClick={() => sample(kind)}>Use {kind} sample</button>)}<button className="rr-clients__outline-action" onClick={() => { batches.current.clear(); receipts.current.clear(); attempts.current = 0; setScenario("normal"); setFile(null); setGeneration(value => value + 1); }}>Reset import staging</button></div><AuthNotice>Sample-file buttons add an active Acme Studio client when needed. They do not replace your other temporary preview records.</AuthNotice><nav aria-label="Import preview navigation"><Link href="/renewals">Renewals</Link><Link href="/clients">Clients and contacts</Link><Link href="/team">Team references</Link></nav></details></>;
}
