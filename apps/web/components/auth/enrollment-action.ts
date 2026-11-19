import type { AuthResult } from "../../../../packages/ui/auth/contracts";
import { loginFailure, sessionState } from "./login-action";

export type EnrollmentMaterial = { setupKey: string; recoveryCodes: string[]; uri: string };
export function parseEnrollment(value: unknown, email: string): EnrollmentMaterial | null {
  if (!value || typeof value !== "object" || !("method" in value) || value.method !== "totp" || !("totpURI" in value) || typeof value.totpURI !== "string" || value.totpURI.length > 2048 || !("backupCodes" in value) || !Array.isArray(value.backupCodes)) return null;
  const codes: unknown[] = value.backupCodes;
  if (codes.length < 1 || codes.length > 20 || !codes.every((code): code is string => typeof code === "string" && /^[A-Za-z0-9-]{5,128}$/.test(code)) || new Set(codes).size !== codes.length) return null;
  try {
    const uri = new URL(value.totpURI);
    const key = uri.searchParams.get("secret");
    if (uri.protocol !== "otpauth:" || uri.hostname !== "totp" || uri.searchParams.get("issuer") !== "RenewRelay" || !decodeURIComponent(uri.pathname).toLowerCase().endsWith(`:${email.toLowerCase()}`) || !key || !/^[A-Z2-7]{16,128}$/.test(key)) return null;
    if ((uri.searchParams.get("digits") ?? "6") !== "6" || (uri.searchParams.get("period") ?? "30") !== "30" || (uri.searchParams.get("algorithm") ?? "SHA1").toUpperCase() !== "SHA1") return null;
    return { setupKey: key, recoveryCodes: codes, uri: value.totpURI };
  } catch { return null; }
}
export async function enrollmentSession(userId: string, signal: AbortSignal, requireMfa = false): Promise<AuthResult> {
  const response = await fetch("/api/auth/get-session", { credentials: "same-origin", cache: "no-store", signal });
  if (!response.ok) return loginFailure(response, "enrollment");
  const value: unknown = await response.json();
  if (sessionState(value) !== "ready" || !value || typeof value !== "object" || !("user" in value) || !value.user || typeof value.user !== "object" || !("id" in value.user) || value.user.id !== userId) return { status: "error", code: "reauthentication_required", message: "Your session has changed or expired. Log in again before continuing." };
  if (requireMfa && (!("twoFactorEnabled" in value.user) || value.user.twoFactorEnabled !== true || !("session" in value) || !value.session || typeof value.session !== "object" || !("mfaVerifiedAt" in value.session) || !value.session.mfaVerifiedAt)) return { status: "error", message: "Authenticator verification hasn’t been confirmed. Enter the current code to continue." };
  return { status: "success" };
}
export async function startEnrollment(password: string, email: string, signal: AbortSignal): Promise<{ result: AuthResult; material?: EnrollmentMaterial }> {
  const response = await fetch("/api/auth/two-factor/enable", { method: "POST", credentials: "same-origin", cache: "no-store", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, method: "totp" }) });
  if (!response.ok) {
    let code: unknown;
    try { const body: unknown = await response.clone().json(); if (body && typeof body === "object" && "code" in body) code = body.code; if (body && typeof body === "object" && "error" in body && body.error && typeof body.error === "object" && "code" in body.error) code = body.error.code; } catch { /* Use safe fallback. */ }
    if (code === "reauthentication_required" || code === "UNAUTHORIZED") return { result: { status: "error", code: "reauthentication_required", message: "Log in again before setting up your authenticator." } };
    if (code === "TOTP_ALREADY_ENABLED") return { result: { status: "error", code: "enrollment_changed", message: "An authenticator is already enabled. Return to your account to check its status." } };
    if (code === "INVALID_PASSWORD") return { result: { status: "error", message: "Your password couldn’t be verified. Check it and try again." } };
    return { result: await loginFailure(response, "enrollment") };
  }
  const material = parseEnrollment(await response.json(), email);
  return material ? { result: { status: "success" }, material } : { result: { status: "error", message: "We couldn’t read the setup details. Return to your account and start again." } };
}
