import { observeRoute } from "@renewrelay/operations/telemetry";
import { archiveRecord, uuid } from "@renewrelay/contracts/api";
import { resend } from "@renewrelay/domain/decisions/service";
import { parse, write, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";
async function POSTHandler(request: Request, { params }: RouteParams<"wid" | "cycle" | "request">) {
  const ids = await params;
  return write(request, "decision.resend", archiveRecord, (cmd, input) => resend(runtime().db, cmd,
    parse(uuid, ids.wid), parse(uuid, ids.cycle), parse(uuid, ids.request), input, runtime().credentials, runtime().decisionSecret));
}

export const POST = observeRoute("/api/v1/workspaces/{wid}/cycles/{cycle}/requests/{request}/resend", POSTHandler);
