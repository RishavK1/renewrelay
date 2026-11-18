import { readFile, writeFile, readdir } from "node:fs/promises";
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const inventory = [];
const notices = ["RenewRelay production dependency notices\nGenerated from the locked production dependency inventory.\nThis inventory does not replace review of distribution obligations.\n"];
for (const [path, info] of Object.entries(lock.packages)) {
  if (!path || info.dev || info.peer) continue;
  const name = info.name ?? path.split("node_modules/").at(-1);
  const licenseFiles = [];
  try {
    for (const filename of await readdir(path)) if (/^(license|licence|copying|notice)(\.|$)/i.test(filename)) {
      try { const body = await readFile(`${path}/${filename}`, "utf8"); notices.push(`\n--- ${name}@${info.version}: ${filename} ---\n${body}`); licenseFiles.push(filename); } catch { /* A directory with this name is not a notice file. */ }
    }
  } catch { /* Platform-specific optional dependency is absent on this host. */ }
  inventory.push({ name, version: info.version, license: info.license ?? "REVIEW_REQUIRED", path, optional: !!info.optional, licenseFiles,
    reviewRequired: !/^(MIT|ISC|Apache-2.0|BSD-2-Clause|BSD-3-Clause|0BSD|BlueOak-1.0.0|CC0-1.0|Unlicense)$/.test(info.license ?? "") });
}
await writeFile("docs/audit/dependency-licenses-batch5-2026-11-18.json", JSON.stringify({ scope: "Locked production dependency inventory; optional packages include other platforms", packages: inventory, reviewRequired: inventory.filter(p => p.reviewRequired).map(p => `${p.name}@${p.version}`), limitation: "Qualified distribution/license review and target-platform notices remain release obligations." }, null, 2)+"\n");
await writeFile("docs/THIRD_PARTY_NOTICES.txt", notices.join("\n"));
console.log(`Production license inventory: ${inventory.length} packages; ${inventory.filter(p => p.reviewRequired).length} require review.`);
