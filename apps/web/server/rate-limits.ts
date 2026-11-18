import { isIP } from "node:net";
import { consumeRate } from "../../../packages/domain/rate-limits";
import { setActor } from "../../../packages/db/database";
import type { Actor } from "../../../packages/domain/context";
import { runtime } from "./runtime";

export async function limitRequest(request: Request, kind: "auth" | "public" | "read" | "write" | "import", actor?: Actor) {
  const current = runtime();
  const header = current.trustedIpHeader && request.headers.get(current.trustedIpHeader);
  const ip = header && isIP(header) ? header : "unidentified";
  const path = new URL(request.url).pathname;
  const expensive = path.includes("/exports/") || path.includes("/imports/") || kind === "import";
  const family = expensive ? (kind === "import" || path.includes("/imports/") ? "import" : "export") : kind;
  await consumeRate(current.db, current.decisionSecret, `ip/${family}/${ip}`, kind === "auth" ? 60 : kind === "public" ? 120 : 3000);
  if (!actor) return;
  await consumeRate(current.db, current.decisionSecret, `actor/${family}/${actor.id}`, expensive ? 60 : kind === "read" ? 1500 : 600);
  const wid = path.match(/\/workspaces\/([a-f0-9-]{36})(?:\/|$)/i)?.[1];
  if (!wid) return;
  const member = await current.db.$transaction(async tx => {
    await setActor(tx, actor.id);
    return tx.membership.findUnique({ where: { workspaceId_userId: { workspaceId: wid, userId: actor.id } } });
  });
  if (member && !member.removedAt) {
    await consumeRate(current.db, current.decisionSecret, `tenant/${family}/${wid}`, expensive ? 120 : kind === "read" ? 3000 : 1200);
  }
}
