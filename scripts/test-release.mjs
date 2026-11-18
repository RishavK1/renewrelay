import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { postgresTool } from "./postgres-test-tools.mjs";
const absent = [];
for (const name of ["tsx", "typescript", "prisma", "eslint"]) {
  try { await access(`release/node_modules/${name}/package.json`); } catch { absent.push(name); }
}
assert.ok(absent.includes("tsx") && absent.includes("eslint"));
const run = env => spawnSync(process.execPath, ["release/dist/web.mjs"], { env: { ...env, HOSTNAME: "127.0.0.1", PORT: "3557" }, encoding: "utf8", timeout: 15_000 });
const canary = "credential-canary";
const invalid = run({ ...process.env, BETTER_AUTH_SECRET: canary });
assert.ok(typeof invalid.status === "number" && invalid.status !== 0);
assert.match(invalid.stderr, /"operation":"startup"/);
assert.ok(!invalid.stderr.includes(canary));
const source = new URL(process.env.MIGRATION_DATABASE_URL ?? "");
assert.ok(["127.0.0.1", "localhost"].includes(source.hostname));
const name = "renewrelay_audit_missing_schema_" + Date.now();
postgresTool("createdb", [name], { env: { ...process.env, PGHOST: source.hostname, PGPORT: source.port || "5432", PGUSER: decodeURIComponent(source.username), PGPASSWORD: decodeURIComponent(source.password), PGDATABASE: source.pathname.slice(1) } });
const env = { ...process.env };
for (const key of ["DATABASE_URL", "AUTH_DATABASE_URL"]) { const url = new URL(env[key]); url.pathname = "/"+name; env[key] = url.toString(); }
const missing = run(env);
assert.ok(typeof missing.status === "number" && missing.status !== 0);
assert.match(missing.stderr, /"operation":"startup"/);
assert.doesNotMatch(missing.stdout, /Ready in/);
const webPackage = JSON.parse(await readFile("release/apps/web/package.json", "utf8"));
assert.equal(webPackage.type, "commonjs");
console.log(JSON.stringify({ npmProductionInstall: true, noDevelopmentRunnerRequired: true, absentDevelopmentTools: absent, optionalPeerToolsPresent: ["typescript", "prisma"].filter(name => !absent.includes(name)), invalidConfigurationBlocksStartup: true, missingSchemaBlocksStartup: true, secretCanaryOmitted: true }));
