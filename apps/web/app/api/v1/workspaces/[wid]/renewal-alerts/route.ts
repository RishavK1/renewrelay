import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { renewalAlerts } from "@renewrelay/domain/renewals/queries";
import { parse, read, pagination, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";

async function GETHandler(request: Request, { params }: RouteParams<"wid">) {
  const { wid } = await params;
  return read(request, (actor) =>
    renewalAlerts(runtime().db, actor, parse(uuid, wid), pagination(request)));
}

export const GET = observeRoute("/api/v1/workspaces/{wid}/renewal-alerts", GETHandler);
