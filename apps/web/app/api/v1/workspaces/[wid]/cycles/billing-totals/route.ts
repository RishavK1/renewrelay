import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { billingTotals } from "@renewrelay/domain/renewals/queries";
import { parse, read, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";

async function GETHandler(request: Request, { params }: RouteParams<"wid">) {
  const { wid } = await params;
  return read(request, (actor) =>
    billingTotals(runtime().db, actor, parse(uuid, wid)));
}

export const GET = observeRoute("/api/v1/workspaces/{wid}/cycles/billing-totals", GETHandler);
