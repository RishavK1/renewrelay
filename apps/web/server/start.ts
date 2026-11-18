import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { webConfig } from "../../../packages/contracts/environment";
import { openDatabase } from "../../../packages/db/database";
import { assertReady } from "../../../packages/operations/readiness";
import { logError } from "../../../packages/operations/telemetry";

try {
  const config = webConfig();
  const db = openDatabase(config.DATABASE_URL, 1);
  const auth = openDatabase(config.AUTH_DATABASE_URL, 1);
  try {
    await assertReady(db);
    await auth.$queryRaw`SELECT id FROM auth_users LIMIT 0`;
  } finally { await db.$disconnect(); await auth.$disconnect(); }
} catch (error) {
  logError("web", "startup", error);
  process.exit(1);
}
// Import only after preflight succeeds; use the packaged server's CommonJS boundary.
const server = pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), "../apps/web/server.js")).href;
await import(server);
