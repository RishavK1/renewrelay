import { z } from "zod";
import { page } from "../../contracts/api";
import type { DecisionFailure } from "../decisions/contracts";
// Mirrors API-local schemas; no route/server module is imported into the browser.
export const sessionPageInput = z.strictObject({ after: z.string().min(1).max(128).optional(), limit: z.string().regex(/^(100|[1-9][0-9]?)$/).transform(Number).default(25) });
export const accountPageInput = page;
export const revokeSessionsInput = z.union([z.strictObject({ sessionId: z.string().min(1).max(128) }), z.strictObject({ all: z.literal(true) })]);
export const deleteAccountInput = z.strictObject({ confirmEmail: z.email(), password: z.string().min(1).max(1024), confirm: z.literal(true) });
export type AccountProfile = { id: string; name: string; email: string; emailVerified: boolean; image: string | null; createdAt: string; updatedAt: string; twoFactorEnabled: boolean };
export type AccountAccess = { recentAuth: boolean; mfaVerified: boolean };
export type AccountSession = { id: string; createdAt: string; expiresAt: string; mfaVerifiedAt: string | null; ipAddress: string | null; userAgent: string | null };
export type SecurityEvent = { id: string; event: string; details: unknown; createdAt: string };
export type Page<T> = { items: T[]; nextCursor: string | null };
export type AccountExport = { profile: AccountProfile; accounts: { providerId: string; accountId: string; createdAt: string; updatedAt: string }[]; memberships: Page<{ id: string; workspaceId: string; role: "owner" | "admin" | "member"; joinedAt: string; removedAt: string | null }>; sessions: string; securityEvents: string; workspaceData: string };
export type DeletionEligibility = { eligible: boolean; retainedMemberships: number; requirement: string; scope: string };
export type AccountReadCommand = { operation: "sessions"; query: z.infer<typeof sessionPageInput> } | { operation: "events" | "export"; query: z.infer<typeof accountPageInput> } | { operation: "eligibility" };
export type AccountReadResult = DecisionFailure | { status: "success"; operation: "sessions"; page: Page<AccountSession> } | { status: "success"; operation: "events"; page: Page<SecurityEvent> } | { status: "success"; operation: "export"; data: AccountExport } | { status: "success"; operation: "eligibility"; data: DeletionEligibility };
export type AccountReadAction = (command: AccountReadCommand, signal: AbortSignal) => Promise<AccountReadResult>;
export type RevokeAction = (input: z.infer<typeof revokeSessionsInput>, signal: AbortSignal) => Promise<{ status: "success"; revoked: number } | DecisionFailure>;
/** Bound identity adapter owns auth/Origin, keys/receipt reconciliation and refetch.
 * All/current revocation can remove the actor before another receipt read. */
export type AccountDeleteAction = (input: z.infer<typeof deleteAccountInput>, signal: AbortSignal) => Promise<{ status: "success"; deleted: true } | DecisionFailure>;
/** Deletion is NOT replay-safe merely because write headers include a key. Never
 * retry automatically or infer success from a later401. Password stays transient. */
