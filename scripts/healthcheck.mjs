import { readFile } from "node:fs/promises";
if (process.argv[2] === "worker") {
  const timestamp = Number(await readFile(process.env.WORKER_HEARTBEAT_FILE ?? "/tmp/renewrelay-worker-heartbeat", "utf8"));
  if (!Number.isFinite(timestamp) || timestamp > Date.now() || Date.now() - timestamp > 120_000) process.exitCode = 1;
} else {
  const result = await fetch(`http://127.0.0.1:${process.env.PORT ?? 3000}/api/v1/health`, { signal: AbortSignal.timeout(5000) });
  if (!result.ok) process.exitCode = 1;
}
