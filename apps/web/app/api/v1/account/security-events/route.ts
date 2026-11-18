import { read, pagination } from "@server/http";
import { runtime } from "@server/runtime";
import { setActor } from "@renewrelay/db/database";
import { pageResult } from "@renewrelay/domain/pagination";
export function GET(request: Request) {
  return read(request, actor => runtime().authDb.$transaction(async tx => {
    await setActor(tx, actor.id);
    const page = pagination(request);
    const limit = page.limit ?? 25;
    const rows = await tx.identitySecurityEvent.findMany({ where: { userId: actor.id, id: page.after ? { gt: page.after } : undefined },
      orderBy: { id: "asc" }, take: limit + 1, select: { id: true, event: true, details: true, createdAt: true } });
    return pageResult(rows, limit);
  }));
}
