import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { resolveDecisionQuestion } from "@renewrelay/contracts/decisions";
import { resolveQuestion } from "@renewrelay/domain/decisions/questions";
import { parse, write, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";

async function POSTHandler(request: Request, { params }: RouteParams<"wid" | "cycle" | "response">) {
  const { wid, cycle, response } = await params;
  return write(request, "decision.question.resolve", resolveDecisionQuestion, (cmd, input) =>
    resolveQuestion(runtime().db, cmd, parse(uuid, wid), parse(uuid, cycle), parse(uuid, response), input));
}

export const POST = observeRoute("/api/v1/workspaces/{wid}/cycles/{cycle}/responses/{response}/resolve", POSTHandler);
