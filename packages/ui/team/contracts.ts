import type { z } from "zod";
import type { createInvitation, transferOwnership } from "../../contracts/api";
import type { removal } from "../../contracts/renewals";
import type { DecisionFailure } from "../decisions/contracts";
export type TeamRole = "owner" | "admin" | "member";
export type TeamMember = { userId: string; email: string; role: TeamRole; joinedAt: string };
export type TeamInvitation = { id: string; email: string; role: "admin" | "member"; expiresAt: string; acceptedAt: string | null; revokedAt: string | null };
export type TeamWorkspace = { id: string; name: string; timezone: string; version: number; role: TeamRole };
export type TeamAccess = { actorId: string; role: TeamRole; writable: boolean; deleting: boolean; recentAuth: boolean; seatLimit?: number };
export type TeamCommand =
  | { operation: "invite"; input: z.infer<typeof createInvitation> }
  | { operation: "revoke"; inviteId: string }
  | { operation: "remove"; userId: string; input: z.infer<typeof removal> | null }
  | { operation: "transfer"; input: z.infer<typeof transferOwnership> };
export type TeamResult =
  | { status: "success"; operation: "invite"; invitation: TeamInvitation }
  | { status: "success"; operation: "revoke"; id: string; revoked: true }
  | { status: "success"; operation: "remove"; userId: string; removed: true }
  | { status: "success"; operation: "transfer"; workspaceId: string; ownerId: string; version: number }
  | DecisionFailure;
/** Bound authorized workspace. Adapter owns Origin/session/MFA, error envelopes,
 * stable idempotency keys, authoritative versions/refetch and unknown receipts.
 * Removal input:null means absent body. Revoke sends no body. No API calls here. */
export type TeamAction = (command: TeamCommand, signal: AbortSignal) => Promise<TeamResult>;
/** Adapter binds invitation token to this action; UI never receives the credential. */
export type AcceptTeamAction = (signal: AbortSignal) => Promise<{ status: "success"; workspaceId: string; role: TeamRole } | DecisionFailure>;
