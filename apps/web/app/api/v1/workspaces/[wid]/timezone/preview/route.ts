import { observeRoute } from "@renewrelay/operations/telemetry";
import { z } from "zod";
import { timezone, uuid } from "@renewrelay/contracts/api";
import { previewTimezone } from "@renewrelay/domain/workspace-timezone";
import { parse, write, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";
async function POSTHandler(request: Request, { params }: RouteParams<"wid">) {
  const { wid } = await params;
  return write(request, "workspace.timezone.preview", z.strictObject({ timezone }), (cmd, input) => previewTimezone(runtime().db, cmd.actor, parse(uuid, wid), input.timezone));
}

export const POST = observeRoute("/api/v1/workspaces/{wid}/timezone/preview", POSTHandler);
