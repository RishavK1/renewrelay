import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { maxCsvBytes, previewImport } from "@renewrelay/domain/renewals/imports";
import { parse, uploadCsv, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";

async function POSTHandler(request: Request, { params }: RouteParams<"wid">) {
  const { wid } = await params;
  return uploadCsv(request, maxCsvBytes, (actor, csv) =>
    previewImport(runtime().db, actor, parse(uuid, wid), csv));
}

export const POST = observeRoute("/api/v1/workspaces/{wid}/imports/preview", POSTHandler);
