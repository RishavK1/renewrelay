import { execFileSync } from "node:child_process";
import { mkdtemp, copyFile, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
// npm ci removes node_modules. Install separately so Next's traced aliases survive.
const temporary = await mkdtemp(join(tmpdir(), "renewrelay-production-deps-"));
try {
  await copyFile("package.json", join(temporary, "package.json"));
  await copyFile("package-lock.json", join(temporary, "package-lock.json"));
  execFileSync("npm", ["ci", "--omit=dev", "--omit=peer", "--ignore-scripts"], { cwd: temporary, stdio: "inherit" });
  await cp(join(temporary, "node_modules"), "release/node_modules", { recursive: true, force: true });
} finally { await rm(temporary, { recursive: true, force: true }); }
