import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid, createContact as inputSchema } from "@renewrelay/contracts/api";
import { createContact, listContacts } from "@renewrelay/domain/clients";
import { pagination, parse, read, write, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";


async function GETHandler(request: Request, { params }: RouteParams<"wid" | "client">) {
  const { wid, client } = await params;
  return read(request, (actor) => listContacts(runtime().db, actor, parse(uuid, wid), parse(uuid, client), pagination(request)));
}

async function POSTHandler(request: Request, { params }: RouteParams<"wid" | "client">) {
  const { wid, client } = await params;
  return write(request, "contact.create", inputSchema, (cmd, input) =>
    createContact(runtime().db, cmd, parse(uuid, wid), parse(uuid, client), input), 201);
}

export const GET = observeRoute("/api/v1/workspaces/{wid}/clients/{client}/contacts", GETHandler);

export const POST = observeRoute("/api/v1/workspaces/{wid}/clients/{client}/contacts", POSTHandler);
