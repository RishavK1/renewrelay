import type { PrismaClient, Prisma } from "../db/generated/client";
import { setActor } from "../db/database";
export function recordIdentityEvent(db: PrismaClient, userId: string,
  event: "mfa.verified" | "mfa.recovered" | "sessions.revoked" | "password.reset", details: Prisma.InputJsonObject = {}) {
  return db.$transaction(async tx => {
    await setActor(tx, userId);
    await tx.identitySecurityEvent.create({ data: { userId, event, details } });
  });
}
