import { z } from "zod";
import { query, read } from "@server/http";
import { runtime } from "@server/runtime";
import { DomainError } from "@renewrelay/domain/errors";
import { pageResult } from "@renewrelay/domain/pagination";
const page = z.strictObject({ after: z.string().min(1).max(128).optional(), limit: z.string().regex(/^(100|[1-9][0-9]?)$/).transform(Number).default(25) });
export function GET(request: Request) {
  return read(request, async actor => {
    const input = query(request, page);
    const cursor = input.after ? await runtime().authDb.session.findFirst({ where: { id: input.after, userId: actor.id } }) : null;
    if (input.after && !cursor) throw new DomainError(400, "invalid_cursor", "Use a cursor from your session list.");
    const rows = await runtime().authDb.session.findMany({ where: { userId: actor.id, expiresAt: { gt: new Date() },
      ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}) },
      take: input.limit + 1, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, createdAt: true, expiresAt: true, mfaVerifiedAt: true, ipAddress: true, userAgent: true } });
    return pageResult(rows, input.limit);
  });
}
