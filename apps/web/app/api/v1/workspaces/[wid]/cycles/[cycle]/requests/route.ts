import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { issueDecision } from "@renewrelay/contracts/decisions";
import { issue } from "@renewrelay/domain/decisions/service";
import { parse, write, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";

async function POSTHandler(request: Request, { params }: RouteParams<"wid" | "cycle">) {
  const { wid, cycle } = await params;
  return write(request, "decision.issue", issueDecision, (cmd, input) =>
    issue(runtime().db, cmd, parse(uuid, wid), parse(uuid, cycle), input, runtime().credentials, runtime().decisionSecret), 201);
}

export const POST = observeRoute("/api/v1/workspaces/{wid}/cycles/{cycle}/requests", POSTHandler);
