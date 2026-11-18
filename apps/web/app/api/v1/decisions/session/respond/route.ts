import { z } from "zod";
import { respond } from "@renewrelay/domain/decisions/service";
import { publicCommand } from "@server/http";
import { decisionSession } from "@server/decision-session";
import { runtime } from "@server/runtime";

export function POST(request: Request) {
  return publicCommand(request, z.strictObject({ code: z.string().regex(/^\d{6}$/).optional(), expectedVersion: z.number().int().min(1), choice: z.enum(["approve", "cancel", "question"]), question: z.string().trim().min(1).max(1000).optional() }).refine(v => (v.choice === "question") === !!v.question), async (input, key) => {
    const session = await decisionSession(request, true);
    return respond(runtime().db, session.token, runtime().decisionSecret, key, input, session.sessionId);
  });
}
