import { cp, mkdir, copyFile, rm, writeFile } from "node:fs/promises";
await rm("release", { recursive: true, force: true });
await mkdir("release/dist", { recursive: true });
await cp("apps/web/.next/standalone", "release", { recursive: true });
await cp("apps/web/.next/static", "release/apps/web/.next/static", { recursive: true });
await copyFile("dist/worker.mjs", "release/dist/worker.mjs");
await copyFile("dist/web.mjs", "release/dist/web.mjs");
await copyFile("scripts/healthcheck.mjs", "release/dist/healthcheck.mjs");
// Worker-only dependencies may not be traced by Next. Install the locked production set.
await copyFile("package.json", "release/package.json");
await copyFile("package-lock.json", "release/package-lock.json");
await writeFile("release/apps/web/package.json", JSON.stringify({ type: "commonjs" }) + "\n");
await copyFile("THIRD_PARTY_NOTICES.txt", "release/THIRD_PARTY_NOTICES.txt");
console.log("Release staged. Production dependencies are overlaid separately to preserve standalone aliases.");
