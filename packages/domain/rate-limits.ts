import { createHmac } from "node:crypto";
import type { PrismaClient } from "../db/generated/client";
import { DomainError } from "./errors";

export async function consumeRate(db: Pick<PrismaClient, "$queryRaw">, secret: string, principal: string,
  limit: number, windowMs = 60_000, now = new Date()) {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowMs) || windowMs < 1) throw new RangeError("Use positive rate limits and windows.");
  const window = Math.floor(now.getTime() / windowMs);
  const key = createHmac("sha256", secret).update(JSON.stringify([principal, window])).digest("hex");
  const expiresAt = new Date((window + 1) * windowMs);
  const [row] = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO api_rate_limits (key, count, "expiresAt") VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT (key) DO UPDATE SET count = LEAST(api_rate_limits.count + 1, ${limit + 1}) RETURNING count
  `;
  if (!row || row.count > limit) throw new DomainError(429, "rate_limited", "Wait before retrying this operation.", undefined, Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000)));
}
