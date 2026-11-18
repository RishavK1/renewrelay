/** Presentation boundary. These payloads mirror the existing auth endpoints.
 * A future app-origin adapter owns cookies, callbacks and error normalization.
 */
export type AuthScreen = "login" | "signup" | "check-email" | "verify-email" | "forgot-password" | "reset-password" | "two-factor" | "setup-authenticator" | "auth-complete";

export type AuthCommand =
  | { operation: "sign-in"; email: string; password: string }
  | { operation: "sign-up"; name: string; email: string; password: string }
  | { operation: "send-verification"; email: string }
  | { operation: "request-reset"; email: string }
  | { operation: "reset-password"; newPassword: string }
  | { operation: "verify-totp"; code: string }
  | { operation: "verify-backup-code"; code: string }
  | { operation: "enable-totp"; password: string };

// Reset tokens, enrollment secrets and callbacks are adapter-owned; none of
// these UI values constitutes an authenticated session or server-verified MFA.
export type AuthResult =
  | { status: "success"; next?: AuthScreen }
  | { status: "error"; message: string; code?: string; retryAfterSeconds?: number };
export type AuthAction = (command: AuthCommand, signal: AbortSignal) => Promise<AuthResult>;

export const passwordRule = { min: 12, max: 128 } as const;
export const authScreens: readonly AuthScreen[] = ["login", "signup", "check-email", "verify-email", "forgot-password", "reset-password", "two-factor", "setup-authenticator", "auth-complete"];
