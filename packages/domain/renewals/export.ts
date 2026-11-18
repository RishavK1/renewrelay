import { queueBucket } from "./queries";
import { localToday, sqlDate, dateText } from "../renewal-dates";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { cycleFilter } from "../../contracts/renewals";
import type { PrismaClient } from "../../db/generated/client";
import { managers, withWorkspace, type Actor } from "../context";
import { DomainError } from "../errors";

// Quoted TSV-like protection inside CSV neutralizes formula prefixes for spreadsheet viewing.
export function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[\s\u0000-\u001f]*[=+\-@＝＋－＠]/u.test(text) || /^[\t\r\n]/.test(text)) text = "\t" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export const exportFilter = z.strictObject(cycleFilter.shape).omit({ after: true, limit: true }).extend({
  archived: z.enum(["include", "exclude"]).default("include"),
}).refine(value => !value.from || !value.through || value.from <= value.through, "Dates must be in order.");

export async function exportRenewals(db: PrismaClient, actor: Actor, workspaceId: string,
  filter: z.infer<typeof exportFilter>) {
  return withWorkspace(db, actor, workspaceId, managers, true, async ({ tx }) => {
    // Capture the bounded export under the same tenant authorization and transaction.
    const where = {
      workspaceId, state: filter.status, itemId: filter.itemId, operatorId: filter.operatorId,
      billingStatus: filter.billingStatus,
      item: { workspaceId, clientId: filter.clientId, archivedAt: filter.archived === "exclude" ? null : undefined },
      provider: filter.provider ? { equals: filter.provider, mode: "insensitive" as const } : undefined,
    };
    const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    const today = localToday(workspace.timezone);
    const bucket = filter.bucket;
    const nextActionOn = {
      gte: filter.from ? sqlDate(filter.from) : undefined,
      lte: filter.through ? sqlDate(filter.through) : undefined,
    };
    const bucketWhere = queueBucket(bucket, today);
    const rows = await tx.renewalCycle.findMany({
      where: { ...where, AND: [{ nextActionOn }, bucketWhere] },
      orderBy: [{ nextActionOn: "asc" }, { id: "asc" }], take: 10_001,
      include: { item: { select: { archivedAt: true, clientId: true } } },
    });
    if (rows.length > 10_000) throw new DomainError(422, "export_limit", "Narrow the filters to export at most 10,000 cycles.");
    const columns = ["id", "clientId", "service", "provider", "state", "expiryOn", "noticeBy", "respondBy", "currency", "supplierCostMinor", "clientQuoteMinor", "billingStatus", "invoiceReference", "archived"];
    const csv = [columns, ...rows.map(row => [
      row.id, row.item.clientId, row.service, row.provider, row.state, dateText(row.expiryOn),
      row.noticeBy && dateText(row.noticeBy), row.respondBy && dateText(row.respondBy), row.currency,
      row.supplierCostMinor, row.clientQuoteMinor, row.billingStatus, row.invoiceReference, !!row.item.archivedAt,
    ])].map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
    await tx.auditEvent.create({ data: {
      workspaceId, actorId: actor.id, entityId: workspaceId, requestId: randomUUID(),
      event: "renewals.exported", details: { count: rows.length, filters: filter },
    } });
    return csv;
  }, "safety");
}
