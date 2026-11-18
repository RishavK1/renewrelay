import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { editCycle } from "@renewrelay/contracts/renewals";
import { getCycle } from "@renewrelay/domain/renewals/queries";
import { reviseSchedule } from "@renewrelay/domain/renewals/commands";
import { parse, read, write, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";

async function GETHandler(request: Request, { params }: RouteParams<"wid" | "cycle">) {
  const { wid, cycle } = await params;
  return read(request, (actor) =>
    getCycle(runtime().db, actor, parse(uuid, wid), parse(uuid, cycle)));
}

async function PATCHHandler(request: Request, { params }: RouteParams<"wid" | "cycle">) {
  const { wid, cycle } = await params;
  return write(request, "cycle.revise", editCycle, (cmd, input) =>
    reviseSchedule(runtime().db, cmd, parse(uuid, wid), parse(uuid, cycle), input));
}

export const GET = observeRoute("/api/v1/workspaces/{wid}/cycles/{cycle}", GETHandler);

export const PATCH = observeRoute("/api/v1/workspaces/{wid}/cycles/{cycle}", PATCHHandler);
