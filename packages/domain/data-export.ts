import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "../db/generated/client";
import { owners, requireRecentAuth, withWorkspace, type Actor } from "./context";
import { DomainError } from "./errors";
import { pageResult } from "./pagination";

export const exportDataset = z.enum(["workspace", "members", "invitations", "clients", "contacts", "items", "cycles",
  "requests", "responses", "audit", "billing", "payments", "deliveries", "notifications", "imports", "invitationDeliveries", "mailEvents"]);
export const dataExportQuery = z.strictObject({ dataset: exportDataset, after: z.string().min(1).max(128).optional(),
  asOf: z.iso.datetime().optional(),
  limit: z.string().regex(/^(100|[1-9][0-9]?)$/).transform(Number).default(25) });
type Query = z.infer<typeof dataExportQuery>;

export function exportWorkspaceData(db: PrismaClient, actor: Actor, workspaceId: string, input: Query) {
  if (input.after && !["members", "payments", "mailEvents"].includes(input.dataset) && !z.uuid().safeParse(input.after).success) {
    throw new DomainError(400, "invalid_cursor", "Use the cursor from the previous export page.");
  }
  const asOf = input.asOf ? new Date(input.asOf) : new Date();
  if (asOf > new Date()) throw new DomainError(400, "invalid_request", "Export cutoff cannot be in the future.");
  return withWorkspace(db, actor, workspaceId, owners, true, async ({ tx }) => {
    requireRecentAuth(actor);
    const limit = input.dataset === "imports" ? 1 : input.limit;
    const where = { workspaceId, createdAt: { lt: asOf }, id: input.after ? { gt: input.after } : undefined };
    const options = { where, orderBy: { id: "asc" as const }, take: limit + 1 };
    let rows: { id: string; [key: string]: unknown }[];
    switch (input.dataset) {
      case "workspace": rows = input.after ? [] : [await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { id: true, name: true, timezone: true, version: true, createdAt: true, updatedAt: true } })]; break;
      case "members": rows = (await tx.membership.findMany({ where: { workspaceId, joinedAt: { lt: asOf }, userId: input.after ? { gt: input.after } : undefined }, orderBy: { userId: "asc" }, take: limit + 1 })).map(member => ({ ...member, id: member.userId })); break;
      case "invitations": rows = await tx.invitation.findMany({ ...options, select: { id: true, email: true, role: true, issuedBy: true, expiresAt: true, acceptedAt: true, revokedAt: true, createdAt: true } }); break;
      case "clients": rows = await tx.client.findMany(options); break;
      case "contacts": rows = await tx.contact.findMany(options); break;
      case "items": rows = await tx.renewalItem.findMany(options); break;
      case "cycles": rows = await tx.renewalCycle.findMany(options); break;
      case "requests": rows = await tx.decisionRequest.findMany(options); break;
      case "responses": rows = await tx.decisionResponse.findMany({ ...options, select: { id: true, requestId: true, choice: true, question: true, cycleVersion: true, createdAt: true } }); break;
      case "audit": rows = await tx.auditEvent.findMany(options); break;
      case "billing": rows = input.after ? [] : (await tx.workspaceBilling.findMany({ where: { workspaceId },
        select: { workspaceId: true, trialEndsAt: true, paidThrough: true, paymentFailed: true, cancelAtTerm: true,
          providerStatus: true, deletionRequestedAt: true, purgeAfter: true, purgedAt: true } })).map(row => ({ ...row, id: row.workspaceId })); break;
      case "payments": rows = await tx.billingPayment.findMany({ ...options, where: { workspaceId, id: input.after ? { gt: input.after } : undefined, verifiedAt: { lt: asOf } } }); break;
      case "deliveries": rows = await tx.decisionDelivery.findMany({ ...options, where: { workspaceId, id: input.after ? { gt: input.after } : undefined, request: { createdAt: { lt: asOf } } }, select: { id: true, requestId: true, recipient: true, kind: true, status: true, attempts: true, runAt: true, expiresAt: true, lastError: true } }); break;
      case "notifications": rows = await tx.internalNotification.findMany({ ...options, select: { id: true, cycleId: true, recipientId: true, recipient: true, kind: true, status: true, attempts: true, runAt: true, expiresAt: true, createdAt: true } }); break;
      case "invitationDeliveries": rows = await tx.mailJob.findMany({ ...options,
        where: { workspaceId, id: input.after ? { gt: input.after } : undefined, invitation: { createdAt: { lt: asOf } } },
        select: { id: true, inviteId: true, recipient: true, status: true, attempts: true, runAt: true, expiresAt: true } }); break;
      case "mailEvents": rows = await tx.$queryRaw<{ id: string; [key: string]: unknown }[]>`
        SELECT event.id, event."deliveryId", event."providerEmailId", event."eventType", event."createdAt", event."processedAt"
        FROM mail_provider_events event JOIN decision_deliveries delivery ON delivery.id::text = event."deliveryId"
        WHERE delivery."workspaceId" = ${workspaceId}::uuid AND event."createdAt" < ${asOf}
          AND (${input.after ?? null}::text IS NULL OR event.id > ${input.after ?? null})
        ORDER BY event.id LIMIT ${limit + 1}
      `; break;
      case "imports": rows = await tx.renewalImport.findMany({ ...options, select: { id: true, actorId: true, version: true, rows: true, result: true, expiresAt: true, committedAt: true, createdAt: true } }); break;
    }
    const result = pageResult(rows, limit);
    if (Buffer.byteLength(JSON.stringify(result)) > 4 * 1024 * 1024) throw new DomainError(422, "export_page_limit", "Use a smaller page limit for this dataset.");
    await tx.auditEvent.create({ data: { workspaceId, actorId: actor.id, entityId: workspaceId, requestId: randomUUID(),
      event: "workspace.data_exported", details: { dataset: input.dataset, count: result.items.length } } });
    return { dataset: input.dataset, asOf: asOf.toISOString(), ...result };
  }, "safety");
}
