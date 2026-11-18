import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { withdrawCycle } from "@renewrelay/contracts/renewals";
import { withdrawRenewal } from "@renewrelay/domain/renewals/commands";
import { parse, write, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";

async function POSTHandler(request: Request, { params }: RouteParams<"wid" | "cycle">) {
  const { wid, cycle } = await params;
  return write(request, "cycle.withdraw", withdrawCycle, (cmd, input) =>
    withdrawRenewal(runtime().db, cmd, parse(uuid, wid), parse(uuid, cycle), input));
}

export const POST = observeRoute("/api/v1/workspaces/{wid}/cycles/{cycle}/withdraw", POSTHandler);
