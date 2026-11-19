import type { TeamAccess, TeamInvitation, TeamMember } from "./contracts";
export const roleLabels = { owner: "Owner", admin: "Admin", member: "Member" };
export function invitationStatus(invite: TeamInvitation, now = Date.now()) {
  return invite.acceptedAt ? "Accepted" : invite.revokedAt ? "Revoked" : Date.parse(invite.expiresAt) <= now ? "Expired" : "Pending";
}
export function canManageTeam(access: TeamAccess) { return access.role !== "member" && !access.deleting; }
export function canInviteTeam(access: TeamAccess) { return canManageTeam(access) && access.writable; }
export function canRemoveTeamMember(access: TeamAccess, member: TeamMember) { return canManageTeam(access) && member.role !== "owner" && member.userId !== access.actorId; }
export function canRevokeTeamInvitation(access: TeamAccess, invite: TeamInvitation) { return canManageTeam(access) && !invite.acceptedAt && !invite.revokedAt; }
export function canTransferTeam(access: TeamAccess) { return access.role === "owner" && access.writable && !access.deleting && access.recentAuth; }
export function teamDate(value: string) { return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value)); }

export function teamInstant(value: string) { return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC", timeZoneName: "short" }).format(new Date(value)); }
