import type { PrismaClient } from "../db/generated/client";
export async function inspectWorker(db: Pick<PrismaClient, "$queryRaw">) {
  const rows = await db.$queryRaw<{ age: number; billingAge: number; uncertain: bigint; failed: bigint }[]>`
    WITH due AS (
      (SELECT "runAt" FROM mail_jobs WHERE status IN ('pending','leased') AND "expiresAt" > now() ORDER BY "runAt" LIMIT 1)
      UNION ALL
      (SELECT "runAt" FROM decision_deliveries WHERE status IN ('pending','leased') AND "expiresAt" > now() ORDER BY "runAt" LIMIT 1)
      UNION ALL
      (SELECT "runAt" FROM internal_notifications WHERE status IN ('pending','leased') AND "expiresAt" > now() ORDER BY "runAt" LIMIT 1)
    ), uncertain AS (
      SELECT 1 FROM mail_jobs WHERE status='uncertain' LIMIT 10001
    ), decision_uncertain AS (
      SELECT 1 FROM decision_deliveries WHERE status='uncertain' LIMIT 10001
    ), internal_uncertain AS (
      SELECT 1 FROM internal_notifications WHERE status='uncertain' LIMIT 10001
    ), invitation_failed AS (
      SELECT 1 FROM mail_jobs WHERE status='failed' LIMIT 10001
    ), internal_failed AS (
      SELECT 1 FROM internal_notifications WHERE status='failed' LIMIT 10001
    ), failed AS (
      SELECT 1 FROM decision_deliveries WHERE status='failed' LIMIT 10001
    ) SELECT COALESCE(GREATEST(0, EXTRACT(EPOCH FROM now()-(SELECT min("runAt") FROM due))),0)::float8 AS age,
      COALESCE(GREATEST(0, EXTRACT(EPOCH FROM now()-(SELECT "createdAt" FROM billing_events
        WHERE "processedAt" IS NULL ORDER BY "createdAt" LIMIT 1))),0)::float8 AS "billingAge",
      ((SELECT count(*) FROM uncertain)+(SELECT count(*) FROM decision_uncertain)+(SELECT count(*) FROM internal_uncertain)) AS uncertain,
      ((SELECT count(*) FROM failed)+(SELECT count(*) FROM invitation_failed)+(SELECT count(*) FROM internal_failed)) AS failed
  `;
  const result = rows[0]!;
  return { QueueAgeSeconds: result.age, BillingEventAgeSeconds: result.billingAge,
    UncertainJobs: Number(result.uncertain), FailedJobs: Number(result.failed) };
}
