import type { PrismaClient } from "../../db/generated/client";
import { allStaff, withWorkspace, type Actor } from "../context";
import { DomainError } from "../errors";
import { pageResult, type Page } from "../pagination";
import { findCycle } from "./records";
export function cycleHistory(db: PrismaClient, actor: Actor, workspaceId: string, id: string, page: Page) {
  return withWorkspace(db, actor, workspaceId, allStaff, false, async ({ tx }) => {
    await findCycle(tx, workspaceId, id);
    const limit = page.limit ?? 25;
    const cursor = page.after ? await tx.auditEvent.findFirst({
      where: { workspaceId, entityId: id, id: page.after }, select: { createdAt: true, id: true },
    }) : null;
    if (page.after && !cursor) throw new DomainError(400, "invalid_cursor", "Use the cursor from the previous result.");
    const rows = await tx.auditEvent.findMany({
      where: { workspaceId, entityId: id, ...(cursor ? {
        OR: [{ createdAt: { gt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { gt: cursor.id } }],
      } : {}) },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: limit + 1,
      select: { id: true, event: true, actorId: true, details: true, createdAt: true },
    });
    return pageResult(rows, limit);
  });
}

