import { createWorkspace as inputSchema } from "@renewrelay/contracts/api";
import { createWorkspace, listWorkspaces } from "@renewrelay/domain/workspaces";
import { pagination, read, write } from "@server/http";
import { runtime } from "@server/runtime";


export function GET(request: Request) {
  return read(request, (actor) => listWorkspaces(runtime().db, actor, pagination(request)));
}

export function POST(request: Request) {
  return write(request, "workspace.create", inputSchema, (cmd, input) =>
    createWorkspace(runtime().db, cmd, input), 201);
}
