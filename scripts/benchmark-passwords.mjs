import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import { hashPassword, verifyPassword } from "../packages/domain/passwords.ts";
const milliseconds = [];
for (let attempt = 0; attempt < 5; attempt++) {
  const before = performance.now();
  const hash = await hashPassword("Synthetic-Benchmark-Only-91!");
  if (!(await verifyPassword({ hash, password: "Synthetic-Benchmark-Only-91!" }))) throw new Error("Password verification failed");
  milliseconds.push(performance.now() - before);
}
const result = { checkedAt: new Date().toISOString(), node: process.version, platform: process.platform, architecture: process.arch,
  algorithm: "scrypt", format: "rr-scrypt-v1", cost: { N: 32768, r: 8, p: 3, bytes: 64, maxMemoryBytes: 67108864 },
  sampleCount: milliseconds.length, operation: "hash plus successful verification", samplesMs: milliseconds.map(value => Math.round(value)),
  legacyVerificationSupported: true, legacyMigration: "Compare-and-set rehash after successful password sign-in", scope: "Local compatibility/cost evidence, not a production concurrency benchmark" };
await writeFile(process.env.PASSWORD_BENCHMARK_OUTPUT ?? "docs/audit/password-cost-batch4-2026-11-18.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
