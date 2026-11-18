import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { requestDeletion } from "@renewrelay/contracts/billing";
import { deleteWorkspace } from "@renewrelay/domain/billing/deletion";
import { parse, write, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";

async function POSTHandler(request: Request, { params }: RouteParams<"wid">) {
  const { wid } = await params;
  return write(request, "deleteWorkspace", requestDeletion, (cmd, input) =>
    deleteWorkspace(runtime().db, cmd, parse(uuid, wid), input));
}

export const POST = observeRoute("/api/v1/workspaces/{wid}/workspace-deletion", POSTHandler);
