import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid, createClient as inputSchema } from "@renewrelay/contracts/api";
import { createClient, listClients } from "@renewrelay/domain/clients";
import { pagination, parse, read, write, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";


async function GETHandler(request: Request, { params }: RouteParams<"wid">) {
  const { wid } = await params;
  return read(request, (actor) => listClients(runtime().db, actor, parse(uuid, wid), pagination(request)));
}

async function POSTHandler(request: Request, { params }: RouteParams<"wid">) {
  const { wid } = await params;
  return write(request, "client.create", inputSchema, (cmd, input) =>
    createClient(runtime().db, cmd, parse(uuid, wid), input), 201);
}

export const GET = observeRoute("/api/v1/workspaces/{wid}/clients", GETHandler);

export const POST = observeRoute("/api/v1/workspaces/{wid}/clients", POSTHandler);
