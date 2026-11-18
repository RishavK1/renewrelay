import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

const context = new AsyncLocalStorage<{ requestId: string }>();
export const requestId = () => context.getStore()?.requestId ?? randomUUID();
type Service = "web" | "worker";
type Metric = "Requests" | "ServerErrors" | "LatencyMs" | "DatabaseQueries" | "DatabaseLatencyMs" |
  "WorkerHeartbeat" | "WorkerErrors" | "QueueAgeSeconds" | "BillingEventAgeSeconds" | "UncertainJobs" | "FailedJobs";
const environment = () => ["local", "staging", "production"].includes(process.env.RENEWRELAY_ENV ?? "") ? process.env.RENEWRELAY_ENV! : "local";

// Deliberately excludes messages, stacks, URLs, headers, bodies, principals and SQL.
export function logError(service: Service, operation: string, error: unknown) {
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" && /^P\d{4}$/.test(error.code)
    ? error.code : "unexpected_error";
  console.error(JSON.stringify({ level: "error", event: "operation_failed", service, environment: environment(),
    operation, code, requestId: context.getStore()?.requestId }));
}

export function metric(service: Service, values: Partial<Record<Metric, number>>) {
  const metrics = Object.entries(values).filter(([, value]) => Number.isFinite(value) && value! >= 0);
  console.log(JSON.stringify({ _aws: { Timestamp: Date.now(), CloudWatchMetrics: [{ Namespace: "RenewRelay",
    Dimensions: [["service", "environment"]], Metrics: metrics.map(([Name]) => ({ Name,
      Unit: Name.endsWith("Ms") ? "Milliseconds" : Name.endsWith("Seconds") ? "Seconds" : "Count" })) }] },
    service, environment: environment(), ...Object.fromEntries(metrics) }));
}

export function observeRoute<Args extends unknown[]>(route: string, handler: (...args: Args) => Promise<Response>) {
  return (...args: Args): Promise<Response> => context.run({ requestId: randomUUID() }, async () => {
    const started = performance.now();
    let status = 500;
    try {
      const response = await handler(...args);
      status = response.status;
      response.headers.set("X-Request-Id", requestId());
      return response;
    } catch (error) {
      logError("web", route, error);
      return Response.json({ error: { code: "internal_error", message: "The request could not be completed.", requestId: requestId() } },
        { status: 500, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId() } });
    } finally {
      const durationMs = Math.round(performance.now() - started);
      console.log(JSON.stringify({ level: "info", event: "request_completed", service: "web", environment: environment(),
        route, status, durationMs, requestId: requestId() }));
      metric("web", { Requests: 1, ServerErrors: status >= 500 ? 1 : 0, LatencyMs: durationMs });
    }
  });
}

let queries = 0;
let queryMs = 0;
export function databaseQuery(durationMs: number) { queries++; queryMs += durationMs; }
export function flushDatabaseMetrics(service: Service) {
  if (queries) metric(service, { DatabaseQueries: queries, DatabaseLatencyMs: queryMs / queries });
  queries = 0; queryMs = 0;
}
