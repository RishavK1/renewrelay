import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid, createInvitation } from "@renewrelay/contracts/api";
import { createInvite, listInvites } from "@renewrelay/domain/workspaces";
import { pagination, parse, read, write, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";


async function GETHandler(request: Request, { params }: RouteParams<"wid">) {
  const { wid } = await params;
  return read(request, (actor) => listInvites(runtime().db, actor, parse(uuid, wid), pagination(request)));
}

async function POSTHandler(request: Request, { params }: RouteParams<"wid">) {
  const { wid } = await params;
  return write(request, "invitation.create", createInvitation, (cmd, input) =>
    createInvite(runtime().db, cmd, parse(uuid, wid), input, runtime().credentials), 201);
}

export const GET = observeRoute("/api/v1/workspaces/{wid}/invites", GETHandler);

export const POST = observeRoute("/api/v1/workspaces/{wid}/invites", POSTHandler);
