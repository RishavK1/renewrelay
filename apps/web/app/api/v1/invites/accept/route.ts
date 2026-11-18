import { acceptInvitation } from "@renewrelay/contracts/api";
import { consumeInvitation } from "@renewrelay/domain/workspaces";
import { write } from "@server/http";
import { runtime } from "@server/runtime";


export function POST(request: Request) {
  return write(request, "invitation.accept", acceptInvitation, (cmd, { token }) =>
    consumeInvitation(runtime().db, cmd, token));
}
