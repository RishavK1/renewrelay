import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { allStaff, withWorkspace } from "@renewrelay/domain/context";
import { pageResult } from "@renewrelay/domain/pagination";
import { parse, pagination, read, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";

async function GETHandler(request: Request, { params }: RouteParams<"wid">) {
  const { wid } = await params;
  return read(request, actor => withWorkspace(runtime().db, actor, parse(uuid, wid), allStaff, false, async ({ tx, workspaceId }) => {
    const page = pagination(request);
    const limit = page.limit ?? 25;
    return pageResult(await tx.decisionDelivery.findMany({
      where: { workspaceId, id: page.after ? { gt: page.after } : undefined },
      select: { id: true, requestId: true, kind: true, status: true, attempts: true, runAt: true, lastError: true },
      orderBy: { id: "asc" }, take: limit + 1,
    }), limit);
  }));
}

export const GET = observeRoute("/api/v1/workspaces/{wid}/deliveries", GETHandler);
