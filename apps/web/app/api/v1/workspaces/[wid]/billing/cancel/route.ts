import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { emptyBillingCommand } from "@renewrelay/contracts/billing";
import { cancelSubscription } from "@renewrelay/domain/billing/service";
import { billingProvider } from "@renewrelay/integrations/billing-config";
import { parse, write, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";

async function POSTHandler(request: Request, { params }: RouteParams<"wid">) {
  const { wid } = await params;
  return write(request, "cancelSubscription", emptyBillingCommand, (cmd) =>
    cancelSubscription(runtime().db, cmd, parse(uuid, wid), billingProvider(), runtime().credentials));
}

export const POST = observeRoute("/api/v1/workspaces/{wid}/billing/cancel", POSTHandler);
