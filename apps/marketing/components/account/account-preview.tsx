"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "../../../../packages/ui/dashboard/dashboard-shell";
import { AccountOverview } from "../../../../packages/ui/account/account-overview";
import { AccountSessions } from "../../../../packages/ui/account/account-sessions";
import { AccountSecurity, PersonalExport } from "../../../../packages/ui/account/account-data";
import { AccountDeletion } from "../../../../packages/ui/account/account-delete";
import { accountPageInput, deleteAccountInput, revokeSessionsInput, sessionPageInput, type AccountDeleteAction, type AccountExport, type AccountReadAction, type DeletionEligibility, type Page, type RevokeAction } from "../../../../packages/ui/account/contracts";
import { useAccountPreview } from "./account-preview-store";
type View = "overview" | "sessions" | "security" | "export" | "delete";
type Scenario = "normal" | "loading" | "load-error" | "empty" | "session" | "email" | "mfa" | "recent-login" | "no-mfa" | "no-current" | "missing-details" | "read-error" | "network" | "lost-receipt" | "rate" | "conflict" | "zero-revoked" | "eligible" | "invalid-password" | "membership-changed" | "deletion-network" | "eligibility-error" | "server-error";
const scenarios: Scenario[] = ["normal", "loading", "load-error", "empty", "session", "email", "mfa", "recent-login", "no-mfa", "no-current", "missing-details", "read-error", "network", "lost-receipt", "rate", "conflict", "zero-revoked", "eligible", "invalid-password", "membership-changed", "deletion-network", "eligibility-error", "server-error"];
const section = { overview: "Overview", sessions: "Sessions", security: "Security activity", export: "Data export", delete: "Deletion" } as const;
const fail = (code: string, message: string) => ({ status: "error" as const, code, message });
function pause(signal: AbortSignal) { return new Promise<void>((resolve, reject) => { if (signal.aborted) { reject(new Error("Aborted")); return; } const cancel = () => { clearTimeout(timer); reject(new Error("Aborted")); }; const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, 350); signal.addEventListener("abort", cancel, { once: true }); }); }
function pageOf<T>(rows: T[], after: string | undefined, limit: number, id: (row: T) => string): Page<T> { const start = after ? rows.findIndex(row => id(row) === after) + 1 : 0; const items = rows.slice(start, start + limit); return { items, nextCursor: start + limit < rows.length ? id(items.at(-1)!) : null }; }
function eligibility(eligible: boolean): DeletionEligibility { return { eligible, retainedMemberships: eligible ? 0 : 3, requirement: "Resolve active and retained workspace memberships under the approved retention policy before deleting this shared identity. Removing access alone does not remove a retained membership.", scope: "Database identity, sessions, accounts, MFA credentials and identity verification records. Provider records and backups follow separately approved retention." }; }
export function AccountPreview({ view }: { view: View }) {
  const store = useAccountPreview(), latest = useRef(store); latest.current = store;
  const [scenario, setScenario] = useState<Scenario>("normal"), [generation, setGeneration] = useState(0), [terminalReceipt, setTerminalReceipt] = useState(false), [membershipChanged, setMembershipChanged] = useState(false);
  const receipt = useRef<{ input: string; revoked: number } | null>(null), attempts = useRef(0);
  const profile = { ...store.profile, twoFactorEnabled: scenario !== "no-mfa" }, access = { recentAuth: scenario !== "recent-login", mfaVerified: !["mfa", "no-mfa"].includes(scenario) };
  const sessionRows = scenario === "empty" ? [] : store.sessions.map(row => scenario === "missing-details" ? { ...row, ipAddress: null, userAgent: "Reported agent <script>text only</script> " + "long-agent/".repeat(40) } : row).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const events = scenario === "empty" ? [] : [...store.events].sort((a, b) => a.id.localeCompare(b.id));
  function exported(after?: string): AccountExport { const memberships = scenario === "empty" ? [] : [{ id: "00000000-0000-4000-8000-000000000001", workspaceId: "00000000-0000-4000-8000-000000000001", role: "owner" as const, joinedAt: "2026-10-01T09:00:00Z", removedAt: null }, { id: "b0000000-0000-4000-8000-000000000002", workspaceId: "b0000000-0000-4000-8000-000000000002", role: "member" as const, joinedAt: "2026-09-01T09:00:00Z", removedAt: "2026-10-01T09:00:00Z" }, { id: "b0000000-0000-4000-8000-000000000003", workspaceId: "b0000000-0000-4000-8000-000000000003", role: "admin" as const, joinedAt: "2026-10-01T09:00:00Z", removedAt: null }]; return { profile, accounts: [{ providerId: "credential", accountId: profile.id, createdAt: profile.createdAt, updatedAt: profile.updatedAt }], memberships: pageOf(memberships, after, 2, row => row.id), sessions: "/api/v1/account/sessions", securityEvents: "/api/v1/account/security-events", workspaceData: "Owners export each workspace using paginated workspace datasets." }; }
  const eligible = ["eligible", "invalid-password", "membership-changed", "deletion-network", "rate", "network"].includes(scenario) && !membershipChanged;
  const read: AccountReadAction = async (command, signal) => {
    await pause(signal);
    if (scenario === "read-error" || scenario === "eligibility-error" && command.operation === "eligibility") return fail("temporarily_unavailable", "Account data could not refresh. Check the connection and try again.");
    if (command.operation === "eligibility") return { status: "success", operation: "eligibility", data: eligibility(eligible) };
    const parsed = command.operation === "sessions" ? sessionPageInput.safeParse({ ...command.query, limit: String(command.query.limit ?? 25) }) : accountPageInput.safeParse({ ...command.query, limit: String(command.query.limit ?? 25) });
    if (!parsed.success) return fail("invalid_request", "Use the cursor supplied by this account page.");
    if (command.operation === "sessions") { if (command.query.after && !sessionRows.some(row => row.id === command.query.after)) return fail("invalid_cursor", "A session cursor is no longer available. Refresh from the first page."); return { status: "success", operation: "sessions", page: pageOf(sessionRows, command.query.after, command.query.limit, row => row.id) }; }
    if (command.operation === "events") return { status: "success", operation: "events", page: pageOf(events, command.query.after, command.query.limit ?? 25, row => row.id) };
    return { status: "success", operation: "export", data: exported(command.query.after) };
  };
  const revoke: RevokeAction = async (input, signal) => {
    await pause(signal); const key = JSON.stringify(input);
    if (receipt.current?.input === key) return { status: "success", revoked: receipt.current.revoked };
    if (!access.recentAuth) return fail("reauthentication_required", "Sign in again before revoking sessions.");
    if (!access.mfaVerified) return fail("mfa_required", "Verify an authenticator before revoking sessions.");
    if (!revokeSessionsInput.safeParse(input).success) return fail("invalid_request", "Choose one session or all sessions.");
    if (scenario === "server-error") return fail("internal_error", "Unexpected revocation response.");
    if (scenario === "network" && attempts.current++ === 0) throw new Error("Synthetic unknown revocation");
    if (scenario === "rate") return { ...fail("rate_limited", "Too many attempts. Wait before retrying."), retryAfterSeconds: 5 };
    if (scenario === "conflict") return fail("idempotency_conflict", "The original session request could not be matched. Resolve its receipt before starting another request.");
    const revoked = scenario === "zero-revoked" ? 0 : latest.current.revoke("sessionId" in input ? input.sessionId : null);
    receipt.current = { input: key, revoked };
    if (scenario === "lost-receipt" && attempts.current++ === 0) throw new Error("Synthetic committed receipt lost");
    return { status: "success", revoked };
  };
  const deletion: AccountDeleteAction = async (input, signal) => {
    await pause(signal);
    if (!access.recentAuth) return fail("reauthentication_required", "Sign in again before deleting this account.");
    if (!access.mfaVerified) return fail("mfa_required", "Verify an authenticator before deleting this account.");
    if (!deleteAccountInput.safeParse(input).success) return fail("invalid_request", "Check the email and current password.");
    if (input.confirmEmail.toLowerCase() !== profile.email.toLowerCase()) return fail("confirmation_mismatch", "Confirm the verified account email.");
    if (scenario === "deletion-network" || scenario === "network") throw new Error("Synthetic unknown deletion outcome");
    if (scenario === "rate") return { ...fail("rate_limited", "Too many deletion attempts. Wait before entering credentials again."), retryAfterSeconds: 5 };
    if (scenario === "invalid-password") return fail("invalid_credentials", "The sample credentials could not be verified. Re-enter a sample password.");
    if (scenario === "membership-changed") { setMembershipChanged(true); return fail("identity_in_use", "A retained membership blocks deletion. Check eligibility again."); }
    if (!eligible) return fail("identity_in_use", "Resolve retained memberships before deleting your account.");
    return { status: "success", deleted: true };
  };
  const blocked = ["session", "email", "mfa"].includes(scenario), ended = store.status !== "active" && !terminalReceipt;
  return <><DashboardShell workspace={null} activeSection="Account" personal={{ name: blocked || store.status !== "active" ? "Your account" : profile.name, email: blocked || store.status !== "active" ? "" : profile.email, section: section[view] }} preview>{scenario === "loading" ? <section className="rr-clients__loading" role="status">Loading account information…</section> : scenario === "load-error" ? <section className="rr-clients__loading"><h1>Account information couldn’t load</h1><p>No account action has been submitted.</p><button className="rr-dashboard__primary" onClick={() => setScenario("normal")}>Try again</button></section> : blocked || ended ? <section className="rr-follow__status"><h1>{scenario === "email" ? "Verify your email" : scenario === "mfa" ? "Verify your sign-in" : store.status.endsWith("unconfirmed") ? "Account action needs verification" : "Sign in to continue"}</h1><p>{ended ? store.status.endsWith("unconfirmed") ? "The original account action is unconfirmed. Check sign-in and resolve its result before starting another request." : "This sample identity no longer has an active sign-in. Reset account samples to review another local flow." : "Restore account access before opening personal data."}</p><Link className="rr-dashboard__primary" href={scenario === "email" ? "/check-email" : scenario === "mfa" ? "/two-factor" : "/login"}>Continue</Link></section> : view === "overview" ? <AccountOverview profile={profile} /> : view === "sessions" ? <AccountSessions key={generation} profile={profile} access={access} initialPage={pageOf(sessionRows, undefined, 2, row => row.id)} pageSize={2} currentSessionId={scenario === "no-current" ? null : "sample-current-session"} read={read} revoke={revoke} preview onUnconfirmedEnd={() => { setTerminalReceipt(true); store.endIdentity("revocation-unconfirmed"); }} onIdentityEnded={() => { setTerminalReceipt(true); store.endIdentity("signed-out"); }} /> : view === "security" ? <AccountSecurity key={generation} profile={profile} initialPage={pageOf(events, undefined, 2, row => row.id)} pageSize={2} read={read} /> : view === "export" ? <PersonalExport key={generation} profile={profile} initialData={exported()} pageSize={2} read={read} preview /> : <AccountDeletion key={generation} profile={profile} access={access} initialEligibility={scenario === "eligibility-error" ? null : eligibility(eligible)} read={read} action={deletion} preview onUnconfirmed={() => { setTerminalReceipt(true); store.endIdentity("deletion-unconfirmed"); }} onDeleted={() => { setTerminalReceipt(true); store.endIdentity("deleted"); }} />}</DashboardShell><details className="rr-auth__review rr-account__tools"><summary>Local preview tools</summary><p>Synthetic identity, sessions and account data only. No API, real session, password verification, account deletion or provider operation occurs. Sample credentials stay only in the form until an attempted request.</p><div className="rr-auth__review-controls"><label htmlFor="account-scenario">Screen state<select id="account-scenario" value={scenario} onChange={event => { setScenario(event.target.value as Scenario); attempts.current = 0; receipt.current = null; setTerminalReceipt(false); setMembershipChanged(false); setGeneration(value => value + 1); }}>{scenarios.map(value => <option key={value}>{value}</option>)}</select></label><button className="rr-clients__outline-action" onClick={() => { store.reset(); setScenario("normal"); setTerminalReceipt(false); setMembershipChanged(false); receipt.current = null; attempts.current = 0; setGeneration(value => value + 1); }}>Reset account samples</button></div><nav aria-label="Account preview navigation"><Link href="/account">Overview</Link><Link href="/account/sessions">Sessions</Link><Link href="/account/security">Activity</Link><Link href="/account/export">Export</Link><Link href="/account/delete">Deletion</Link></nav></details></>;
}
