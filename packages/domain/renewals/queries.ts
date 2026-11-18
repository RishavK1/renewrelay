import { workspaceEntitlement } from "../billing/policy";
import type { z } from "zod";
import { dateOnly, type cycleFilter } from "../../contracts/renewals";
import { uuid } from "../../contracts/api";
import type { Prisma, PrismaClient } from "../../db/generated/client";
import { allStaff, owners, withWorkspace, type Actor } from "../context";
import { DomainError } from "../errors";
import { type Page, pageResult } from "../pagination";
import { addDays, dateText, localToday, sqlDate, suggestedSuccessor } from "../renewal-dates";
import { cycleView, findCycle, findItem, itemView, workspaceTimezone } from "./records";

type Filter = z.infer<typeof cycleFilter>;
type QueueCursor = { today: string; date: string; id: string; rank: 0 | 1 };

function decodeCursor(value: string): QueueCursor {
  let cursor: unknown;
  try {
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error("Invalid cursor encoding.");
    cursor = JSON.parse(Buffer.from(value, "base64url").toString());
  } catch {
    throw new DomainError(400, "invalid_cursor", "Use the cursor from the previous result.");
  }
  if (!cursor || typeof cursor !== "object" || !("today" in cursor) || !("date" in cursor) || !("id" in cursor) ||
    !("rank" in cursor) || (cursor.rank !== 0 && cursor.rank !== 1) ||
    !dateOnly.safeParse(cursor.today).success || !dateOnly.safeParse(cursor.date).success || !uuid.safeParse(cursor.id).success) {
    throw new DomainError(400, "invalid_cursor", "Use the cursor from the previous result.");
  }
  return cursor as QueueCursor;
}

export function queueBucket(bucket: Filter["bucket"], today: string): Prisma.RenewalCycleWhereInput {
  switch (bucket) {
    case "waiting_on_client": return {
      state: "open", closedAt: null,
      decisionRequests: { some: { supersededAt: null, decidedAt: null } },
    };
    case "ready_for_operator": return { state: "ready" };
    case "delivery_failed": return { closedAt: null, decisionRequests: { some: {
      supersededAt: null, decidedAt: null, deliveries: { some: { status: { in: ["failed", "uncertain", "suppressed", "delayed"] } } },
    } } };
    case "blocked": return { closedAt: null, blockedReason: { not: null } };
    case "overdue": return { closedAt: null, state: { not: "draft" }, nextActionOn: { lt: sqlDate(today) } };
    case "due_soon": return {
      closedAt: null, state: { not: "draft" }, nextActionOn: { gte: sqlDate(today), lte: sqlDate(addDays(today, 29)) },
    };
    default: return {};
  }
}

export function listCycles(db: PrismaClient, actor: Actor, workspaceId: string, filter: Filter) {
  return withWorkspace(db, actor, workspaceId, allStaff, false, async ({ tx }) => {
    const cursor = filter.after ? decodeCursor(filter.after) : undefined;
    const today = cursor?.today ?? localToday(await workspaceTimezone(tx, workspaceId));
    const overdue = queueBucket("overdue", today);
    const findPage = (rank: 0 | 1, take: number) => tx.renewalCycle.findMany({
      where: {
        workspaceId, state: filter.status, operatorId: filter.operatorId, itemId: filter.itemId,
        AND: [
          queueBucket(filter.bucket, today),
          rank === 0 ? overdue : { NOT: overdue },
          ...(cursor?.rank === rank ? [{ OR: [
            { nextActionOn: { gt: sqlDate(cursor.date) } },
            { nextActionOn: sqlDate(cursor.date), id: { gt: cursor.id } },
          ] }] : []),
        ],
        billingStatus: filter.billingStatus, item: {
          workspaceId, clientId: filter.clientId,
          ...(filter.billingStatus || filter.status || filter.itemId ? {} : { archivedAt: null }),
        },
        provider: filter.provider ? { equals: filter.provider, mode: "insensitive" } : undefined,
        nextActionOn: { gte: filter.from ? sqlDate(filter.from) : undefined, lte: filter.through ? sqlDate(filter.through) : undefined },
      },
      select: {
        id: true, itemId: true, item: { select: { clientId: true } }, operatorId: true, sequence: true,
        service: true, provider: true, state: true, intendedAction: true, expiryOn: true, noticeBy: true, respondBy: true,
        nextActionOn: true, timezone: true, currency: true, clientQuoteMinor: true,
        billingStatus: true, autoRenew: true, blockedReason: true, version: true, closedAt: true,
      },
      orderBy: [{ nextActionOn: "asc" }, { id: "asc" }],
      take,
    });
    const older = cursor?.rank === 1 ? [] : await findPage(0, filter.limit + 1);
    const remaining = filter.limit + 1 - older.length;
    const rows = remaining > 0 ? [...older, ...await findPage(1, remaining)] : older;
    const items = rows.slice(0, filter.limit).map(({ item, closedAt, expiryOn, noticeBy, respondBy, nextActionOn, ...row }) => ({
      ...row, clientId: item.clientId, expiryOn: dateText(expiryOn), noticeBy: noticeBy && dateText(noticeBy),
      respondBy: respondBy && dateText(respondBy), nextActionOn: dateText(nextActionOn),
      overdue: !closedAt && row.state !== "draft" && dateText(nextActionOn) < today,
      providerNoticeMissed: !closedAt && row.state !== "draft" && !!noticeBy && dateText(noticeBy) < today,
    }));
    const last = items.at(-1);
    const nextCursor = rows.length > filter.limit && last
      ? Buffer.from(JSON.stringify({
        today, date: last.nextActionOn, id: last.id, rank: last.overdue ? 0 : 1,
      } satisfies QueueCursor)).toString("base64url")
      : null;
    return { items, nextCursor };
  });
}

export function getCycle(db: PrismaClient, actor: Actor, workspaceId: string, id: string) {
  return withWorkspace(db, actor, workspaceId, allStaff, false, async ({ tx }) => {
    const { item, cycle } = await findCycle(tx, workspaceId, id);
    const access = await workspaceEntitlement(tx, workspaceId);
    const history = await tx.auditEvent.findMany({ where: { workspaceId, entityId: id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 26,
      select: { id: true, event: true, actorId: true, details: true, createdAt: true } });
    return {
      cycle: cycleView(cycle), item: itemView(item),
      history: pageResult(history, 25),
      allowedActions: !access.writable ? [] : cycle.closedAt
        ? ["correct", ...(cycle.payer === "agency" && cycle.rebillable && ["renewed", "cancelled"].includes(cycle.state) ? ["billing"] : [])]
        : cycle.state === "draft" ? ["activate", "revise", "withdraw"]
        : ["revise", "withdraw", ...(cycle.state === "ready" ? ["blocker", ...(!cycle.blockedReason ? ["complete"] : [])] : ["ready", "record_offline"]),
          ...(cycle.respondBy && dateText(cycle.respondBy) >= localToday(cycle.timezone) && cycle.clientQuoteMinor !== null && cycle.term ? ["issue"] : [])],
      suggestedNext: cycle.closedAt ? null : suggestedSuccessor(item.recurrence, item.anchorOn, cycle),
    };
  });
}

export function listItems(db: PrismaClient, actor: Actor, workspaceId: string, page: Page) {
  return withWorkspace(db, actor, workspaceId, allStaff, false, async ({ tx }) => {
    const limit = page.limit ?? 25;
    const rows = await tx.renewalItem.findMany({
      where: { workspaceId, archivedAt: null, id: page.after ? { gt: page.after } : undefined },
      orderBy: { id: "asc" }, take: limit + 1,
    });
    return pageResult(rows.map(itemView), limit);
  });
}

export function getItem(db: PrismaClient, actor: Actor, workspaceId: string, id: string) {
  return withWorkspace(db, actor, workspaceId, allStaff, false, async ({ tx }) => {
    const item = await findItem(tx, workspaceId, id);
    return itemView(item);
  });
}

export { cycleHistory } from "./history";

export function billingTotals(db: PrismaClient, actor: Actor, workspaceId: string) {
  return withWorkspace(db, actor, workspaceId, allStaff, false, ({ tx }) =>
    tx.$queryRaw<{ currency: string; quoteTotalMinor: string | null; totalItems: string; quotesMissing: string }[]>`
      SELECT currency, sum("clientQuoteMinor")::text AS "quoteTotalMinor", count(*)::text AS "totalItems",
        count(*) FILTER (WHERE "clientQuoteMinor" IS NULL)::text AS "quotesMissing"
      FROM renewal_cycles
      WHERE "workspaceId" = ${workspaceId}::uuid AND "billingStatus" = 'to_invoice'
      GROUP BY currency ORDER BY currency
    `,
  );
}

export function renewalAlerts(db: PrismaClient, actor: Actor, workspaceId: string, page: Page) {
  return withWorkspace(db, actor, workspaceId, owners, false, async ({ tx }) => {
    const limit = page.limit ?? 25;
    return pageResult(await tx.auditEvent.findMany({
      where: { workspaceId, event: { in: ["cycle.activated_overdue", "cycle.blocked"] }, id: page.after ? { gt: page.after } : undefined },
      orderBy: { id: "asc" }, take: limit + 1,
      select: { id: true, entityId: true, event: true, createdAt: true },
    }), limit);
  });
}
