import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { cycleFilter } from "@renewrelay/contracts/renewals";
import { listCycles } from "@renewrelay/domain/renewals/queries";
import { parse, query, read, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";

async function GETHandler(request: Request, { params }: RouteParams<"wid">) {
  const { wid } = await params;
  return read(request, (actor) =>
    listCycles(runtime().db, actor, parse(uuid, wid), query(request, cycleFilter)));
}

export const GET = observeRoute("/api/v1/workspaces/{wid}/cycles", GETHandler);
