import { observeRoute } from "@renewrelay/operations/telemetry";
import { z } from "zod";
import { timezone, uuid, version } from "@renewrelay/contracts/api";
import { changeTimezone } from "@renewrelay/domain/workspace-timezone";
import { parse, write, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";
const input = z.strictObject({ timezone, expectedVersion: version, previewToken: z.string().regex(/^[a-f0-9]{64}$/), confirm: z.literal(true) });
async function POSTHandler(request: Request, { params }: RouteParams<"wid">) {
  const { wid } = await params;
  return write(request, "workspace.timezone.change", input, (cmd, input) => changeTimezone(runtime().db, cmd, parse(uuid, wid), input));
}

export const POST = observeRoute("/api/v1/workspaces/{wid}/timezone", POSTHandler);
