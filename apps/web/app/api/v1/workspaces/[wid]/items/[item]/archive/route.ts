import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { archiveItem } from "@renewrelay/contracts/renewals";
import { archiveRenewal } from "@renewrelay/domain/renewals/commands";
import { parse, write, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";

async function POSTHandler(request: Request, { params }: RouteParams<"wid" | "item">) {
  const { wid, item } = await params;
  return write(request, "renewal.archive", archiveItem, (cmd, input) =>
    archiveRenewal(runtime().db, cmd, parse(uuid, wid), parse(uuid, item), input));
}

export const POST = observeRoute("/api/v1/workspaces/{wid}/items/{item}/archive", POSTHandler);
