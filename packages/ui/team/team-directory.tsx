"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Plus, UsersRound } from "lucide-react";
import type { TeamAccess, TeamInvitation, TeamMember, TeamWorkspace } from "./contracts";
import { canInviteTeam, canManageTeam, canRemoveTeamMember, canRevokeTeamInvitation, invitationStatus, roleLabels, teamDate, teamInstant } from "./policy";

export function TeamDirectory({ workspace, access, members, invitations, nextCursor, onLoadMore, loadingMore = false }: {
  workspace: TeamWorkspace; access: TeamAccess; members: TeamMember[]; invitations: TeamInvitation[];
  nextCursor?: string | null; onLoadMore?: () => void; loadingMore?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  if (!canManageTeam(access)) return <section className="rr-clients__loading"><h1 ref={heading} tabIndex={-1}>Team access is restricted</h1><p>{access.deleting ? "Operational access is closed while this workspace is scheduled for deletion." : "The owner and admins manage the workspace’s members and invitations."}</p><Link href="/dashboard" className="rr-dashboard__primary">Back to renewals</Link></section>;
  return <div className="rr-team">
    <div className="rr-clients__heading"><div className="rr-dashboard__page-heading"><h1 ref={heading} tabIndex={-1}>Team</h1><p>Keep the right people behind every renewal.</p></div>{canInviteTeam(access) && <Link className="rr-dashboard__primary" href="/team/invite"><Plus size={17} aria-hidden="true" />Invite teammate</Link>}</div>
    <div className="rr-team__access"><UsersRound size={20} aria-hidden="true" /><div><strong>{workspace.name}</strong><p>{access.writable ? "Owners and admins manage access. Members handle the renewal work." : "This workspace is read-only. You can still remove members and revoke invitations, but can’t invite people or transfer ownership."}</p></div></div>
    <section className="rr-team__section" aria-labelledby="team-members-title"><div className="rr-team__section-heading"><h2 id="team-members-title">Members</h2><p>People with access to this workspace.</p></div>
      <ul className="rr-team__list">{members.map(member => <li key={member.userId}><div className="rr-team__identity"><span className="rr-team__monogram" aria-hidden="true">{member.email.charAt(0).toUpperCase()}</span><div><strong>{member.email}{member.userId === access.actorId && <span className="rr-team__you">You</span>}</strong><span>Joined {teamDate(member.joinedAt)}</span></div></div><span className="rr-team__badge">{roleLabels[member.role]}</span><div className="rr-team__row-action">{canRemoveTeamMember(access, member) ? <Link className="rr-clients__text-action" href={`/team/members/${encodeURIComponent(member.userId)}/remove`} aria-label={`Remove ${member.email}`}>Remove</Link> : <span className="rr-team__protected">{member.role === "owner" ? "Workspace owner" : "Your account"}</span>}</div></li>)}</ul>
      {!members.length && <div className="rr-team__empty"><h3>No member records loaded</h3><p>Member details appear once the directory is available.</p></div>}
    </section>
    <section className="rr-team__section" aria-labelledby="team-invitations-title"><div className="rr-team__section-heading"><h2 id="team-invitations-title">Invitations</h2><p>Pending invitations reserve a seat until accepted, expired or revoked.</p></div>
      {!invitations.length ? <div className="rr-team__empty"><h3>No invitations yet</h3><p>Invite a teammate when you’re ready to share the work.</p></div> : <ul className="rr-team__list rr-team__list--invitations">{invitations.map(invite => <li key={invite.id}><div className="rr-team__invite-identity"><strong>{invite.email}</strong><span>{roleLabels[invite.role]} · Expires <time dateTime={invite.expiresAt}>{teamInstant(invite.expiresAt)}</time></span></div><span className="rr-team__badge" data-state={invitationStatus(invite).toLowerCase()}>{invitationStatus(invite)}</span><div className="rr-team__row-action">{canRevokeTeamInvitation(access, invite) && <Link className="rr-clients__text-action" href={`/team/invitations/${invite.id}/revoke`} aria-label={`Revoke invitation for ${invite.email}`}>Revoke</Link>}</div></li>)}</ul>}
      {nextCursor && <div className="rr-team__pagination"><button type="button" className="rr-clients__outline-action" onClick={onLoadMore} disabled={!onLoadMore || loadingMore}>{loadingMore ? "Loading…" : "Load more invitations"}</button></div>}
    </section>
    {access.role === "owner" && <section className="rr-team__ownership"><div><h2>Workspace ownership</h2><p>Hand ownership to an active teammate. You’ll remain an admin.</p></div>{access.writable ? <Link className="rr-clients__outline-action" href="/team/transfer-ownership">Transfer ownership</Link> : <span className="rr-team__protected">Requires write access</span>}</section>}
  </div>;
}
