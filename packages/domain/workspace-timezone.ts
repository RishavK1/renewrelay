import { createHash } from "node:crypto";
import type { PrismaClient } from "../db/generated/client";
import type { Transaction } from "../db/database";
import { audit, checkVersion, once, owners, requireRecentAuth, withWorkspace, type Actor, type Command } from "./context";
import { conflict } from "./errors";
import { revokeDecisions } from "./decisions/revocation";
import { internalSchedules } from "./notifications/schedules";
import { cycleView } from "./renewals/records";

async function preview(tx: Transaction, workspaceId: string, timezone: string) {
  const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  const cycles = await tx.renewalCycle.findMany({ where: { workspaceId, closedAt: null }, orderBy: { id: "asc" }, take: 1001,
    include: { decisionRequests: { where: { supersededAt: null }, select: { id: true } } } });
  if (cycles.length > 1000) conflict("reschedule_limit", "A workspace timezone change supports at most 1,000 open cycles.");
  const token = createHash("sha256").update(JSON.stringify([workspaceId, workspace.version, timezone,
    cycles.map(cycle => [cycle.id, cycle.version, cycle.decisionRequests.map(request => request.id)])])).digest("hex");
  return { workspace, cycles, token };
}
export function previewTimezone(db: PrismaClient, actor: Actor, workspaceId: string, timezone: string) {
  return withWorkspace(db, actor, workspaceId, owners, false, async ({ tx }) => {
    const state = await preview(tx, workspaceId, timezone);
    return { timezone, previousTimezone: state.workspace.timezone, expectedVersion: state.workspace.version, previewToken: state.token,
      affectedCount: state.cycles.length, cycles: state.cycles.map(cycle => ({ id: cycle.id, version: cycle.version,
        fromTimezone: cycle.timezone, toTimezone: timezone, approvalInvalidated: cycle.decisionRequests.length > 0,
        dates: { expiryOn: cycleView(cycle).expiryOn, noticeBy: cycleView(cycle).noticeBy, respondBy: cycleView(cycle).respondBy } })) };
  });
}
export function changeTimezone(db: PrismaClient, cmd: Command, workspaceId: string,
  input: { timezone: string; expectedVersion: number; previewToken: string; confirm: true }) {
  return withWorkspace(db, cmd.actor, workspaceId, owners, true, ({ tx }) => once(tx, cmd, workspaceId, async () => {
    requireRecentAuth(cmd.actor);
    const state = await preview(tx, workspaceId, input.timezone);
    checkVersion(state.workspace.version, input.expectedVersion);
    if (state.token !== input.previewToken) conflict("stale_preview", "Preview the current cycles before confirming.");
    if (state.workspace.timezone === input.timezone) return { timezone: input.timezone, version: state.workspace.version, affectedCount: 0 };
    const members = await tx.membership.findMany({ where: { workspaceId, removedAt: null } });
    const recipients = new Map(members.map(member => [member.userId, member.email]));
    const now = new Date();
    for (const cycle of state.cycles) {
      await revokeDecisions(tx, workspaceId, cycle.id);
      const changed = await tx.renewalCycle.update({ where: { workspaceId_id: { workspaceId, id: cycle.id } }, data: {
        timezone: input.timezone, version: { increment: 1 },
        ...(cycle.decisionRequests.length ? { state: "open", intendedAction: null, nextActionOn: cycle.respondBy ?? cycle.noticeBy ?? cycle.expiryOn } : {}),
      } });
      await tx.internalNotification.updateMany({ where: { workspaceId, cycleId: cycle.id, kind: "deadline", status: { in: ["pending", "leased"] } },
        data: { status: "canceled", messageCiphertext: null, leaseToken: null, leaseUntil: null } });
      const recipient = recipients.get(cycle.operatorId);
      for (const job of recipient ? internalSchedules(changed, recipient, now) : []) {
        await tx.internalNotification.upsert({ where: { dedupeKey: job.dedupeKey }, create: job, update: {} });
        await tx.internalNotification.updateMany({ where: { workspaceId, dedupeKey: job.dedupeKey, attempts: 0, status: "canceled" },
          data: { runAt: job.runAt, expiresAt: job.expiresAt, status: "pending" } });
      }
      await audit(tx, cmd, workspaceId, "cycle.timezone_changed", cycle.id, { from: cycle.timezone, to: input.timezone, approvalInvalidated: cycle.decisionRequests.length > 0 });
    }
    await tx.internalNotification.updateMany({ where: { workspaceId, kind: "overdue", status: { in: ["pending", "leased"] } },
      data: { status: "canceled", messageCiphertext: null, leaseToken: null, leaseUntil: null } });
    const workspace = await tx.workspace.update({ where: { id: workspaceId }, data: { timezone: input.timezone, version: { increment: 1 } } });
    await audit(tx, cmd, workspaceId, "workspace.timezone_changed", workspaceId, { from: state.workspace.timezone, to: input.timezone, affectedCount: state.cycles.length });
    return { timezone: workspace.timezone, version: workspace.version, affectedCount: state.cycles.length };
  }));
}
