"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { createInvitation, transferOwnership } from "../../contracts/api";
import { removal } from "../../contracts/renewals";
import { AuthField, AuthNotice, AuthSuccessMark } from "../auth/auth-fields";
import { NativeSelect } from "../primitives/native-select";
import { useDecisionAction } from "../decisions/use-preview-action";
import type { TeamAccess, TeamAction, TeamCommand, TeamInvitation, TeamMember, TeamResult, TeamWorkspace } from "./contracts";
import { canInviteTeam, canRemoveTeamMember, canRevokeTeamInvitation, canTransferTeam, roleLabels, teamInstant } from "./policy";

type Mode = TeamCommand["operation"];
const titles = { invite: "Invite a teammate", revoke: "Revoke invitation", remove: "Remove teammate", transfer: "Transfer ownership" };
function Values({ values }: { values: Record<string, ReactNode> }) { return <dl className="rr-follow__review-list">{Object.entries(values).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>; }
const terminalCodes = ["forbidden", "unauthenticated", "email_unverified", "mfa_required", "reauthentication_required", "workspace_deleting", "not_found", "stale_version", "idempotency_conflict", "invite_closed", "owner_required", "self_removal"];

export function TeamForm({ mode, workspace, access, members, invitation, member, action, preview = false }: {
  mode: Mode; workspace: TeamWorkspace; access: TeamAccess; members: TeamMember[];
  invitation?: TeamInvitation; member?: TeamMember; action: TeamAction; preview?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [selectedUser, setSelectedUser] = useState("");
  const [error, setError] = useState("");
  const [reviewed, setReviewed] = useState<TeamCommand | null>(null);
  const [saved, setSaved] = useState<Extract<TeamResult, { status: "success" }> | null>(null);
  const heading = useRef<HTMLHeadingElement>(null), errorRef = useRef<HTMLDivElement>(null);
  const state = useDecisionAction(action);
  const allowed = mode === "invite" ? canInviteTeam(access) : mode === "transfer" ? canTransferTeam(access) : mode === "remove" ? !!member && canRemoveTeamMember(access, member) : !!invitation && canRevokeTeamInvitation(access, invitation);
  const rejected = !!state.failure && (terminalCodes.includes(state.failure.code) || state.failure.code === "workspace_read_only" && (mode === "invite" || mode === "transfer"));
  const disabled = !allowed || rejected;
  const locked = state.pending || !!state.frozen;
  const confirmationBlocked = rejected || (!allowed && !state.frozen);
  const candidates = members.filter(row => row.userId !== (mode === "remove" ? member?.userId : access.actorId));
  const ownerChanged = reviewed?.operation === "transfer" && reviewed.input.expectedVersion !== workspace.version && !state.frozen;
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [reviewed, saved]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  function review(event: FormEvent) {
    event.preventDefault(); if (disabled || locked) return;
    let command: TeamCommand;
    if (mode === "invite") {
      const parsed = createInvitation.safeParse({ email: email.trim(), role });
      if (!parsed.success) { setError("Enter a valid email address of up to 254 characters and choose Admin or Member."); return; }
      command = { operation: "invite", input: parsed.data };
    } else if (mode === "transfer") {
      const parsed = transferOwnership.safeParse({ userId: selectedUser, expectedVersion: workspace.version });
      if (!parsed.success || !candidates.some(row => row.userId === selectedUser)) { setError("Choose a different active member as the new owner."); return; }
      command = { operation: "transfer", input: parsed.data };
    } else if (mode === "remove" && member) {
      if (selectedUser && !candidates.some(row => row.userId === selectedUser)) { setError("Choose a different active member as the replacement."); return; }
      const input = selectedUser ? removal.safeParse({ replacementUserId: selectedUser }) : null;
      if (input && !input.success) { setError("Choose a valid replacement member."); return; }
      if (state.failure?.code === "replacement_required" && !input) { setError("Choose a replacement to take over this member’s active renewals."); return; }
      command = { operation: "remove", userId: member.userId, input: input?.success ? input.data : null };
    } else if (mode === "revoke" && invitation) command = { operation: "revoke", inviteId: invitation.id };
    else return;
    setError(""); state.clearFailure(); setReviewed(command);
  }
  async function confirm() {
    if (!reviewed || confirmationBlocked || ownerChanged || state.pending) return;
    const result = await state.run(reviewed);
    if (result?.status === "success") setSaved(result);
  }
  const userEmail = (id: string) => members.find(row => row.userId === id)?.email ?? "Member details unavailable";
  const values: Record<string, ReactNode> = reviewed?.operation === "invite" ? { Email: reviewed.input.email, Role: roleLabels[reviewed.input.role], "Invitation validity": "48 hours", Delivery: "Queued for sending; delivery is not guaranteed" } : reviewed?.operation === "revoke" ? { Email: invitation?.email, Role: invitation && roleLabels[invitation.role], Effect: "The invitation can no longer be accepted", "Existing members": "Unchanged" } : reviewed?.operation === "remove" ? { Member: member?.email, "Replacement for active renewals": reviewed.input ? userEmail(reviewed.input.replacementUserId) : "None selected; the server will require one if active work exists", "Workspace access": "Removed", "Pending invitations for this email": "Revoked", "Historical records": "Retained" } : reviewed?.operation === "transfer" ? { Workspace: workspace.name, "New owner": userEmail(reviewed.input.userId), "Your role afterwards": "Admin", "New owner’s access": "Owner; authenticator verification required for admin access" } : {};
  return <div className="rr-follow rr-team-form"><Link className="rr-clients__back" href="/team">Back to team</Link>
    <div className="rr-dashboard__page-heading"><h1 ref={heading} tabIndex={-1}>{saved ? preview ? "Team preview updated" : "Team updated" : reviewed ? "Review before confirming" : titles[mode]}</h1><p>{workspace.name}</p></div>
    {saved ? <section className="rr-follow__success"><AuthSuccessMark /><h2>{saved.operation === "invite" ? preview ? "Invitation preview ready" : "Invitation queued" : saved.operation === "revoke" ? "Invitation revoked" : saved.operation === "remove" ? "Member removed" : "Ownership transferred"}</h2><p>{preview ? "Only temporary sample data changed. No invitation was emailed, membership changed on the server or backend operation performed." : saved.operation === "invite" ? "The invitation is queued. This does not confirm email delivery." : "The confirmed change has been recorded."}</p>{saved.operation === "invite" && <Values values={{ Email: saved.invitation.email, Role: roleLabels[saved.invitation.role], "Expires": teamInstant(saved.invitation.expiresAt) }} />}{saved.operation === "transfer" && <p>You’re now an admin. The new owner manages workspace ownership.</p>}<div className="rr-follow__actions"><Link className="rr-dashboard__primary" href="/team">View team</Link></div></section> : <>
      <section className="rr-follow__context"><h2>{mode === "invite" ? "Share the renewal work" : mode === "remove" ? "Keep active work with your team" : mode === "revoke" ? "Close this invitation" : "Hand over workspace ownership"}</h2><p>{mode === "invite" ? "Choose the email and access level for your teammate. An invitation reserves a seat for 48 hours." : mode === "remove" ? "Removing access keeps the history. Choose who should take over any active renewals, including drafts and ready work." : mode === "revoke" ? "Revoking stops this invitation from being accepted. It doesn’t remove an existing member." : "Choose a different active teammate. You’ll become an admin and keep access to the workspace."}</p></section>
      {disabled && !state.frozen && <AuthNotice error>{mode === "transfer" && access.role === "owner" && !access.recentAuth ? <>Sign in again before transferring ownership. <Link className="rr-auth__notice-link" href="/login">Sign in again</Link></> : "This action isn’t available for this record or your workspace access. Return to the team to review the current state."}</AuthNotice>}
      {reviewed ? <section className="rr-follow__panel" aria-busy={state.pending}><h2>What will change</h2><Values values={values} />{ownerChanged && <AuthNotice error>Workspace ownership changed during review. Open the team again before continuing.</AuthNotice>}{(mode === "remove" || mode === "revoke" || mode === "transfer") && <p className="rr-follow__hint">{mode === "transfer" ? "Only the new owner can transfer ownership again. Check the selected account carefully." : mode === "remove" ? "The removed person needs a new invitation to join again. Provider services and client records remain separate." : "To invite this person again, create a new invitation after revoking this one."}</p>}<div className="rr-follow__actions"><button type="button" className={`rr-dashboard__primary${mode !== "invite" ? " rr-team__confirm" : ""}`} disabled={confirmationBlocked || ownerChanged || state.pending || state.remaining > 0} onClick={confirm}>{state.pending ? "Recording…" : state.remaining > 0 ? `Try again in ${state.remaining}s` : state.frozen ? "Retry original change" : preview ? "Confirm preview change" : mode === "invite" ? "Queue invitation" : mode === "remove" ? "Remove member" : mode === "revoke" ? "Revoke invitation" : "Transfer ownership"}</button><button className="rr-clients__outline-action" type="button" disabled={locked || rejected} onClick={() => setReviewed(null)}>Edit details</button></div></section> : <form onSubmit={review} noValidate className="rr-follow__panel rr-follow__form">
        {error && <div ref={errorRef} id="team-form-error" role="alert" tabIndex={-1} className="rr-follow__errors">{error}</div>}
        <fieldset disabled={disabled || locked}>
          {mode === "invite" ? <><AuthField id="team-email" name="email" label="Email address" type="email" inputMode="email" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={254} value={email} onChange={event => { setEmail(event.target.value); setError(""); }} placeholder="teammate@youragency.com" error={error || undefined} required /><div className="rr-auth__field"><div className="rr-auth__label-row"><label htmlFor="team-role">Workspace role</label></div><NativeSelect id="team-role" value={role} onChange={event => setRole(event.target.value as typeof role)}><option value="member">Member</option><option value="admin">Admin</option></NativeSelect></div><p className="rr-follow__hint">Members work on clients and renewals. Admins also manage team access. Admin workspace access requires authenticator verification.</p></> : mode === "revoke" ? <Values values={{ Email: invitation?.email, Role: invitation && roleLabels[invitation.role], "Expires": invitation && teamInstant(invitation.expiresAt) }} /> : <>{mode === "remove" && <Values values={{ Member: member?.email, Role: member && roleLabels[member.role] }} />}<div className="rr-auth__field"><div className="rr-auth__label-row"><label htmlFor="team-user">{mode === "remove" ? "Replacement for active renewals" : "New workspace owner"}</label></div><NativeSelect id="team-user" value={selectedUser} onChange={event => { setSelectedUser(event.target.value); setError(""); }} aria-invalid={error ? true : undefined} aria-describedby={`team-user-hint${error ? " team-form-error" : ""}`}><option value="">{mode === "remove" ? "No replacement selected" : "Choose a teammate"}</option>{candidates.map(row => <option value={row.userId} key={row.userId}>{row.email} — {roleLabels[row.role]}</option>)}</NativeSelect><p id="team-user-hint" className="rr-auth__hint">{mode === "remove" ? "The server requires a replacement if this member has active renewals. Existing decisions and closed cycle history are retained." : "Only an active member can become the owner. You’ll remain an admin after confirmation."}</p></div></>}
        </fieldset><button className="rr-dashboard__primary" type="submit" disabled={disabled || locked}>Review change</button>
      </form>}
      {state.failure && <AuthNotice error>{state.failure.message}{state.frozen && <p>Your original change is held for retry. Its account, role and reviewed details remain unchanged.</p>}{["unauthenticated", "reauthentication_required"].includes(state.failure.code) && <Link className="rr-auth__notice-link" href="/login">Sign in again</Link>}{state.failure.code === "mfa_required" && <Link className="rr-auth__notice-link" href="/two-factor">Verify authenticator</Link>}{state.failure.code === "email_unverified" && <Link className="rr-auth__notice-link" href="/check-email">Verify email</Link>}</AuthNotice>}
    </>}
  </div>;
}
