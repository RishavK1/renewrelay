import { z } from "zod";
import { write } from "@server/http";
import { runtime } from "@server/runtime";
import { setActor } from "@renewrelay/db/database";
import { requireRecentAuth } from "@renewrelay/domain/context";
import { DomainError } from "@renewrelay/domain/errors";
import { verifyPassword } from "@renewrelay/domain/passwords";
import { consumeRate } from "@renewrelay/domain/rate-limits";
const input = z.strictObject({ confirmEmail: z.email(), password: z.string().min(1).max(1024), confirm: z.literal(true) });
export function POST(request: Request) {
  return write(request, "account.delete", input, async (cmd, input) => {
    requireRecentAuth(cmd.actor);
    if (!cmd.actor.mfaVerified) throw new DomainError(403, "mfa_required", "Verify two-factor authentication before deleting the account.");
    if (input.confirmEmail.toLowerCase() !== cmd.actor.email) throw new DomainError(409, "confirmation_mismatch", "Confirm your verified email address.");
    await consumeRate(runtime().db, runtime().decisionSecret, "account-delete/" + cmd.actor.id, 5, 600_000);
    await runtime().authDb.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM auth_users WHERE id = ${cmd.actor.id} FOR UPDATE`;
      const account = await tx.account.findFirst({ where: { userId: cmd.actor.id, providerId: "credential" } });
      if (!account?.password || !(await verifyPassword({ hash: account.password, password: input.password }))) {
        throw new DomainError(403, "invalid_credentials", "The credentials could not be verified.");
      }
      const retained = await runtime().db.$transaction(async business => {
        await setActor(business, cmd.actor.id);
        return business.membership.count({ where: { userId: cmd.actor.id } });
      });
      if (retained) throw new DomainError(409, "identity_in_use", "Resolve workspace memberships and retention before deleting this shared identity.");
      await tx.verification.deleteMany({ where: { OR: [{ value: cmd.actor.id }, { identifier: cmd.actor.id }] } });
      await tx.user.delete({ where: { id: cmd.actor.id } });
    });
    return { deleted: true };
  });
}
