import { readdir, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const ignored = new Set(["node_modules", ".next", "generated", ".git", "release", "dist"]);
async function files(dir) {
  return (await Promise.all((await readdir(dir, { withFileTypes: true })).filter(e => !ignored.has(e.name) && (!e.name.startsWith(".env") || e.name === ".env.example")).map(async e => e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`]))).flat();
}
const patterns = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\bAKIA[0-9A-Z]{16}\b/, /\brzp_live_[A-Za-z0-9]{14,}\b/, /\bre_[A-Za-z0-9]{24,}\b/, /\bgh[pousr]_[A-Za-z0-9]{30,}\b/];
const scan = text => patterns.some(p => p.test(text));
let failures = 0;
for (const path of await files(".")) {
  if (scan(await readFile(path, "utf8"))) { console.error(`Potential credential pattern in ${path}; value withheld.`); failures++; }
}
let commits = [];
try { commits = execFileSync("git", ["rev-list", "--all"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").filter(Boolean); } catch { /* Repository history not yet available. */ }
for (const commit of commits) {
  const paths = execFileSync("git", ["ls-tree", "-r", "--name-only", commit], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  for (const path of paths) if (scan(execFileSync("git", ["show", `${commit}:${path}`], { maxBuffer: 20 * 1024 * 1024 }).toString())) { console.error(`Potential credential in history ${commit.slice(0,12)}:${path}; value withheld.`); failures++; }
}
console.log(JSON.stringify({ currentSourceScanned: true, historyCommitsScanned: commits.length, matchedFiles: failures, limitation: "Targeted credential-pattern scan, not exhaustive secret detection." }));
if (failures) process.exitCode = 1;
