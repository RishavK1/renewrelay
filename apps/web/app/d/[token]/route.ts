import { observeRoute } from "@renewrelay/operations/telemetry";
import { limitRequest } from "@server/rate-limits";
import { exchange, decisionCookie } from "@server/decision-session";
import { DomainError } from "@renewrelay/domain/errors";
import { runtime } from "@server/runtime";

async function GETHandler(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    await limitRequest(request, "public");
    const { token } = await params;
    if (!/^[\w-]{43}$/.test(token)) return new Response("Decision unavailable", { status: 404 });
    const session = await exchange(token);
    return new Response(null, { status: 303, headers: {
      Location: `${runtime().origin}/d#${session.csrf}`,
      "Set-Cookie": decisionCookie(session.sessionToken),
      "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
    } });
  } catch (error) {
    return new Response("Decision unavailable", { status: error instanceof DomainError ? error.status : 500,
      headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  }
}

export const GET = observeRoute("/d/{token}", GETHandler);
