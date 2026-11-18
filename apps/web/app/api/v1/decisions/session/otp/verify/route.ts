import { z } from "zod";
import { verifyOtp } from "@renewrelay/domain/decisions/service";
import { decisionSession } from "@server/decision-session";
import { publicCommand } from "@server/http";
import { runtime } from "@server/runtime";

export function POST(request: Request) {
  return publicCommand(request, z.strictObject({ code: z.string().regex(/^\d{6}$/) }), async input => {
    const session = await decisionSession(request, true);
    return verifyOtp(runtime().db, session.token, runtime().decisionSecret, input.code, session.sessionId);
  });
}
