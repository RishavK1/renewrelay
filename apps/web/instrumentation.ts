export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { runtime } = await import("./server/runtime");
    const { assertReady } = await import("../../packages/operations/readiness");
    const { flushDatabaseMetrics } = await import("../../packages/operations/telemetry");
    await assertReady(runtime().db);
    await runtime().authDb.$queryRaw`SELECT id FROM auth_users LIMIT 0`;
    setInterval(() => flushDatabaseMetrics("web"), 30_000).unref();
  }
}

export async function onRequestError() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logError } = await import("../../packages/operations/telemetry");
    logError("web", "framework", undefined);
  }
}
