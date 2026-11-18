import { setActor } from "@renewrelay/db/database";
import { z } from "zod";
import { write } from "@server/http";
import { runtime } from "@server/runtime";
import { once, requireRecentAuth } from "@renewrelay/domain/context";
import { DomainError } from "@renewrelay/domain/errors";
const input = z.union([z.strictObject({ sessionId: z.string().min(1).max(128) }), z.strictObject({ all: z.literal(true) })]);
export function POST(request: Request) {
  return write(request, "account.sessions.revoke", input, async (cmd, input) => {
    requireRecentAuth(cmd.actor);
    if (!cmd.actor.mfaVerified) throw new DomainError(403, "mfa_required", "Verify two-factor authentication before revoking sessions.");
    return runtime().authDb.$transaction(async tx => {
      await setActor(tx, cmd.actor.id);
      return once(tx, cmd, "account", async () => {
        const result = await tx.session.deleteMany({ where: { userId: cmd.actor.id, ...("sessionId" in input ? { id: input.sessionId } : {}) } });
        await tx.identitySecurityEvent.create({ data: { userId: cmd.actor.id, event: "sessions.revoked", details: { count: result.count } } });
        return { revoked: result.count };
      }, true);
    });
  });
}
