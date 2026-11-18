import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid, updateClient as inputSchema } from "@renewrelay/contracts/api";
import { getClient, updateClient } from "@renewrelay/domain/clients";
import { parse, read, write, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";


async function GETHandler(request: Request, { params }: RouteParams<"wid" | "client">) {
  const { wid, client } = await params;
  return read(request, (actor) => getClient(runtime().db, actor, parse(uuid, wid), parse(uuid, client)));
}

async function PATCHHandler(request: Request, { params }: RouteParams<"wid" | "client">) {
  const { wid, client } = await params;
  return write(request, "client.update", inputSchema, (cmd, input) =>
    updateClient(runtime().db, cmd, parse(uuid, wid), parse(uuid, client), input));
}

export const GET = observeRoute("/api/v1/workspaces/{wid}/clients/{client}", GETHandler);

export const PATCH = observeRoute("/api/v1/workspaces/{wid}/clients/{client}", PATCHHandler);
