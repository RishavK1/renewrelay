import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid, updateContact as inputSchema } from "@renewrelay/contracts/api";
import { getContact, updateContact } from "@renewrelay/domain/clients";
import { parse, read, write, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";


async function GETHandler(request: Request, { params }: RouteParams<"wid" | "client" | "contact">) {
  const { wid, client, contact } = await params;
  return read(request, (actor) => getContact(runtime().db, actor, parse(uuid, wid), parse(uuid, client), parse(uuid, contact)));
}

async function PATCHHandler(request: Request, { params }: RouteParams<"wid" | "client" | "contact">) {
  const { wid, client, contact } = await params;
  return write(request, "contact.update", inputSchema, (cmd, input) =>
    updateContact(runtime().db, cmd, parse(uuid, wid), parse(uuid, client), parse(uuid, contact), input));
}

export const GET = observeRoute("/api/v1/workspaces/{wid}/clients/{client}/contacts/{contact}", GETHandler);

export const PATCH = observeRoute("/api/v1/workspaces/{wid}/clients/{client}/contacts/{contact}", PATCHHandler);
