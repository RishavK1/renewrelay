import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid, archiveRecord } from "@renewrelay/contracts/api";
import { archiveClient } from "@renewrelay/domain/clients";
import { parse, write, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";


async function POSTHandler(request: Request, { params }: RouteParams<"wid" | "client">) {
  const { wid, client } = await params;
  return write(request, "client.archive", archiveRecord, (cmd, { expectedVersion }) =>
    archiveClient(runtime().db, cmd, parse(uuid, wid), parse(uuid, client), expectedVersion));
}

export const POST = observeRoute("/api/v1/workspaces/{wid}/clients/{client}/archive", POSTHandler);
