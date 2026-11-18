import { execFileSync } from "node:child_process";
import { migrationEnvironment } from "../packages/operations/migration-environment.mjs";
const env = migrationEnvironment(process.env);
execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env, stdio: "inherit" });
execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-f", "packages/db/grant-runtime.sql"], { env, stdio: "inherit" });
