import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { setBlocker } from "@renewrelay/contracts/renewals";
import { updateBlocker } from "@renewrelay/domain/renewals/commands";
import { parse, write, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";

async function PATCHHandler(request: Request, { params }: RouteParams<"wid" | "cycle">) {
  const { wid, cycle } = await params;
  return write(request, "cycle.blocker", setBlocker, (cmd, input) =>
    updateBlocker(runtime().db, cmd, parse(uuid, wid), parse(uuid, cycle), input));
}

export const PATCH = observeRoute("/api/v1/workspaces/{wid}/cycles/{cycle}/blocker", PATCHHandler);
