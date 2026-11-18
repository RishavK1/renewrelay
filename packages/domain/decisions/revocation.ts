import type { Transaction } from "../../db/database";
import { audit, type Command } from "../context";

export async function revokeDecisions(tx: Transaction, workspaceId: string, cycleId: string) {
  const current = await tx.decisionRequest.findMany({
    where: { workspaceId, cycleId, supersededAt: null }, select: { id: true },
  });
  const ids = current.map(request => request.id);
  if (!ids.length) return;
  await tx.decisionRequest.updateMany({ where: { workspaceId, id: { in: ids } }, data: { supersededAt: new Date() } });
  await revokeRequestAccess(tx, workspaceId, ids);
}

export async function revokeRequestAccess(tx: Transaction, workspaceId: string, ids: string[]) {
  const now = new Date();
  const links = await tx.decisionLink.findMany({
    where: { workspaceId, requestId: { in: ids } }, select: { digest: true },
  });
  await tx.decisionSession.updateMany({
    where: { linkDigest: { in: links.map(link => link.digest) }, expiresAt: { gt: now } },
    data: { expiresAt: now },
  });
  await tx.decisionLink.updateMany({ where: { workspaceId, requestId: { in: ids } }, data: { revokedAt: now } });
  await tx.decisionChallenge.updateMany({
    where: { workspaceId, requestId: { in: ids } }, data: { expiresAt: now, verifiedAt: null },
  });
  await tx.decisionDelivery.updateMany({
    where: { workspaceId, requestId: { in: ids }, status: { in: ["pending", "leased"] } },
    data: { status: "canceled", ciphertext: null, messageCiphertext: null, leaseToken: null, leaseUntil: null },
  });
}

// The caller holds the workspace write lock, shared with public decisions and issuance.
export async function revokeContactDecisions(tx: Transaction, cmd: Command, workspaceId: string, contactId: string) {
  const requests = await tx.decisionRequest.findMany({
    where: { workspaceId, contactId, supersededAt: null, cycle: { closedAt: null } },
    include: { cycle: true },
  });
  for (const request of requests) {
    await revokeDecisions(tx, workspaceId, request.cycleId);
    const cycle = request.cycle;
    const updated = await tx.renewalCycle.update({
      where: { workspaceId_id: { workspaceId, id: cycle.id } },
      data: { state: "open", intendedAction: null,
        nextActionOn: cycle.respondBy ?? cycle.noticeBy ?? cycle.expiryOn, version: { increment: 1 } },
    });
    await audit(tx, cmd, workspaceId, "decision.recipient_revoked", cycle.id, {
      requestId: request.id, contactId, fromState: cycle.state, version: updated.version,
    });
  }
}
