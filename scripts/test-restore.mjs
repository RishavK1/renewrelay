import { postgresTool } from "./postgres-test-tools.mjs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { openDatabase } from "../packages/db/database.ts";


const source = new URL(process.env.MIGRATION_DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1"].includes(source.hostname)) {
  throw new Error("The restore drill requires a dedicated local test database.");
}
const database = "renewrelay_restore_" + Date.now();
const temporary = await mkdtemp(join(tmpdir(), "renewrelay-restore-"));
const archive = join(temporary, "database.dump");
const env = {
  ...process.env, PGHOST: source.hostname, PGPORT: source.port || "5432",
  PGUSER: decodeURIComponent(source.username), PGPASSWORD: decodeURIComponent(source.password),
  PGDATABASE: source.pathname.slice(1),
};
const sourceDb = openDatabase(source.toString(), 1);
const restoredUrl = new URL(source);
restoredUrl.pathname = "/" + database;
let restored;
try {
  const expected = {
    cycles: await sourceDb.renewalCycle.count(), responses: await sourceDb.decisionResponse.count(),
    audit: await sourceDb.auditEvent.count(),
  };
  postgresTool("pg_dump", ["--format=custom", "--file", archive], { env, archivePath: archive });
  postgresTool("createdb", [database], { env, archivePath: archive });
  postgresTool("pg_restore", ["--no-owner", "--no-privileges", "--exit-on-error", "--dbname", database, archive], { env, archivePath: archive });
  restored = openDatabase(restoredUrl.toString(), 1);
  assert.deepEqual({
    cycles: await restored.renewalCycle.count(), responses: await restored.decisionResponse.count(),
    audit: await restored.auditEvent.count(),
  }, expected);
  // A restored queue has uncertain external history. Disable its credentials and side effects
  // before granting application roles access or starting a worker.
  await restored.$transaction(async tx => {
    await tx.$executeRaw`UPDATE decision_links SET "revokedAt" = now()`;
    await tx.$executeRaw`UPDATE decision_sessions SET "expiresAt" = now()`;
    await tx.$executeRaw`UPDATE auth_sessions SET "expiresAt" = now()`;
    await tx.$executeRaw`UPDATE decision_deliveries SET status = 'uncertain', ciphertext = NULL, "messageCiphertext" = NULL, "leaseToken" = NULL, "leaseUntil" = NULL WHERE status IN ('pending', 'leased')`;
    await tx.$executeRaw`UPDATE mail_jobs SET status = 'uncertain', ciphertext = NULL, "leaseToken" = NULL, "leaseUntil" = NULL WHERE status IN ('pending', 'leased')`;
    await tx.$executeRaw`UPDATE internal_notifications SET status = 'uncertain', "leaseToken" = NULL, "leaseUntil" = NULL WHERE status IN ('pending', 'leased')`;
  });
  assert.equal(await restored.decisionLink.count({ where: { revokedAt: null } }), 0);
  assert.equal(await restored.decisionDelivery.count({ where: { status: { in: ["pending", "leased"] } } }), 0);
  console.log(JSON.stringify({ restoredDatabase: database, preserved: expected, credentialsRevoked: true, outboundRequiresReconciliation: true }));
} finally {
  await sourceDb.$disconnect();
  if (restored) await restored.$disconnect();
  if (process.env.RR_TEST_PG_CONTAINER) postgresTool("rm", ["-f", archive], { env, archivePath: archive });
  await rm(temporary, { recursive: true });
}
