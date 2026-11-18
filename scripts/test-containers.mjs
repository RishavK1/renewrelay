import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import assert from "node:assert/strict";
import { postgresTool } from "./postgres-test-tools.mjs";
const source = new URL(process.env.MIGRATION_DATABASE_URL ?? "");
assert.ok(["127.0.0.1", "localhost"].includes(source.hostname), "Container verification requires local synthetic databases");
const suffix = Date.now();
const database = `renewrelay_audit_container_${suffix}`;
postgresTool("createdb", [database], { env: { ...process.env, PGHOST: source.hostname, PGPORT: source.port || "5432", PGUSER: decodeURIComponent(source.username), PGPASSWORD: decodeURIComponent(source.password), PGDATABASE: source.pathname.slice(1) } });
const temporary = await mkdtemp(join(tmpdir(), "renewrelay-container-"));
const docker = args => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 5 * 1024 * 1024 });
const linux = process.platform === "linux";
const network = linux ? ["--network", "host"] : [];
const runtimeImage = process.env.RR_RUNTIME_IMAGE ?? "renewrelay:review";
const migrationImage = process.env.RR_MIGRATION_IMAGE ?? "renewrelay-migration:review";
const url = key => { const value = new URL(process.env[key]); assert.ok(["127.0.0.1", "localhost"].includes(value.hostname)); value.hostname = linux ? "127.0.0.1" : "host.docker.internal"; value.pathname = "/"+database; return value.toString(); };
const common = { RENEWRELAY_ENV: "local", BETTER_AUTH_URL: "http://127.0.0.1:3567", SMTP_URL: "smtp://host.docker.internal:3548", MAIL_FROM: "renewrelay@example.test", INVITE_ENCRYPTION_KEY: process.env.INVITE_ENCRYPTION_KEY, OUTBOUND_MAIL_ENABLED: "false", WORKSPACE_PURGE_ENABLED: "false", RAZORPAY_BILLING_ENABLED: "false" };
const envFile = async (name, values) => { const path = join(temporary, name); await writeFile(path, Object.entries(values).map(([k,v]) => `${k}=${v}`).join("\n")+"\n", { mode: 0o600 }); return path; };
const web = `renewrelay-web-${suffix}`, worker = `renewrelay-worker-${suffix}`;
const options = ["--read-only", "--tmpfs", "/tmp:rw,noexec,nosuid,size=128m"];
try {
  const migrationEnv = await envFile("migration.env", { RENEWRELAY_ENV: "local", MIGRATION_DATABASE_URL: url("MIGRATION_DATABASE_URL") });
  docker(["run", "--rm", ...network, ...options, "--env-file", migrationEnv, migrationImage]);
  const webEnv = await envFile("web.env", { ...common, DATABASE_URL: url("DATABASE_URL"), AUTH_DATABASE_URL: url("AUTH_DATABASE_URL"), BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET, ...(linux ? { PORT: "3567" } : {}) });
  const workerEnv = await envFile("worker.env", { ...common, WORKER_DATABASE_URL: url("WORKER_DATABASE_URL") });
  docker(["run", "-d", "--name", web, ...network, ...options, ...(linux ? [] : ["-p", "127.0.0.1:3567:3000"]), "--env-file", webEnv, runtimeImage]);
  docker(["run", "-d", "--name", worker, ...network, ...options, "--env-file", workerEnv, runtimeImage, "node", "dist/worker.mjs"]);
  const deadline = Date.now()+60_000;
  let ready = false;
  while (Date.now()<deadline) {
    try { const response = await fetch("http://127.0.0.1:3567/api/v1/health", { signal: AbortSignal.timeout(2000) }); if (response.ok) { ready = true; break; } } catch { /* Startup is polled until the bounded deadline. */ }
    await wait(250);
  }
  assert.ok(ready, "Container web readiness timed out");
  docker(["exec", worker, "node", "dist/healthcheck.mjs", "worker"]);
  assert.equal(docker(["exec", web, "id", "-u"]).trim(), "10001");
  assert.equal(docker(["exec", worker, "id", "-u"]).trim(), "10001");
  console.log(JSON.stringify({ status: "PASS", database, webReady: true, workerHeartbeatHealthy: true, nonRootUid: 10001, readOnlyFilesystem: true, migrationAndGrants: true,
    node: docker(["exec", web, "node", "--version"]).trim(), architecture: docker(["image", "inspect", runtimeImage, "--format", "{{.Architecture}}"]).trim() }));
} finally {
  for (const name of [web, worker]) { try { docker(["rm", "-f", name]); } catch { /* Startup may have failed before this container existed. */ } }
  await rm(temporary, { recursive: true, force: true });
}
