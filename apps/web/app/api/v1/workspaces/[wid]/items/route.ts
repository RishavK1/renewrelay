import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { createRenewal } from "@renewrelay/contracts/renewals";
import { createItem } from "@renewrelay/domain/renewals/commands";
import { listItems } from "@renewrelay/domain/renewals/queries";
import { parse, read, write, pagination, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";

async function GETHandler(request: Request, { params }: RouteParams<"wid">) {
  const { wid } = await params;
  return read(request, (actor) =>
    listItems(runtime().db, actor, parse(uuid, wid), pagination(request)));
}

async function POSTHandler(request: Request, { params }: RouteParams<"wid">) {
  const { wid } = await params;
  return write(request, "renewal.create", createRenewal, (cmd, input) =>
    createItem(runtime().db, cmd, parse(uuid, wid), input), 201);
}

export const GET = observeRoute("/api/v1/workspaces/{wid}/items", GETHandler);

export const POST = observeRoute("/api/v1/workspaces/{wid}/items", POSTHandler);
