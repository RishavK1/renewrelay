import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid, transferOwnership as inputSchema } from "@renewrelay/contracts/api";
import { transferOwnership } from "@renewrelay/domain/workspaces";
import { parse, write, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";


async function POSTHandler(request: Request, { params }: RouteParams<"wid">) {
  const { wid } = await params;
  return write(request, "ownership.transfer", inputSchema, (cmd, input) =>
    transferOwnership(runtime().db, cmd, parse(uuid, wid), input));
}

export const POST = observeRoute("/api/v1/workspaces/{wid}/ownership/transfer", POSTHandler);
