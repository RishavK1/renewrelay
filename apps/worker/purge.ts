import type { PrismaClient } from "../../packages/db/generated/client";
import { setWorkspace, lockWorkspace } from "../../packages/db/database";

export async function purgeDeletedWorkspaces(db: PrismaClient, now = new Date()) {
  const due = await db.workspaceBilling.findMany({
    where: { deletionRequestedAt: { not: null }, purgeAfter: { lte: now }, purgedAt: null },
    take: 25, orderBy: { purgeAfter: "asc" },
  });
  for (const row of due) {
    await db.$transaction(async tx => {
      await setWorkspace(tx, row.workspaceId);
      await lockWorkspace(tx, row.workspaceId);
      const current = await tx.workspaceBilling.findUniqueOrThrow({ where: { workspaceId: row.workspaceId } });
      if (!current.deletionRequestedAt || !current.purgeAfter || current.purgeAfter > now || current.purgedAt) return;
      if (current.checkoutIntent && (!current.providerId || !["cancelled", "completed", "expired"].includes(current.providerStatus ?? ""))) return;
      const id = row.workspaceId;
      await tx.$executeRaw`DELETE FROM decision_sessions WHERE "linkDigest" IN (SELECT digest FROM decision_links WHERE "workspaceId" = ${id}::uuid)`;
      // Explicit tenant predicates and child-first order preserve other workspaces and shared identities.
      await tx.decisionResponse.deleteMany({ where: { workspaceId: id } });
      await tx.decisionChallenge.deleteMany({ where: { workspaceId: id } });
      await tx.decisionDelivery.deleteMany({ where: { workspaceId: id } });
      await tx.decisionLink.deleteMany({ where: { workspaceId: id } });
      await tx.decisionRequest.deleteMany({ where: { workspaceId: id } });
      await tx.internalNotification.deleteMany({ where: { workspaceId: id } });
      await tx.mailJob.deleteMany({ where: { workspaceId: id } });
      await tx.renewalCycle.deleteMany({ where: { workspaceId: id } });
      await tx.renewalItem.deleteMany({ where: { workspaceId: id } });
      await tx.contact.deleteMany({ where: { workspaceId: id } });
      await tx.client.deleteMany({ where: { workspaceId: id } });
      await tx.invitation.deleteMany({ where: { workspaceId: id } });
      await tx.membership.deleteMany({ where: { workspaceId: id } });
      await tx.renewalImport.deleteMany({ where: { workspaceId: id } });
      await tx.auditEvent.deleteMany({ where: { workspaceId: id } });
      await tx.$executeRaw`DELETE FROM command_receipts WHERE scope::jsonb->>1 = ${id} OR result->>'id' = ${id}`;
      await tx.notificationWorkspace.deleteMany({ where: { id } });
      await tx.workspace.update({ where: { id }, data: { name: "Deleted workspace", timezone: "UTC", version: { increment: 1 } } });
      await tx.workspaceBilling.update({ where: { workspaceId: id }, data: {
        purgedAt: now, recoveryOwnerId: null, checkoutKey: null, checkoutUrl: null, version: { increment: 1 },
      } });
    }, { timeout: 30_000 });
  }
}
