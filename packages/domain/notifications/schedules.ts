import type { Transaction } from "../../db/database";
import type { Prisma, RenewalCycle } from "../../db/generated/client";
import { addDays, dateText, localInstant } from "../renewal-dates";
import { generateInviteToken, inviteDigest, type InviteCredentials } from "../invite-credentials";

export async function scheduleClientReminders(tx: Transaction, request: {
  id: string; workspaceId: string; recipientEmail: string; respondBy: Date; deadlineAt: Date;
}, timezone: string, credentials: InviteCredentials, now = new Date()) {
  for (const offset of [7, 1]) {
    const runAt = localInstant(addDays(dateText(request.respondBy), -offset), timezone, 9);
    if (runAt <= now) continue;
    const dedupeKey = `client/${request.id}/${offset}`;
    const prior = await tx.decisionDelivery.findUnique({ where: { dedupeKey } });
    if (prior && (prior.status !== "canceled" || prior.firstAttemptAt)) continue;
    const token = generateInviteToken();
    const expiresAt = new Date(Math.min(request.deadlineAt.getTime(), runAt.getTime() + 7 * 86400_000));
    await tx.decisionLink.create({ data: {
      workspaceId: request.workspaceId, requestId: request.id, digest: inviteDigest(token), validFrom: runAt, expiresAt,
    } });
    const data = {
      workspaceId: request.workspaceId, requestId: request.id, kind: "reminder", recipient: request.recipientEmail,
      dedupeKey, runAt, expiresAt: new Date(Math.min(expiresAt.getTime(), runAt.getTime() + 86400_000)),
      ciphertext: credentials.encrypt(token, request.id),
    };
    if (prior) await tx.decisionDelivery.update({ where: { id: prior.id }, data: {
      ciphertext: data.ciphertext, expiresAt: data.expiresAt, status: "pending",
    } });
    else await tx.decisionDelivery.create({ data });

  }
}

export function internalSchedules(cycle: RenewalCycle, recipient: string, now = new Date()) {
  const jobs: Prisma.InternalNotificationCreateManyInput[] = [];
  if (cycle.closedAt || cycle.state === "draft") return jobs;
  for (const offset of [30, 7, 1]) {
    const runAt = localInstant(addDays(dateText(cycle.nextActionOn), -offset), cycle.timezone, 9);
    if (runAt <= now) continue;
    const dedupeKey = JSON.stringify(["internal", cycle.id, cycle.operatorId, dateText(cycle.nextActionOn), offset]);
    jobs.push({ workspaceId: cycle.workspaceId, cycleId: cycle.id, recipientId: cycle.operatorId,
      recipient, kind: "deadline", dedupeKey, runAt, expiresAt: new Date(runAt.getTime() + 86400_000) });
  }
  return jobs;
}
