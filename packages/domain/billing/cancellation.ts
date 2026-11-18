import type { PrismaClient } from "../../db/generated/client";
import { lockWorkspace, setWorkspace } from "../../db/database";
import type { BillingProvider } from "./provider";

export const terminalStates = new Set(["cancelled", "completed", "expired"]);

// Network calls stay outside the transaction. Only the captured operation can be acknowledged.
export async function dispatchCancellation(db: PrismaClient, workspaceId: string, provider: BillingProvider) {
  const operation = await db.$transaction(async tx => {
    await setWorkspace(tx, workspaceId);
    await lockWorkspace(tx, workspaceId);
    return tx.workspaceBilling.findUniqueOrThrow({ where: { workspaceId } });
  });
  if (!operation.cancelRequestedAt) return "idle";
  if (!operation.providerId || !operation.cancellationId || !operation.cancellationMode) return "pending";
  if (!terminalStates.has(operation.providerStatus ?? "")) {
    try {
      await provider.cancel(operation.providerId, operation.cancellationMode === "at_term");
    } catch (error) {
      await db.$transaction(async tx => {
        await setWorkspace(tx, workspaceId);
        await tx.workspaceBilling.updateMany({
          where: { workspaceId, providerId: operation.providerId, cancellationId: operation.cancellationId,
            cancelRequestedAt: { not: null } },
          data: { reconcileAfter: new Date(Date.now() + 300_000) },
        });
      });
      throw error;
    }
  }
  const acknowledged = await db.$transaction(async tx => {
    await setWorkspace(tx, workspaceId);
    await lockWorkspace(tx, workspaceId);
    return tx.workspaceBilling.updateMany({
      where: { workspaceId, providerId: operation.providerId, checkoutIntent: operation.checkoutIntent,
        cancellationId: operation.cancellationId, cancellationMode: operation.cancellationMode,
        cancelRequestedAt: { not: null } },
      data: { cancelRequestedAt: null, reconcileAfter: new Date(), version: { increment: 1 } },
    });
  });
  return acknowledged.count ? "acknowledged" : "pending";
}
