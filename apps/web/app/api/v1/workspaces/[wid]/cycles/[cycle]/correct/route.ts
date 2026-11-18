import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { correctCycle } from "@renewrelay/contracts/renewals";
import { appendCorrection } from "@renewrelay/domain/renewals/commands";
import { parse, write, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";

async function POSTHandler(request: Request, { params }: RouteParams<"wid" | "cycle">) {
  const { wid, cycle } = await params;
  return write(request, "cycle.correct", correctCycle, (cmd, input) =>
    appendCorrection(runtime().db, cmd, parse(uuid, wid), parse(uuid, cycle), input));
}

export const POST = observeRoute("/api/v1/workspaces/{wid}/cycles/{cycle}/correct", POSTHandler);
