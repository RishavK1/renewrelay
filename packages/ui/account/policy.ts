import type { AccountAccess, AccountProfile, DeletionEligibility } from "./contracts";
import type { z } from "zod";
import type { revokeSessionsInput } from "./contracts";
export function canSecureAccount(access: AccountAccess) { return access.recentAuth && access.mfaVerified; }
export function endsKnownSession(input: z.infer<typeof revokeSessionsInput>, currentSessionId: string | null) { return "all" in input || currentSessionId !== null && input.sessionId === currentSessionId; }
export function canRetryRevoke(input: z.infer<typeof revokeSessionsInput>, currentSessionId: string | null) { return "sessionId" in input && currentSessionId !== null && input.sessionId !== currentSessionId; }
export function canDeleteAccount(access: AccountAccess, eligibility: DeletionEligibility | null) { return canSecureAccount(access) && !!eligibility?.eligible && eligibility.retainedMemberships === 0; }
export function mfaRecovery(profile: Pick<AccountProfile, "twoFactorEnabled">) { return profile.twoFactorEnabled ? "/two-factor" : "/setup-authenticator"; }
export function eventLabel(event: string) { return ({ "sessions.revoked": "Sessions revoked", "mfa.backup_rotated": "Backup codes rotated", "password.reset": "Password reset", "mfa.verified": "Authenticator verified", "mfa.recovered": "Backup code used" } as Record<string, string>)[event] ?? "Account security event"; }
