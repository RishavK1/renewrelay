import { z } from "zod";
import { startOtp } from "@renewrelay/domain/decisions/service";
import { publicCommand } from "@server/http";
import { decisionSession } from "@server/decision-session";
import { runtime } from "@server/runtime";

export function POST(request: Request) {
  return publicCommand(request, z.strictObject({}), async () => {
    const session = await decisionSession(request, true);
    return startOtp(runtime().db, session.token, runtime().decisionSecret, (to, code) => runtime().sendMail({ to, subject: "Your RenewRelay verification code", text: code }), session.sessionId);
  });
}
