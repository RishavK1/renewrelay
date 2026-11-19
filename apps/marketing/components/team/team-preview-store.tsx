"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { createInvitation, transferOwnership } from "../../../../packages/contracts/api";
import { removal } from "../../../../packages/contracts/renewals";
import type { TeamAccess, TeamCommand, TeamInvitation, TeamMember, TeamResult, TeamWorkspace } from "../../../../packages/ui/team/contracts";
import { canInviteTeam, canManageTeam, canRemoveTeamMember, canRevokeTeamInvitation, canTransferTeam } from "../../../../packages/ui/team/policy";
import { useClientPreview } from "../clients/client-preview-store";
import { refreshPreviewRecord } from "../renewals/renewal-fixtures";

import { useWorkspaceDirectory } from "../workspace/workspace-directory-store";
import type { WorkspaceView } from "../../../../packages/ui/workspace/contracts";

type State = { workspace: TeamWorkspace; members: TeamMember[]; invitations: TeamInvitation[] };
type Store = State & { updateWorkspace: (patch: Partial<Pick<TeamWorkspace, "timezone" | "version">>) => void; revokePendingInvitations: () => void; reset: () => void; execute: (command: TeamCommand, access: TeamAccess) => TeamResult; accept: (email: string, seatLimit?: number) => { status: "success"; workspaceId: string; role: "admin" | "member" } | Extract<TeamResult, { status: "error" }> };
const Context = createContext<Store | null>(null);
const inviteId = "70000000-0000-4000-8000-000000000001";
function sampleState(workspace: WorkspaceView): State {
  const now = Date.parse(new Date().toISOString().slice(0, 10) + "T12:00:00Z"), date = (days: number) => new Date(now + days * 86400000).toISOString();
  return {
    workspace,
    members: [
      { userId: "preview-owner", email: "owner@northline.example", role: workspace.role, joinedAt: "2026-10-01T09:00:00Z" },
      { userId: "preview-admin", email: "riya@northline.example", role: "admin", joinedAt: "2026-10-10T09:00:00Z" },
      { userId: "preview-member", email: "sam@northline.example", role: "member", joinedAt: "2026-10-12T09:00:00Z" },
    ],
    invitations: [
      { id: inviteId, email: "taylor@northline.example", role: "member", expiresAt: date(2), acceptedAt: null, revokedAt: null },
      { id: "70000000-0000-4000-8000-000000000002", email: "morgan@northline.example", role: "admin", expiresAt: date(-1), acceptedAt: null, revokedAt: null },
      { id: "70000000-0000-4000-8000-000000000003", email: "sam@northline.example", role: "member", expiresAt: date(-7), acceptedAt: date(-8), revokedAt: null },
      { id: "70000000-0000-4000-8000-000000000004", email: "former@northline.example", role: "member", expiresAt: date(-2), acceptedAt: null, revokedAt: date(-3) },
    ],
  };
}
const fail = (code: string, message: string): Extract<TeamResult, { status: "error" }> => ({ status: "error", code, message });

export function TeamPreviewProvider({ children }: { children: ReactNode }) {
  const { selected } = useWorkspaceDirectory();
  const [state, setState] = useState<State>(() => sampleState(selected));
  const latest = useRef(state); latest.current = state;
  const clients = useClientPreview(), records = useRef(clients); records.current = clients;
  function execute(command: TeamCommand, access: TeamAccess): TeamResult {
    const current = latest.current;
    if (!canManageTeam(access)) return fail(access.deleting ? "workspace_deleting" : "forbidden", "Team management isn’t available with this access.");
    if (command.operation === "invite") {
      if (!canInviteTeam(access)) return fail("workspace_read_only", "Inviting teammates requires a writable workspace.");
      const parsed = createInvitation.safeParse(command.input);
      if (!parsed.success) return fail("invalid_request", "Check the email address and role.");
      const input = parsed.data, now = Date.now();
      if (current.members.some(row => row.email === input.email)) return fail("already_member", "This email already belongs to a workspace member.");
      const pending = current.invitations.filter(row => !row.acceptedAt && !row.revokedAt && Date.parse(row.expiresAt) > now);
      if (pending.some(row => row.email === input.email)) return fail("invite_pending", "This email already has a pending invitation.");
      if (current.members.length + pending.length >= (access.seatLimit ?? 5)) return fail("seat_limit", `All ${access.seatLimit ?? 5} sample seats are in use or reserved. Revoke a pending invitation or ask the owner to review access.`);
      const invitation: TeamInvitation = { ...input, id: crypto.randomUUID(), expiresAt: new Date(now + 48 * 3600000).toISOString(), acceptedAt: null, revokedAt: null };
      setState({ ...current, invitations: [invitation, ...current.invitations] });
      return { status: "success", operation: "invite", invitation };
    }
    if (command.operation === "revoke") {
      const invite = current.invitations.find(row => row.id === command.inviteId);
      if (!invite) return fail("not_found", "This invitation is no longer available.");
      if (!canRevokeTeamInvitation(access, invite)) return fail("invite_closed", "This invitation is already closed.");
      setState({ ...current, invitations: current.invitations.map(row => row.id === invite.id ? { ...row, revokedAt: new Date().toISOString() } : row) });
      return { status: "success", operation: "revoke", id: invite.id, revoked: true };
    }
    if (command.operation === "remove") {
      const member = current.members.find(row => row.userId === command.userId);
      if (!member) return fail("not_found", "This membership is no longer available.");
      if (!canRemoveTeamMember(access, member)) return fail(member.role === "owner" ? "owner_required" : "self_removal", "The owner and your own membership can’t be removed here.");
      if (command.input !== null && !removal.safeParse(command.input).success) return fail("invalid_request", "Choose a valid replacement member.");
      const replacement = command.input?.replacementUserId;
      if (replacement && (replacement === member.userId || !current.members.some(row => row.userId === replacement))) return fail("invalid_operator", "Choose a different active member.");
      const store = records.current, assigned = store.renewals.filter(row => row.cycle.operatorId === member.userId && !row.cycle.closedAt);
      if (assigned.length && !replacement) return fail("replacement_required", "Assign this member’s active renewals to a replacement before removing access.");
      if (replacement) {
        const itemIds = new Set(assigned.map(row => row.item.id));
        for (const row of store.renewals.filter(row => itemIds.has(row.item.id))) store.saveRenewal(refreshPreviewRecord({ ...row, item: { ...row.item, operatorId: replacement, version: row.item.version + 1 }, cycle: row.cycle.operatorId === member.userId && !row.cycle.closedAt ? { ...row.cycle, operatorId: replacement, version: row.cycle.version + 1 } : row.cycle }));
        for (const row of assigned) store.appendHistory({ entityId: row.cycle.id, event: "cycle.operator_reassigned", details: { previousOperatorId: member.userId, replacementUserId: replacement } });
      }
      setState({ ...current, members: current.members.filter(row => row.userId !== member.userId), invitations: current.invitations.map(row => row.email === member.email && !row.acceptedAt && !row.revokedAt ? { ...row, revokedAt: new Date().toISOString() } : row) });
      return { status: "success", operation: "remove", userId: member.userId, removed: true };
    }
    if (!canTransferTeam(access)) return fail(!access.recentAuth ? "reauthentication_required" : "forbidden", "The owner needs current write access and a recent sign-in to transfer ownership.");
    const parsed = transferOwnership.safeParse(command.input);
    if (!parsed.success) return fail("invalid_request", "Choose a new owner and current workspace version.");
    if (parsed.data.expectedVersion !== current.workspace.version) return fail("stale_version", "Workspace ownership changed. Review the latest team before continuing.");
    const target = current.members.find(row => row.userId === parsed.data.userId && row.userId !== access.actorId);
    if (!target) return fail("invalid_owner", "Choose a different active workspace member.");
    const version = current.workspace.version + 1;
    setState({ ...current, workspace: { ...current.workspace, version, role: "admin" }, members: current.members.map(row => row.userId === access.actorId ? { ...row, role: "admin" } : row.userId === target.userId ? { ...row, role: "owner" } : row) });
    return { status: "success", operation: "transfer", workspaceId: current.workspace.id, ownerId: target.userId, version };
  }
  function accept(email: string, seatLimit = 5) {
    const current = latest.current, invite = current.invitations.find(row => row.id === inviteId);
    if (!invite || invite.email !== email) return fail("not_found", "This invitation isn’t available for this account. Use the email address it was sent to.");
    if (invite.acceptedAt || invite.revokedAt || Date.parse(invite.expiresAt) <= Date.now()) return fail("invite_unavailable", "This invitation is no longer available. Ask the workspace manager for a new invitation.");
    if (current.members.some(row => row.email === email)) return fail("already_member", "This account already belongs to the workspace.");
    if (current.members.length >= seatLimit) return fail("seat_limit", "The workspace has no available seats. Ask its owner to review access.");
    setState({ ...current, members: [...current.members, { userId: "preview-joined", email, role: invite.role, joinedAt: new Date().toISOString() }], invitations: current.invitations.map(row => row.id === invite.id ? { ...row, acceptedAt: new Date().toISOString() } : row) });
    return { status: "success" as const, workspaceId: current.workspace.id, role: invite.role };
  }
  return <Context.Provider value={{ ...state, updateWorkspace: patch => setState(current => ({ ...current, workspace: { ...current.workspace, ...patch } })), revokePendingInvitations: () => setState(current => ({ ...current, invitations: current.invitations.map(row => !row.acceptedAt && !row.revokedAt ? { ...row, revokedAt: new Date().toISOString() } : row) })), reset: () => setState(sampleState(selected)), execute, accept }}>{children}</Context.Provider>;
}
export function useTeamPreview() { const store = useContext(Context); if (!store) throw new Error("Team preview provider is required."); return store; }
