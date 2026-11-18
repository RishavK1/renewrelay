import { respondDecision } from "@renewrelay/contracts/decisions";
import { respond } from "@renewrelay/domain/decisions/service";
import { publicCommand } from "@server/http";
import { runtime } from "@server/runtime";

export function POST(request: Request) {
  return publicCommand(request, respondDecision, (input, key) => respond(runtime().db, input.token, runtime().decisionSecret, key, input));
}
