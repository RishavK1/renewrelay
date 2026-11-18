import type { PrismaClient } from "../../db/generated/client";
import { allStaff, withWorkspace, type Actor } from "../context";
import { DomainError } from "../errors";
import { pageResult, type Page } from "../pagination";
import { dateText } from "../renewal-dates";
import { findCycle } from "../renewals/records";

export function decisionResponses(db: PrismaClient, actor: Actor, workspaceId: string, cycleId: string, page: Page) {
  return withWorkspace(db, actor, workspaceId, allStaff, false, async ({ tx }) => {
    await findCycle(tx, workspaceId, cycleId);
    const limit = page.limit ?? 25;
    const scope = { workspaceId, request: { cycleId } };
    const cursor = page.after ? await tx.decisionResponse.findFirst({
      where: { ...scope, id: page.after }, select: { createdAt: true, id: true },
    }) : null;
    if (page.after && !cursor) throw new DomainError(400, "invalid_cursor", "Use the cursor from the previous result.");
    const rows = await tx.decisionResponse.findMany({
      where: { ...scope, ...(cursor ? { OR: [
        { createdAt: { gt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { gt: cursor.id } },
      ] } : {}) },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: limit + 1,
      select: {
        id: true, choice: true, question: true, createdAt: true,
        request: { select: { id: true, revision: true, contactId: true, recipientEmail: true,
          issuerId: true, issuerLabel: true, service: true, currency: true, amountMinor: true, term: true,
          respondBy: true, deadlineAt: true, expiryOn: true, noticeBy: true, customerNote: true, createdAt: true, supersededAt: true, decidedAt: true } },
      },
    });
    const visible = rows.slice(0, limit);
    const resolutions = visible.length ? await tx.auditEvent.findMany({
      where: { workspaceId, entityId: cycleId, event: "decision.question_resolved",
        OR: visible.map(response => ({ details: { path: ["responseId"], equals: response.id } })) },
      select: { id: true, actorId: true, createdAt: true, details: true },
    }) : [];
    const byResponse = new Map(resolutions.flatMap(event => {
      const details = event.details;
      if (!details || typeof details !== "object" || Array.isArray(details) ||
        typeof details.responseId !== "string" || typeof details.note !== "string") return [];
      return [[details.responseId, { id: event.id, actorId: event.actorId, note: details.note, createdAt: event.createdAt }]] as const;
    }));
    return pageResult(rows.map(({ request, ...response }) => ({
      ...response, request: { ...request, respondBy: dateText(request.respondBy) },
      resolution: byResponse.get(response.id) ?? null,
    })), limit);
  });
}
