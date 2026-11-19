import "server-only";
import { headers } from "next/headers";
import { runtime } from "./runtime";

export async function currentAuthSession() {
  return runtime().auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } });
}
export function sessionDestination(session: Awaited<ReturnType<typeof currentAuthSession>>) {
  if (!session) return "/login";
  if (!session.user.emailVerified) return "/check-email";
  if (session.user.twoFactorEnabled && !session.session.mfaVerifiedAt) return "/two-factor";
  return "/auth-complete";
}
