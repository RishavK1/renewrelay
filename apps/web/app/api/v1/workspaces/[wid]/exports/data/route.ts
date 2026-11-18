import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { dataExportQuery, exportWorkspaceData } from "@renewrelay/domain/data-export";
import { parse, query, read, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";
async function GETHandler(request: Request, { params }: RouteParams<"wid">) {
  const { wid } = await params;
  return read(request, actor => exportWorkspaceData(runtime().db, actor, parse(uuid, wid), query(request, dataExportQuery)));
}

export const GET = observeRoute("/api/v1/workspaces/{wid}/exports/data", GETHandler);
