import { runtime } from "@server/runtime";
import { assertReady } from "@renewrelay/operations/readiness";
import { observeRoute } from "@renewrelay/operations/telemetry";

async function health() {
  try {
    await assertReady(runtime().db);
    return Response.json({ data: { status: "ok" } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: { code: "unavailable" } }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
export const GET = observeRoute("/api/v1/health", health);
