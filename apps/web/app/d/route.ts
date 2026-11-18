import { observeRoute } from "@renewrelay/operations/telemetry";
import { decisionSession } from "@server/decision-session";
import { preview } from "@renewrelay/domain/decisions/service";
import { runtime } from "@server/runtime";

async function GETHandler(request: Request) {
  try {
    const session = await decisionSession(request, false);
    const data = await preview(runtime().db, session.token);
    if (data.decided) throw new Error("Completed decision");
    return Response.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: { code: "decision_unavailable" } }, { status: 410, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = observeRoute("/d", GETHandler);
