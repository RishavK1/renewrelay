import type { AuthAction, AuthResult } from "../../../../packages/ui/auth/contracts";

type SessionState = "absent" | "unverified" | "challenge" | "ready";
export function sessionState(value: unknown): SessionState {
  if (!value || typeof value !== "object" || !("user" in value) || !("session" in value)) return "absent";
  const { user, session } = value;
  if (!user || typeof user !== "object" || !("id" in user) || typeof user.id !== "string" || !session || typeof session !== "object" || !("userId" in session) || session.userId !== user.id) return "absent";
  if (!("emailVerified" in user) || user.emailVerified !== true) return "unverified";
  if (!("twoFactorEnabled" in user) || typeof user.twoFactorEnabled !== "boolean") return "absent";
  if ("twoFactorEnabled" in user && user.twoFactorEnabled === true && (!("mfaVerifiedAt" in session) || typeof session.mfaVerifiedAt !== "string" || !Number.isFinite(Date.parse(session.mfaVerifiedAt)))) return "challenge";
  return "ready";
}
async function readSession(signal: AbortSignal) {
  const response = await fetch("/api/auth/get-session", { credentials: "same-origin", cache: "no-store", signal });
  if (!response.ok) throw new Error("Session read failed");
  return response.json() as Promise<unknown>;
}
export async function loginFailure(response: Response, operation: string): Promise<AuthResult> {
  let code: unknown;
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object") {
      if ("code" in body) code = body.code;
      if ("error" in body && body.error && typeof body.error === "object" && "code" in body.error) code = body.error.code;
    }
  } catch { /* Never surface raw HTML/provider error bodies. */ }
  if (code === "EMAIL_NOT_VERIFIED") return { status: "error", code: "email_unverified", message: "Verify your email address before logging in." };
  if (["INVALID_TWO_FACTOR_COOKIE", "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE"].includes(String(code))) return { status: "error", code: "challenge_expired", message: "This sign-in request has expired or reached its attempt limit. Start again to continue." };
  if (response.status === 429) {
    const raw = response.headers.get("Retry-After") ?? response.headers.get("X-Retry-After");
    const seconds = Number(raw ?? (code === "ACCOUNT_TEMPORARILY_LOCKED" ? 900 : 60));
    return { status: "error", code: "rate_limited", message: code === "ACCOUNT_TEMPORARILY_LOCKED" ? "Too many failed verification attempts. Wait before trying again." : "Too many attempts. Wait before trying again.", retryAfterSeconds: Number.isFinite(seconds) ? Math.min(3600, Math.max(1, Math.ceil(seconds))) : 60 };
  }
  return { status: "error", message: response.status >= 500 ? "We couldn’t complete that request. Try again shortly."
    : operation === "sign-in" ? "The email or password couldn’t be verified. Check your details and try again."
    : operation === "sign-out" ? "We couldn’t sign you out. Try again."
    : "That code couldn’t be verified. Check it and try again." };
}
export const loginAction: AuthAction = async (command, abort) => {
  const signal = AbortSignal.any([abort, AbortSignal.timeout(20_000)]);
  let path: string;
  let body: object;
  switch (command.operation) {
    case "sign-in": path = "/api/auth/sign-in/email"; body = { email: command.email, password: command.password }; break;
    case "verify-totp": path = "/api/auth/two-factor/verify-totp"; body = { code: command.code, trustDevice: false }; break;
    case "verify-backup-code": path = "/api/auth/two-factor/verify-backup-code"; body = { code: command.code, trustDevice: false }; break;
    default: return { status: "error", message: "This action is not connected yet." };
  }
  const response = await fetch(path, { method: "POST", credentials: "same-origin", cache: "no-store", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) return loginFailure(response, command.operation);
  const result: unknown = await response.json();
  if (command.operation === "sign-in" && result && typeof result === "object" && "twoFactorRedirect" in result && result.twoFactorRedirect === true) return { status: "success", next: "two-factor" };
  // HTTP success alone cannot certify an authenticated, MFA-verified session.
  switch (sessionState(await readSession(signal))) {
    case "ready": return { status: "success", next: "auth-complete" };
    case "challenge": return { status: "success", next: "two-factor" };
    case "unverified": return { status: "error", code: "email_unverified", message: "Verify your email address before logging in." };
    default: return { status: "error", code: "challenge_expired", message: "We couldn’t confirm your session. Log in again to continue." };
  }
};
export async function signOut(signal: AbortSignal): Promise<AuthResult> {
  const response = await fetch("/api/auth/sign-out", { method: "POST", credentials: "same-origin", cache: "no-store", signal, headers: { "Content-Type": "application/json" }, body: "{}" });
  if (!response.ok) return loginFailure(response, "sign-out");
  return sessionState(await readSession(signal)) === "absent" ? { status: "success" }
    : { status: "error", message: "We couldn’t confirm sign-out. Try again." };
}
export async function confirmSession(userId: string, signal: AbortSignal) {
  const value = await readSession(signal);
  return sessionState(value) === "ready" && !!value && typeof value === "object" && "user" in value && !!value.user && typeof value.user === "object" && "id" in value.user && value.user.id === userId;
}
