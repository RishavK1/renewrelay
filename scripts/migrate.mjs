import { execFileSync } from "node:child_process";
const local = process.env.RENEWRELAY_ENV === "local";
const url = process.env.MIGRATION_DATABASE_URL ? new URL(process.env.MIGRATION_DATABASE_URL) : new URL("postgresql://localhost/renewrelay");
if (!process.env.MIGRATION_DATABASE_URL) {
  if (!process.env.PGHOST || !process.env.PGPASSWORD) throw new Error("Migration database credentials are required");
  url.hostname = process.env.PGHOST;
  url.port = process.env.PGPORT ?? "5432";
  url.username = process.env.PGUSER ?? "renewrelay_migrator";
  url.password = process.env.PGPASSWORD;
  url.pathname = "/" + (process.env.PGDATABASE ?? "renewrelay");
  url.searchParams.set("sslmode", local ? "disable" : "verify-full");
}
if (decodeURIComponent(url.username) !== "renewrelay_migrator") throw new Error("Use the migration role only");
if (!local && url.searchParams.get("sslmode") !== "verify-full") throw new Error("Migration requires verified database TLS");
const env = { ...process.env, MIGRATION_DATABASE_URL: url.toString(), PGHOST: url.hostname, PGPORT: url.port || "5432",
  PGDATABASE: url.pathname.slice(1), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
  PGSSLMODE: local ? "disable" : "verify-full", ...(!local ? { PGSSLROOTCERT: "/app/certs/rds-global-bundle.pem", NODE_EXTRA_CA_CERTS: "/app/certs/rds-global-bundle.pem" } : {}) };
execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env, stdio: "inherit" });
execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-f", "packages/db/grant-runtime.sql"], { env, stdio: "inherit" });
