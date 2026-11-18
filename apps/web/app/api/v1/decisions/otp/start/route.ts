import { decisionAccess } from "@renewrelay/contracts/decisions";
import { startOtp } from "@renewrelay/domain/decisions/service";
import { publicCommand } from "@server/http";
import { runtime } from "@server/runtime";

export function POST(request: Request) {
  return publicCommand(request, decisionAccess, (input) => startOtp(runtime().db, input.token, runtime().decisionSecret, (to, code) => runtime().sendMail({ to, subject: "Your RenewRelay verification code", text: code })));
}
