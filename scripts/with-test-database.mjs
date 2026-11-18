import { execFileSync } from "node:child_process";
import { postgresTool } from "./postgres-test-tools.mjs";
const mode = process.argv[2];
if (!["audit", "load"].includes(mode)) throw new Error("Choose audit or load");
const source = new URL(process.env.MIGRATION_DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1"].includes(source.hostname)) throw new Error("Use an isolated local test server");
const database = `renewrelay_audit_${mode}_${Date.now()}`;
const env = { ...process.env, PGHOST: source.hostname, PGPORT: source.port || "5432", PGUSER: decodeURIComponent(source.username), PGPASSWORD: decodeURIComponent(source.password), PGDATABASE: source.pathname.slice(1) };
postgresTool("createdb", [database], { env });
for (const name of ["MIGRATION_DATABASE_URL", "DATABASE_URL", "AUTH_DATABASE_URL", "WORKER_DATABASE_URL"]) {
  const url = new URL(env[name]);
  if (url.hostname !== source.hostname || url.port !== source.port) throw new Error("All fixture connections must use the same local server");
  url.pathname = "/" + database; env[name] = url.toString();
}
env.PGDATABASE = database;
execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env, stdio: "inherit" });
postgresTool("psql", ["-v", "ON_ERROR_STOP=1", "-f", "packages/db/grant-runtime.sql"], { env });
console.log(`Isolated ${mode} database: ${database}`);
execFileSync(process.execPath, ["--import", "tsx", mode === "audit" ? "scripts/audit-synthetic.mjs" : "scripts/test-dispatch-load.mjs"], { env, stdio: "inherit" });
