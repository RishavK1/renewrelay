"use client";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { emptyBillingCommand, requestDeletion } from "../../../../packages/contracts/billing";
import { dataExportInput, csvExportInput, timezoneChangeInput, timezonePreviewInput, type Billing, type ExportCommand, type ExportResult, type Lifecycle, type SettingsAccess, type SettingsCommand, type SettingsResult, type TimezonePreview } from "../../../../packages/ui/settings/contracts";
import { canChangeTimezone, canExportSettings, canStartCheckout } from "../../../../packages/ui/settings/policy";
import { useClientPreview } from "../clients/client-preview-store";
import { useTeamPreview } from "../team/team-preview-store";
import { refreshPreviewRecord } from "../renewals/renewal-fixtures";
function instant(days: number) { return new Date(Date.parse(new Date().toISOString().slice(0, 10) + "T12:00:00Z") + days * 86400000).toISOString(); }
function initialBilling(): Billing { return { mode: "paid", writable: true, limits: { items: 100, seats: 5 }, usage: { items: 0, seats: 4 }, trialEndsAt: instant(-20), paidThrough: instant(20), graceEndsAt: null, cancellationScheduled: false, deletionRequestedAt: null, purgeAfter: null, providerStatus: "active", checkoutState: null, checkoutUrl: null, version: 1 }; }
const fail = (code: string, message: string): Extract<SettingsResult, { status: "error" }> => ({ status: "error", code, message });
type Store = { billing: Billing; lifecycle: Lifecycle; execute: (command: SettingsCommand, access: SettingsAccess, processing?: boolean) => Promise<SettingsResult>; exportRecords: (command: ExportCommand, access: SettingsAccess) => ExportResult; setMode: (mode: Billing["mode"]) => void; reset: () => void };
const Context = createContext<Store | null>(null);
export function SettingsPreviewProvider({ children }: { children: ReactNode }) {
  const [billing, setBilling] = useState(initialBilling), latest = useRef(billing); latest.current = billing;
  const team = useTeamPreview(), clients = useClientPreview(), sources = useRef({ team, clients }); sources.current = { team, clients };
  const prior = useRef<Billing | null>(null);
  function update(value: Billing) { latest.current = value; setBilling(value); }
  const projection: Billing = { ...billing, usage: { items: new Set(clients.renewals.filter(row => !row.item.archivedAt).map(row => row.item.id)).size, seats: team.members.length + team.invitations.filter(row => !row.acceptedAt && !row.revokedAt && Date.parse(row.expiresAt) > Date.now()).length } };
  const lifecycle: Lifecycle = { workspaceDeletion: { recoveryDays: 30, requestedAt: billing.deletionRequestedAt, purgeAfter: billing.purgeAfter, purgedAt: null, providerCancellationRequired: !!billing.providerStatus || !!billing.checkoutState }, temporaryData: { uncommittedImportHours: 24, decisionSessionMinutes: 10, rateCounters: "Expire at their configured rate window" }, financialAndAuditRetention: "Financial and audit retention requires an approved policy; no new automatic deletion is enabled.", sharedIdentity: "Shared account identity is retained while workspace membership remains. Account deletion is a separate process.", externalSystems: "Provider records, backups and recovery ledgers require separate verification." };
  async function snapshot(zone: string): Promise<TimezonePreview> {
    const source = sources.current, pool = source.clients.renewals.filter(row => !row.cycle.closedAt).sort((a, b) => a.cycle.id.localeCompare(b.cycle.id));
    const cycles = pool.map(({ cycle }) => ({ id: cycle.id, version: cycle.version, fromTimezone: cycle.timezone, toTimezone: zone, approvalInvalidated: source.clients.decisions.some(row => row.cycleId === cycle.id && !row.superseded), dates: { expiryOn: cycle.expiryOn, noticeBy: cycle.noticeBy, respondBy: cycle.respondBy } }));
    const serialized = JSON.stringify([source.team.workspace.id, source.team.workspace.version, zone, pool.map(({ cycle }) => [cycle.id, cycle.version, source.clients.decisions.filter(row => row.cycleId === cycle.id && !row.superseded).map(row => row.id).sort()])]);
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serialized));
    return { timezone: zone, previousTimezone: source.team.workspace.timezone, expectedVersion: source.team.workspace.version, affectedCount: cycles.length, cycles, previewToken: Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("") };
  }
  async function execute(command: SettingsCommand, access: SettingsAccess, processing = false): Promise<SettingsResult> {
    if (access.role !== "owner") return fail("forbidden", "Only the workspace owner can perform this action.");
    if (command.operation !== "timezone.preview" && !access.recentAuth) return fail("reauthentication_required", "Sign in again before confirming this change.");
    if (command.operation === "timezone.preview" || command.operation === "timezone.change") {
      if (latest.current.mode === "deleting") return fail("workspace_deleting", "Timezone changes are unavailable while deletion is requested.");
      if (!timezonePreviewInput.safeParse({ timezone: command.input.timezone }).success) return fail("invalid_request", "Use a valid IANA timezone.");
      const impact = await snapshot(command.input.timezone);
      if (impact.affectedCount > 1000) return fail("reschedule_limit", "Timezone changes support at most 1,000 unclosed renewals.");
      if (command.operation === "timezone.preview") return { status: "success", operation: command.operation, preview: impact };
      if (!canChangeTimezone({ ...access, writable: latest.current.writable })) return fail("workspace_read_only", "Timezone changes need a writable workspace and recent sign-in.");
      if (!timezoneChangeInput.safeParse(command.input).success) return fail("invalid_request", "Review the timezone change again.");
      if (impact.expectedVersion !== command.input.expectedVersion || impact.previewToken !== command.input.previewToken) return fail("stale_preview", "Workspace or renewal data changed. Refresh the impact preview.");
      if (impact.timezone === impact.previousTimezone) return { status: "success", operation: command.operation, timezone: impact.timezone, version: impact.expectedVersion, affectedCount: 0 };
      const source = sources.current, ids = new Set(impact.cycles.map(row => row.id)), revoked = new Set(impact.cycles.filter(row => row.approvalInvalidated).map(row => row.id));
      source.team.updateWorkspace({ timezone: impact.timezone, version: impact.expectedVersion + 1 });
      for (const row of source.clients.decisions.filter(row => ids.has(row.cycleId))) source.clients.saveDecision({ ...row, superseded: true });
      for (const row of source.clients.renewals.filter(row => ids.has(row.cycle.id))) source.clients.saveRenewal(refreshPreviewRecord({ ...row, cycle: { ...row.cycle, timezone: impact.timezone, version: row.cycle.version + 1, ...(revoked.has(row.cycle.id) ? { state: "open", intendedAction: null, nextActionOn: row.cycle.respondBy ?? row.cycle.noticeBy ?? row.cycle.expiryOn } : {}) } }));
      return { status: "success", operation: command.operation, timezone: impact.timezone, version: impact.expectedVersion + 1, affectedCount: impact.affectedCount };
    }
    const value = latest.current;
    if (command.operation === "delete") {
      const parsed = requestDeletion.safeParse(command.input);
      if (!parsed.success || parsed.data.confirmName !== sources.current.team.workspace.name) return fail("invalid_request", "The workspace name must match exactly.");
      if (value.deletionRequestedAt && value.purgeAfter) return { status: "success", operation: "delete", purgeAfter: value.purgeAfter };
      prior.current = value; const purgeAfter = instant(30);
      update({ ...value, mode: "deleting", writable: false, cancellationScheduled: true, deletionRequestedAt: new Date().toISOString(), purgeAfter, version: value.version + 1 });
      const source = sources.current;
      source.team.revokePendingInvitations();
      source.clients.revokeDecisionLinks(source.clients.decisions.map(row => row.id));
      return { status: "success", operation: "delete", purgeAfter };
    }
    if (!emptyBillingCommand.safeParse(command.input).success) return fail("invalid_request", "No additional fields are supported for this action.");
    if (command.operation === "restore") {
      if (!value.deletionRequestedAt || !value.purgeAfter || Date.parse(value.purgeAfter) <= Date.now()) return fail("recovery_unavailable", "The recovery window is no longer available.");
      const before = prior.current ?? initialBilling();
      update({ ...before, cancellationScheduled: true, deletionRequestedAt: null, purgeAfter: null, version: value.version + 1 });
      return { status: "success", operation: "restore", recovered: true };
    }
    if (value.mode === "deleting") return fail("workspace_deleting", "Use deletion and recovery to review this workspace.");
    if (command.operation === "checkout") {
      if (!canStartCheckout(value)) return fail("paid_period_active", "A verified paid period is already active.");
      update({ ...value, checkoutState: processing ? "uncertain" : "ready", checkoutUrl: processing ? null : "https://checkout.example.invalid/sample", version: value.version + 1 });
      return { status: "success", operation: "checkout", state: processing ? "processing" : "ready", checkoutUrl: processing ? null : "https://checkout.example.invalid/sample" };
    }
    if (!value.providerStatus) return fail("subscription_unavailable", "No provider subscription is available to cancel.");
    update({ ...value, cancellationScheduled: true, version: value.version + 1 });
    return { status: "success", operation: "cancel", state: processing ? "processing" : "scheduled" };
  }
  function exportRecords(command: ExportCommand, access: SettingsAccess): ExportResult {
    if (!canExportSettings({ ...access, deleting: latest.current.mode === "deleting" }, command.kind)) return fail("forbidden", "This export is unavailable for your access or workspace state.");
    const source = sources.current;
    if (command.kind === "csv") {
      if (!csvExportInput.safeParse(command.query).success) return fail("invalid_request", "Check your export filters.");
      const query = command.query, rows = source.clients.renewals.filter(row => (query.archived === "include" || !row.item.archivedAt) && (!query.status || row.cycle.state === query.status) && (!query.from || row.cycle.expiryOn >= query.from) && (!query.through || row.cycle.expiryOn <= query.through));
      if (rows.length > 10000) return fail("export_limit", "Narrow your filters to export at most 10,000 renewals.");
      return { status: "success", kind: "csv", count: rows.length };
    }
    // Query has already been parsed; don't reparse transformed numeric limit.
    const query = command.query;
    if (!dataExportInput.safeParse({ ...query, limit: String(query.limit) }).success || query.asOf && Date.parse(query.asOf) > Date.now()) return fail("invalid_request", "Use the page size and cutoff from the current export.");
    const asOf = query.asOf ?? new Date().toISOString();
    const datasets: Partial<Record<typeof query.dataset, unknown[]>> = { workspace: [source.team.workspace], members: source.team.members.map(row => ({ ...row, id: row.userId })), invitations: source.team.invitations, clients: source.clients.clients, contacts: source.clients.contacts, items: [...new Map(source.clients.renewals.map(row => [row.item.id, row.item])).values()], cycles: source.clients.renewals.map(row => row.cycle), audit: source.clients.history };
    const rows = datasets[query.dataset] ?? [], size = query.dataset === "imports" ? 1 : query.limit;
    const offset = query.after ? Number(query.after.split("-").at(-1)) : 0;
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > rows.length) return fail("invalid_cursor", "Start a fresh sample export.");
    const next = offset + size < rows.length ? `90000000-0000-4000-8000-${String(offset + size).padStart(12, "0")}` : null;
    return { status: "success", kind: "data", dataset: query.dataset, asOf, items: rows.slice(offset, offset + size), nextCursor: next };
  }
  function setMode(mode: Billing["mode"]) { const base = initialBilling(); update({ ...base, mode, writable: !["read_only", "deleting"].includes(mode), limits: mode === "trial" || mode === "read_only" ? { items: 10, seats: 3 } : base.limits, paidThrough: mode === "trial" || mode === "read_only" ? null : mode === "grace" ? instant(-3) : base.paidThrough, trialEndsAt: mode === "trial" ? instant(10) : base.trialEndsAt, graceEndsAt: mode === "grace" ? instant(4) : null, providerStatus: mode === "trial" || mode === "read_only" ? null : "active", ...(mode === "deleting" && { deletionRequestedAt: instant(-1), purgeAfter: instant(29), cancellationScheduled: true }) }); }
  return <Context.Provider value={{ billing: projection, lifecycle, execute, exportRecords, setMode, reset: () => { prior.current = null; update(initialBilling()); } }}>{children}</Context.Provider>;
}
export function useSettingsPreview() { const store = useContext(Context); if (!store) throw new Error("Settings preview provider is required."); return store; }
export function usePreviewWritable() { return useSettingsPreview().billing.writable; }
