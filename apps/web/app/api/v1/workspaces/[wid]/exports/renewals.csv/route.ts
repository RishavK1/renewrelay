import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { exportFilter, exportRenewals } from "@renewrelay/domain/renewals/export";
import { parse, query, read, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";

async function GETHandler(request: Request, { params }: RouteParams<"wid">) {
  const { wid } = await params;
  return read(request, async actor => new Response(await exportRenewals(runtime().db, actor, parse(uuid, wid), query(request, exportFilter)), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="renewrelay.csv"', "Cache-Control": "no-store" },
  }));
}

export const GET = observeRoute("/api/v1/workspaces/{wid}/exports/renewals.csv", GETHandler);
