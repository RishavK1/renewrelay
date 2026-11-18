import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid, userId } from "@renewrelay/contracts/api";
import { removal } from "@renewrelay/contracts/renewals";
import { removeMember } from "@renewrelay/domain/workspaces";
import { parse, writeOptionalJson, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";


async function DELETEHandler(request: Request, { params }: RouteParams<"wid" | "user">) {
  const { wid, user } = await params;
  return writeOptionalJson(request, "membership.remove", removal, (cmd, body) =>
    removeMember(runtime().db, cmd, parse(uuid, wid), parse(userId, user), body?.replacementUserId));
}

export const DELETE = observeRoute("/api/v1/workspaces/{wid}/members/{user}", DELETEHandler);
