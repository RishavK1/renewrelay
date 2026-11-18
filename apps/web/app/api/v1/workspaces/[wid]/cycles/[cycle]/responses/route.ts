import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { decisionResponses } from "@renewrelay/domain/decisions/history";
import { parse, read, pagination, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";

async function GETHandler(request: Request, { params }: RouteParams<"wid" | "cycle">) {
  const { wid, cycle } = await params;
  return read(request, actor => decisionResponses(runtime().db, actor, parse(uuid, wid), parse(uuid, cycle), pagination(request)));
}

export const GET = observeRoute("/api/v1/workspaces/{wid}/cycles/{cycle}/responses", GETHandler);
