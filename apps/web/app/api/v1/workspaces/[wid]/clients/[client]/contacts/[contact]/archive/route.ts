import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid, archiveRecord } from "@renewrelay/contracts/api";
import { archiveContact } from "@renewrelay/domain/clients";
import { parse, write, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";


async function POSTHandler(request: Request, { params }: RouteParams<"wid" | "client" | "contact">) {
  const { wid, client, contact } = await params;
  return write(request, "contact.archive", archiveRecord, (cmd, { expectedVersion }) =>
    archiveContact(runtime().db, cmd, parse(uuid, wid), parse(uuid, client), parse(uuid, contact), expectedVersion));
}

export const POST = observeRoute("/api/v1/workspaces/{wid}/clients/{client}/contacts/{contact}/archive", POSTHandler);
