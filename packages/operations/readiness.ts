import type { PrismaClient } from "../db/generated/client";
export const schemaVersion = "202611180016_operations_indexes";

export async function assertReady(db: Pick<PrismaClient, "$queryRaw">) {
  // pg_catalog is readable by restricted roles; also exercise actual runtime table grants.
  const [result] = await db.$queryRaw<{ ready: boolean }[]>`
    SELECT to_regclass('public.auth_security_events') IS NOT NULL
      AND to_regclass('public.api_rate_limits') IS NOT NULL
      AND to_regclass('public.billing_events_operational_pending') IS NOT NULL
      AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='decision_contact_client' AND NOT tgisinternal)
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
        AND table_name='decision_requests' AND column_name='expiryOn') AS ready
  `;
  if (!result?.ready) throw new Error("Application schema is not ready");
  await db.$queryRaw`SELECT id FROM workspaces LIMIT 0`;
}
