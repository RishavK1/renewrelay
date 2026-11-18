import { execFileSync } from "node:child_process";
import { postgresTool } from "./postgres-test-tools.mjs";
import { mkdtemp, cp, mkdir, writeFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const source = new URL(process.env.MIGRATION_DATABASE_URL ?? "");
assert.ok(["127.0.0.1", "localhost"].includes(source.hostname), "Migration rehearsal requires an isolated local database server");
const name = "renewrelay_audit_upgrade_" + Date.now();
const target = new URL(source); target.pathname = "/" + name;
const env = { ...process.env, PGHOST: source.hostname, PGPORT: source.port || "5432", PGUSER: decodeURIComponent(source.username), PGPASSWORD: decodeURIComponent(source.password), PGDATABASE: source.pathname.slice(1), MIGRATION_DATABASE_URL: target.toString() };
const run = (command, args, extra = {}) => ["psql", "createdb"].includes(command) ? postgresTool(command, args, { env: extra.env ?? env }) : execFileSync(command, args, { env, stdio: ["ignore", "pipe", "pipe"], ...extra }).toString();
run("createdb", [name]);
const dir = await mkdtemp(join(tmpdir(), "renewrelay-upgrade-"));
try {
  await mkdir(join(dir, "migrations"));
  const migrations = (await readdir("packages/db/prisma/migrations")).filter(p => /^\d/.test(p)).sort();
  for (const migration of migrations.slice(0, 15)) await cp(`packages/db/prisma/migrations/${migration}`, join(dir, "migrations", migration), { recursive: true });
  await cp("packages/db/prisma/migrations/migration_lock.toml", join(dir, "migrations", "migration_lock.toml"));
  const config = join(dir, "prisma.config.ts");
  await writeFile(config, `import { defineConfig } from ${JSON.stringify(pathToFileURL(resolve("node_modules/prisma/config.js")).href)}; export default defineConfig({ schema: ${JSON.stringify(resolve("packages/db/prisma/schema.prisma"))}, migrations: {path: ${JSON.stringify(join(dir,"migrations"))}}, datasource: {url: process.env.MIGRATION_DATABASE_URL} });`);
  run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--config", config]);
  const sqlEnv = { ...env, PGDATABASE: name };
  // A pre-upgrade business record proves data preservation, not only an empty migration.
  run("psql", ["-v", "ON_ERROR_STOP=1", "-c", "INSERT INTO workspaces(id,name,timezone,version,\"createdAt\",\"updatedAt\") VALUES ('00000000-0000-4000-a000-000000000005','Upgrade fixture','Asia/Kolkata',1,now(),now())"], { env: sqlEnv });
  run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  const count = run("psql", ["-At", "-c", "SELECT count(*) FROM workspaces WHERE name='Upgrade fixture'"], { env: sqlEnv }).trim();
  assert.equal(count, "1");
  run("psql", ["-v", "ON_ERROR_STOP=1", "-f", "packages/db/grant-runtime.sql"], { env: sqlEnv });
  console.log(JSON.stringify({ status: "PASS", database: name, fromMigrations: 15, toMigrations: migrations.length, preservedWorkspaces: 1 }));
} finally { await rm(dir, { recursive: true, force: true }); }
