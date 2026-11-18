import { pageResult } from "@renewrelay/domain/pagination";
import { pagination, read } from "@server/http";
import { runtime } from "@server/runtime";
import { setActor } from "@renewrelay/db/database";
export function GET(request: Request) {
  return read(request, async actor => {
    const page = pagination(request);
    const limit = page.limit ?? 25;
    const profile = await runtime().authDb.user.findUniqueOrThrow({ where: { id: actor.id },
      select: { id: true, name: true, email: true, emailVerified: true, image: true, createdAt: true, updatedAt: true, twoFactorEnabled: true } });
    const memberships = await runtime().db.$transaction(async tx => {
      await setActor(tx, actor.id);
      return tx.membership.findMany({ where: { userId: actor.id, workspaceId: page.after ? { gt: page.after } : undefined }, select: { workspaceId: true, role: true, joinedAt: true, removedAt: true }, take: limit + 1, orderBy: { workspaceId: "asc" } });
    });
    const accounts = await runtime().authDb.account.findMany({ where: { userId: actor.id }, take: 100,
      select: { providerId: true, accountId: true, createdAt: true, updatedAt: true } });
    return { profile, accounts, sessions: "/api/v1/account/sessions", securityEvents: "/api/v1/account/security-events", memberships: pageResult(memberships.map(member => ({ ...member, id: member.workspaceId })), limit),
      workspaceData: "Owners can export each workspace using the paginated exports/data datasets." };
  });
}
