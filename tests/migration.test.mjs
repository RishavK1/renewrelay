import test from "node:test";
import assert from "node:assert/strict";
import { migrationEnvironment } from "../packages/operations/migration-environment.mjs";
test("migration preserves strict certificate checks in both PostgreSQL toolchains", () => {
  const result = migrationEnvironment({ RENEWRELAY_ENV: "staging", PGHOST: "db.example.test", PGPASSWORD: "synthetic" });
  const prisma = new URL(result.MIGRATION_DATABASE_URL);
  assert.equal(prisma.searchParams.get("sslmode"), "require");
  assert.equal(prisma.searchParams.get("sslaccept"), "strict");
  assert.equal(prisma.searchParams.get("sslcert"), "/app/certs/rds-global-bundle.pem");
  assert.equal(result.PGSSLMODE, "verify-full");
  assert.equal(result.PGSSLROOTCERT, "/app/certs/rds-global-bundle.pem");
});
test("migration rejects unverified deployed URLs and runtime principals", () => {
  assert.throws(() => migrationEnvironment({ RENEWRELAY_ENV: "production", MIGRATION_DATABASE_URL: "postgresql://renewrelay_migrator:synthetic@db.example.test/renewrelay?sslmode=require" }));
  assert.throws(() => migrationEnvironment({ RENEWRELAY_ENV: "local", MIGRATION_DATABASE_URL: "postgresql://renewrelay_app:synthetic@localhost/renewrelay" }));
});
