import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { editRenewal } from "@renewrelay/contracts/renewals";
import { updateItem } from "@renewrelay/domain/renewals/commands";
import { getItem } from "@renewrelay/domain/renewals/queries";
import { parse, read, write, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";

async function GETHandler(request: Request, { params }: RouteParams<"wid" | "item">) {
  const { wid, item } = await params;
  return read(request, (actor) =>
    getItem(runtime().db, actor, parse(uuid, wid), parse(uuid, item)));
}

async function PATCHHandler(request: Request, { params }: RouteParams<"wid" | "item">) {
  const { wid, item } = await params;
  return write(request, "renewal.update", editRenewal, (cmd, input) =>
    updateItem(runtime().db, cmd, parse(uuid, wid), parse(uuid, item), input));
}

export const GET = observeRoute("/api/v1/workspaces/{wid}/items/{item}", GETHandler);

export const PATCH = observeRoute("/api/v1/workspaces/{wid}/items/{item}", PATCHHandler);
