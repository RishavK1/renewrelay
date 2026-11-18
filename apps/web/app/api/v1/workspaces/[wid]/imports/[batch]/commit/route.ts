import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { commitImport } from "@renewrelay/contracts/renewals";
import { commitRenewalImport } from "@renewrelay/domain/renewals/imports";
import { parse, write, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";

async function POSTHandler(request: Request, { params }: RouteParams<"wid" | "batch">) {
  const { wid, batch } = await params;
  return write(request, "import.commit", commitImport, (cmd, input) =>
    commitRenewalImport(runtime().db, cmd, parse(uuid, wid), parse(uuid, batch), input));
}

export const POST = observeRoute("/api/v1/workspaces/{wid}/imports/{batch}/commit", POSTHandler);
