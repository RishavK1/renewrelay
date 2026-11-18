import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { importTemplate } from "@renewrelay/domain/renewals/imports";
import { parse, read, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";

async function GETHandler(request: Request, { params }: RouteParams<"wid">) {
  const { wid } = await params;
  return read(request, async (actor) => new Response(await importTemplate(runtime().db, actor, parse(uuid, wid)), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="renewrelay-import.csv"', "Cache-Control": "no-store" },
  }));
}

export const GET = observeRoute("/api/v1/workspaces/{wid}/imports/template", GETHandler);
