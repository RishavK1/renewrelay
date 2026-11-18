import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { revokeInvitation } from "@renewrelay/domain/workspaces";
import { parse, writeWithoutBody, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";


async function DELETEHandler(request: Request, { params }: RouteParams<"wid" | "invite">) {
  const { wid, invite } = await params;
  return writeWithoutBody(request, "invitation.revoke", (cmd) =>
    revokeInvitation(runtime().db, cmd, parse(uuid, wid), parse(uuid, invite)));
}

export const DELETE = observeRoute("/api/v1/workspaces/{wid}/invites/{invite}", DELETEHandler);
