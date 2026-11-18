import { decisionAccess } from "@renewrelay/contracts/decisions";
import { preview } from "@renewrelay/domain/decisions/service";
import { publicCommand } from "@server/http";
import { runtime } from "@server/runtime";

export function POST(request: Request) {
  return publicCommand(request, decisionAccess, (input) => preview(runtime().db, input.token));
}
