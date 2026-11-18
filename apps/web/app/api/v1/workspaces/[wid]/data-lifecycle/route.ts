import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { owners, requireRecentAuth, withWorkspace } from "@renewrelay/domain/context";
import { parse, read, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";
async function GETHandler(request: Request, { params }: RouteParams<"wid">) {
  const { wid } = await params;
  return read(request, actor => withWorkspace(runtime().db, actor, parse(uuid, wid), owners, false, async ({ tx }) => {
    requireRecentAuth(actor);
    const billing = await tx.workspaceBilling.findUniqueOrThrow({ where: { workspaceId: wid } });
    return { workspaceDeletion: { recoveryDays: 30, requestedAt: billing.deletionRequestedAt, purgeAfter: billing.purgeAfter, purgedAt: billing.purgedAt,
      providerCancellationRequired: !!billing.checkoutIntent },
      temporaryData: { uncommittedImportHours: 24, decisionSessionMinutes: 10, rateCounters: "expire at their configured rate window" },
      financialAndAuditRetention: "Requires approved policy; no new automatic deletion is enabled.",
      sharedIdentity: "Retained while any workspace membership remains; explicit account deletion is available when eligible.",
      externalSystems: "Provider records, backups and recovery ledgers require staging/business approval and verification." };
  }, "billing"));
}

export const GET = observeRoute("/api/v1/workspaces/{wid}/data-lifecycle", GETHandler);
