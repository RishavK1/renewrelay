"use client";
import { useSettingsPreview } from "../settings/settings-preview-store";

import { useRef, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "../../../../packages/ui/dashboard/dashboard-shell";
import { AuthNotice } from "../../../../packages/ui/auth/auth-fields";
import { TeamDirectory } from "../../../../packages/ui/team/team-directory";
import { TeamForm } from "../../../../packages/ui/team/team-form";
import { AcceptTeamInvitation } from "../../../../packages/ui/team/accept-invitation";
import type { AcceptTeamAction, TeamAccess, TeamAction, TeamCommand, TeamResult } from "../../../../packages/ui/team/contracts";
import { useTeamPreview } from "./team-preview-store";

type View = TeamCommand["operation"] | "directory";
type Scenario = "normal" | "loading" | "error" | "read-only" | "deleting" | "as-admin" | "as-member" | "session" | "email" | "mfa" | "recent-login" | "network" | "lost-receipt" | "rate" | "stale" | "seat-limit" | "empty-invitations";
const scenarios: Scenario[] = ["normal", "loading", "error", "read-only", "deleting", "as-admin", "as-member", "session", "email", "mfa", "recent-login", "network", "lost-receipt", "rate", "stale", "seat-limit", "empty-invitations"];
function pause(signal: AbortSignal) { return new Promise<void>((resolve, reject) => { if (signal.aborted) { reject(new Error("Aborted")); return; } const cancel = () => { clearTimeout(timer); reject(new Error("Aborted")); }; const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, 450); signal.addEventListener("abort", cancel, { once: true }); }); }

export function TeamPreview({ view, targetId }: { view: View; targetId?: string }) {
  const store = useTeamPreview(), latest = useRef(store); latest.current = store;
  const [scenario, setScenario] = useState<Scenario>("normal"), [generation, setGeneration] = useState(0), [visible, setVisible] = useState(3);
  const attempts = useRef(0);
  const receipt = useRef<{ command: string; result: Extract<TeamResult, { status: "success" }> } | null>(null);
  const actorId = scenario === "as-admin" ? "preview-admin" : scenario === "as-member" ? "preview-member" : "preview-owner";
  const actor = store.members.find(row => row.userId === actorId);
  const settings = useSettingsPreview();
  const access: TeamAccess = { actorId, role: actor?.role ?? "member", seatLimit: settings.billing.limits.seats, writable: settings.billing.writable && scenario !== "read-only", deleting: settings.billing.mode === "deleting" || scenario === "deleting", recentAuth: scenario !== "recent-login" };
  const workspace = { ...store.workspace, role: access.role };
  const member = store.members.find(row => row.userId === targetId);
  const lastMember = useRef(member); if (member) lastMember.current = member;
  const invitation = store.invitations.find(row => row.id === targetId);
  const action: TeamAction = async (command, signal) => {
    await pause(signal);
    const fingerprint = JSON.stringify(command);
    if (receipt.current?.command === fingerprint) return receipt.current.result;
    if (scenario === "network" && attempts.current++ === 0) throw new Error("Synthetic unknown result");
    if (scenario === "rate") return { status: "error", code: "rate_limited", message: "Too many attempts. Wait before retrying.", retryAfterSeconds: 10 };
    if (scenario === "stale") return { status: "error", code: "stale_version", message: "The workspace changed. Return to the team and review the latest details." };
    if (scenario === "seat-limit" && command.operation === "invite") return { status: "error", code: "seat_limit", message: "All sample seats are in use or reserved. Revoke a pending invitation or ask the owner to review access." };
    const current = latest.current, currentActor = current.members.find(row => row.userId === actorId);
    if (!currentActor) return { status: "error", code: "not_found", message: "Your membership is no longer available." };
    const result = current.execute(command, { ...access, role: currentActor.role });
    if (result.status === "success") receipt.current = { command: fingerprint, result };
    if (result.status === "success" && scenario === "lost-receipt" && attempts.current++ === 0) throw new Error("Synthetic committed change with lost receipt");
    return result;
  };
  const blocked = ["session", "email", "mfa"].includes(scenario);
  const recovery = scenario === "session" ? "/login" : scenario === "email" ? "/check-email" : "/two-factor";
  const missing = view === "remove" && !lastMember.current || view === "revoke" && !invitation;
  return <><DashboardShell workspace={blocked || scenario === "loading" || scenario === "error" ? null : workspace} activeSection="Team" clientsHref="/clients" preview>
    {scenario === "loading" ? <div className="rr-clients__loading" role="status">Loading team access…</div> : scenario === "error" ? <div className="rr-clients__loading"><h1>The team couldn’t load</h1><p>Check your connection and try again.</p><button className="rr-dashboard__primary" onClick={() => setScenario("normal")}>Try again</button></div> : blocked ? <div className="rr-clients__loading"><h1>{scenario === "session" ? "Sign in to continue" : scenario === "email" ? "Verify your email" : "Verify your sign-in"}</h1><p>Restore account access before opening this workspace’s team.</p><Link className="rr-dashboard__primary" href={recovery}>Continue</Link></div> : !actor || access.role === "member" || access.deleting ? <TeamDirectory workspace={workspace} access={access} members={[]} invitations={[]} /> : missing ? <div className="rr-clients__loading"><h1>Team record isn’t available</h1><p>Open a current member or invitation from the team directory.</p><Link className="rr-dashboard__primary" href="/team">View team</Link></div> : <>
      {view !== "directory" && !access.writable && <AuthNotice>Read-only workspace. Removing members and revoking invitations remain available; new invitations and ownership transfer do not.</AuthNotice>}
      {view === "directory" ? <TeamDirectory workspace={workspace} access={access} members={store.members} invitations={scenario === "empty-invitations" ? [] : store.invitations.slice(0, visible)} nextCursor={scenario !== "empty-invitations" && store.invitations.length > visible ? "sample-more" : null} onLoadMore={() => setVisible(value => value + 3)} /> : <TeamForm key={`${view}-${targetId ?? "new"}-${generation}`} mode={view} workspace={workspace} access={access} members={store.members} member={member ?? lastMember.current} invitation={invitation} action={action} preview />}
    </>}
  </DashboardShell><details className="rr-auth__review"><summary>Local preview tools</summary><p>Synthetic directory and roles only. No invitations, API requests, access changes or emails are sent. Normal preview uses a five-seat sample; it is not a live billing projection. Refreshing resets these records.</p><div className="rr-auth__review-controls"><label htmlFor="team-scenario">Screen state<select id="team-scenario" value={scenario} onChange={event => { setScenario(event.target.value as Scenario); receipt.current = null; attempts.current = 0; setGeneration(value => value + 1); }}>{scenarios.map(value => <option key={value}>{value}</option>)}</select></label><button type="button" className="rr-clients__outline-action" onClick={() => { store.reset(); setScenario("normal"); setVisible(3); receipt.current = null; attempts.current = 0; setGeneration(value => value + 1); }}>Reset team samples</button></div><nav aria-label="Team preview navigation"><Link href="/team">Team directory</Link><Link href="/team/invite">Invite teammate</Link><Link href="/team/members/preview-member/remove">Remove sample member</Link><Link href="/team/transfer-ownership">Transfer ownership</Link><Link href="/accept-invitation">Accept sample invitation</Link></nav></details></>;
}

type AcceptScenario = "normal" | "signed-out" | "email" | "mfa" | "unavailable" | "wrong-account" | "network" | "rate" | "seat-limit" | "read-only";
export function InvitationAcceptancePreview() {
  const store = useTeamPreview(), latest = useRef(store); latest.current = store;
  const [scenario, setScenario] = useState<AcceptScenario>("normal"), [generation, setGeneration] = useState(0);
  const attempts = useRef(0);
  const settings = useSettingsPreview();
  const email = scenario === "wrong-account" ? "other@sample.example" : "taylor@northline.example";
  const action: AcceptTeamAction = async signal => {
    await pause(signal);
    if (scenario === "network" && attempts.current++ === 0) throw new Error("Synthetic unknown acceptance");
    if (scenario === "rate") return { status: "error", code: "rate_limited", message: "Too many attempts. Wait before retrying.", retryAfterSeconds: 10 };
    if (scenario === "seat-limit") return { status: "error", code: "seat_limit", message: "This workspace has no available seats. Ask its owner to review access." };
    if (scenario === "read-only") return { status: "error", code: "workspace_read_only", message: "This workspace can’t accept new members right now. Contact its owner." };
    if (!settings.billing.writable) return { status: "error", code: "workspace_read_only", message: "This workspace cannot accept new members right now." };
    return latest.current.accept(email, settings.billing.limits.seats);
  };
  return <><AcceptTeamInvitation key={generation} account={scenario === "signed-out" ? null : { email, emailVerified: scenario !== "email", mfaRequired: scenario === "mfa", mfaVerified: false }} unavailable={scenario === "unavailable"} action={action} preview /><details className="rr-auth__review"><summary>Local preview tools</summary><p>No credential is present in this page or its URL. The production adapter will bind the real invitation token to the acceptance action. There is no public invitation-preview endpoint.</p><label htmlFor="accept-team-scenario">Screen state<select id="accept-team-scenario" value={scenario} onChange={event => { setScenario(event.target.value as AcceptScenario); attempts.current = 0; setGeneration(value => value + 1); }}>{["normal", "signed-out", "email", "mfa", "unavailable", "wrong-account", "network", "rate", "seat-limit", "read-only"].map(value => <option key={value}>{value}</option>)}</select></label><button type="button" className="rr-clients__outline-action" onClick={() => { store.reset(); attempts.current = 0; setGeneration(value => value + 1); }}>Reset invitation sample</button><Link href="/team">Team directory</Link></details></>;
}
