import { lockCommand } from "../../../packages/db/database";
import { randomUUID } from "node:crypto";
import { generateInviteToken, inviteDigest } from "../../../packages/domain/invite-credentials";
import { DomainError } from "../../../packages/domain/errors";
import { preview } from "../../../packages/domain/decisions/service";
import { runtime } from "./runtime";

export const cookieName = "renewrelay_decision";

export async function exchange(token: string) {
  const current = runtime();
  const terms = await preview(current.db, token);
  if (terms.decided) throw new DomainError(410, "decision_unavailable", "This decision has been completed.");
  const sessionToken = generateInviteToken();
  const csrf = generateInviteToken();
  const id = randomUUID();
  const digest = inviteDigest(sessionToken);
  await current.db.$transaction(async tx => {
    await tx.$queryRaw`SELECT set_config('renewrelay.session_digest', ${digest}, true)`;
    await tx.$queryRaw`SELECT set_config('renewrelay.decision_digest', ${inviteDigest(token)}, true)`;
    await lockCommand(tx, ["decision-exchange", inviteDigest(token)]);
    if (await tx.decisionSession.count({ where: {
      linkDigest: inviteDigest(token), createdAt: { gt: new Date(Date.now() - 60_000) },
    } }) >= 20) throw new DomainError(429, "exchange_limit", "Wait before reopening this link.");
    await tx.decisionSession.create({ data: {
      id, digest, linkDigest: inviteDigest(token), ciphertext: current.credentials.encrypt(token, id), csrfDigest: inviteDigest(csrf),
      expiresAt: new Date(Date.now() + 600_000),
    } });
  });
  return { sessionToken, csrf };
}

export async function decisionSession(request: Request, write: boolean) {
  const token = request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(cookieName + "="))?.slice(cookieName.length + 1);
  if (!token || !/^[\w-]{43}$/.test(token)) throw new DomainError(401, "decision_session_required", "Open your decision link again.");
  const digest = inviteDigest(token);
  return runtime().db.$transaction(async tx => {
    await tx.$queryRaw`SELECT set_config('renewrelay.session_digest', ${digest}, true)`;
    const session = await tx.decisionSession.findUnique({ where: { digest } });
    if (!session || session.expiresAt <= new Date()) throw new DomainError(401, "decision_session_expired", "Open your decision link again.");
    if (write && inviteDigest(request.headers.get("x-csrf-token") ?? "") !== session.csrfDigest) {
      throw new DomainError(403, "invalid_csrf", "Refresh this decision session.");
    }
    return { token: runtime().credentials.decrypt(session.ciphertext, session.id), sessionId: session.id };
  });
}

export function decisionCookie(token: string) {
  return `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${runtime().origin.startsWith("https:") ? "; Secure" : ""}`;
}
