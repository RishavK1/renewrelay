import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../db/generated/client";
import { type Command, audit, once, owners, requireRecentAuth, withWorkspace } from "../context";
import { DomainError, conflict } from "../errors";

export function deleteWorkspace(db: PrismaClient, cmd: Command, workspaceId: string,
  input: { confirmName: string; exportAcknowledged: true }) {
  return withWorkspace(db, cmd.actor, workspaceId, owners, true, async ({ tx }) => {
    requireRecentAuth(cmd.actor);
    return once(tx, cmd, workspaceId, async () => {
      const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      if (workspace.name !== input.confirmName) conflict("confirmation_mismatch", "Confirm the current workspace name.");
      const current = await tx.workspaceBilling.findUniqueOrThrow({ where: { workspaceId } });
      if (current.deletionRequestedAt) return { purgeAfter: current.purgeAfter!.toISOString() };
      const purgeAfter = new Date(Date.now() + 30 * 86400_000);
      await tx.workspaceBilling.update({ where: { workspaceId }, data: {
        deletionRequestedAt: new Date(), recoveryOwnerId: cmd.actor.id, purgeAfter,
        cancelAtTerm: true, cancelRequestedAt: current.providerId || current.checkoutIntent ? new Date() : null,
        cancellationId: current.providerId || current.checkoutIntent ? randomUUID() : null,
        cancellationMode: current.providerId || current.checkoutIntent ? "immediate" : null,
        reconcileAfter: new Date(), version: { increment: 1 },
      } });
      await tx.decisionLink.updateMany({ where: { workspaceId }, data: { revokedAt: new Date() } });
      await tx.invitation.updateMany({ where: { workspaceId, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.mailJob.updateMany({ where: { workspaceId, status: { in: ["pending", "leased"] } },
        data: { status: "canceled", ciphertext: null, leaseUntil: null, leaseToken: null } });
      await tx.decisionDelivery.updateMany({ where: { workspaceId, status: { in: ["pending", "leased"] } },
        data: { status: "canceled", ciphertext: null, messageCiphertext: null, leaseUntil: null, leaseToken: null } });
      await tx.internalNotification.updateMany({ where: { workspaceId, status: { in: ["pending", "leased"] } },
        data: { status: "canceled", leaseUntil: null, leaseToken: null } });
      await audit(tx, cmd, workspaceId, "workspace.deletion_requested", workspaceId, { purgeAfter: purgeAfter.toISOString() });
      return { purgeAfter: purgeAfter.toISOString() };
    });
  }, "billing");
}

export function restoreWorkspace(db: PrismaClient, cmd: Command, workspaceId: string) {
  return withWorkspace(db, cmd.actor, workspaceId, owners, true, async ({ tx }) => {
    requireRecentAuth(cmd.actor);
    return once(tx, cmd, workspaceId, async () => {
      const current = await tx.workspaceBilling.findUniqueOrThrow({ where: { workspaceId } });
      if (current.purgedAt || !current.deletionRequestedAt || !current.purgeAfter || current.purgeAfter <= new Date()) {
        throw new DomainError(410, "recovery_unavailable", "This workspace cannot be recovered.");
      }
      if (current.recoveryOwnerId !== cmd.actor.id) throw new DomainError(403, "forbidden", "Only the requesting owner can recover this workspace.");
      await tx.workspaceBilling.update({ where: { workspaceId }, data: {
        deletionRequestedAt: null, purgeAfter: null, recoveryOwnerId: null, version: { increment: 1 },
      } });
      await audit(tx, cmd, workspaceId, "workspace.recovered", workspaceId);
      return { recovered: true };
    });
  }, "billing");
}
