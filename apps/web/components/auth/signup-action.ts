import type { AuthAction, AuthResult } from "../../../../packages/ui/auth/contracts";

function failure(response: Response): AuthResult {
  const raw = response.headers.get("Retry-After") ?? response.headers.get("X-Retry-After");
  const seconds = raw ? Number(raw) : 60;
  if (response.status === 429) return {
    status: "error", code: "rate_limited", message: "Too many attempts. Wait before requesting another link.",
    retryAfterSeconds: Number.isFinite(seconds) ? Math.min(3600, Math.max(1, Math.ceil(seconds))) : 60,
  };
  return { status: "error", message: response.status >= 500
    ? "We couldn’t complete that request. Try again shortly. If you already submitted signup, you can request a verification link."
    : "We couldn’t complete that request. Check your details and try again." };
}

/** Only this batch's supported operations. No session simulation or browser storage. */
export const signupAction: AuthAction = async (command, signal) => {
  if (command.operation !== "sign-up" && command.operation !== "send-verification") {
    return { status: "error", message: "This action is not connected yet." };
  }
  const signup = command.operation === "sign-up";
  const response = await fetch(signup ? "/api/auth/sign-up/email" : "/api/auth/send-verification-email", {
    method: "POST", credentials: "same-origin", cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signup
      ? { name: command.name, email: command.email, password: command.password }
      : { email: command.email }),
  });
  if (!response.ok) return failure(response);
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || (signup ? !("user" in result) : !("status" in result) || result.status !== true)) {
    return { status: "error", message: "We couldn’t confirm the response. Request a verification link to continue." };
  }
  return signup ? { status: "success", next: "check-email" } : { status: "success" };
};

export async function verifyEmail(token: string): Promise<AuthResult> {
  const response = await fetch(`/api/auth/verify-email?${new URLSearchParams({ token })}`, {
    credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return response.status === 429 || response.status >= 500 ? failure(response)
    : { status: "error", code: "invalid_verification", message: "This verification link is invalid or has expired. Request another link to continue." };
  const result: unknown = await response.json();
  return result && typeof result === "object" && "status" in result && result.status === true
    ? { status: "success" }
    : { status: "error", message: "We couldn’t confirm verification. Try the link again." };
}
