import { observeRoute } from "@renewrelay/operations/telemetry";
import { uuid } from "@renewrelay/contracts/api";
import { emptyBillingCommand } from "@renewrelay/contracts/billing";
import { catchUpDigest } from "@renewrelay/domain/billing/service";
import { parse, write, type RouteParams } from "@server/http";
import { runtime } from "@server/runtime";

async function POSTHandler(request: Request, { params }: RouteParams<"wid">) {
  const { wid } = await params;
  return write(request, "billing.catchup", emptyBillingCommand, cmd => catchUpDigest(runtime().db, cmd, parse(uuid, wid)));
}

export const POST = observeRoute("/api/v1/workspaces/{wid}/billing/catch-up", POSTHandler);
