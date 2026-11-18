import test from "node:test";
import assert from "node:assert/strict";
import { metric, observeRoute, logError, databaseQuery, flushDatabaseMetrics } from "../packages/operations/telemetry";
import { assertReady } from "../packages/operations/readiness";

test("telemetry strips secrets and raw URLs, correlates failures, and bounds metric dimensions", async () => {
  const lines: string[] = [];
  const stdout = console.log, stderr = console.error;
  console.log = (...args: unknown[]) => lines.push(args.join(" "));
  console.error = (...args: unknown[]) => lines.push(args.join(" "));
  try {
    const handler = observeRoute("/d/{token}", async (_request: Request) => {
      logError("web", "decision", new Error("secret-token password person@example.test"));
      return new Response(null, { status: 503 });
    });
    const response = await handler(new Request("https://example.test/d/secret-token?password=secret", { headers: { Cookie: "secret-cookie" } }));
    assert.ok(response.headers.get("x-request-id"));
    databaseQuery(12); databaseQuery(8); flushDatabaseMetrics("web");
    metric("worker", { WorkerHeartbeat: 1, QueueAgeSeconds: 301 });
    const failed = await observeRoute("/safe", async () => { throw new Error("secret-token person@example.test"); })();
    assert.equal(failed.status, 500);
    assert.equal((await failed.json()).error.code, "internal_error");
    assert.doesNotMatch(lines.join("\n"), /secret-token|secret-cookie|person@example|password/);
    const events = lines.map(line => JSON.parse(line));
    const completed = events.find(e => e.event === "request_completed");
    assert.equal(completed.status, 503);
    assert.equal(completed.requestId, response.headers.get("x-request-id"));
    assert.equal(events.find(e => e.DatabaseLatencyMs !== undefined).DatabaseLatencyMs, 10);
    for (const event of events.filter(e => e._aws)) assert.deepEqual(event._aws.CloudWatchMetrics[0].Dimensions, [["service", "environment"]]);
    assert.equal(events.find(e => e.Requests).ServerErrors, 1);
  } finally { console.log = stdout; console.error = stderr; }
});

test("readiness rejects a missing application schema and permission failures", async () => {
  const missing = { $queryRaw: async () => [{ ready: false }] };
  await assert.rejects(() => assertReady(missing as unknown as Parameters<typeof assertReady>[0]));
  const unavailable = { $queryRaw: async () => { throw new Error("unavailable"); } };
  await assert.rejects(() => assertReady(unavailable as unknown as Parameters<typeof assertReady>[0]));
});

test("deployment alarms cover queue age, billing backlog, missing heartbeat and errors", async () => {
  const { readFile } = await import("node:fs/promises");
  const template = JSON.parse(await readFile("infra/aws/backend.template.json", "utf8"));
  const alarm = (name: string) => template.Resources[name].Properties;
  assert.equal(alarm("QueueAgeAlarm").Threshold, 300);
  assert.equal(alarm("QueueAgeAlarm").EvaluationPeriods, 2);
  assert.equal(alarm("BillingAgeAlarm").Threshold, 900);
  assert.equal(alarm("HeartbeatAlarm").TreatMissingData, "breaching");
  assert.equal(alarm("ApiErrorsAlarm").MetricName, "ServerErrors");
  assert.equal(alarm("CentralizedErrorAlarm").MetricName, "CentralizedErrors");
  for (const value of Object.values(template.Resources) as { Type: string; Properties: Record<string, unknown> }[]) {
    if (value.Type === "AWS::CloudWatch::Alarm") assert.ok(value.Properties.AlarmActions);
  }
  assert.equal(template.Resources.Database.Properties.PubliclyAccessible, false);
  assert.equal(template.Resources.Database.Properties.StorageEncrypted, true);
  assert.equal(template.Resources.Database.Properties.DeletionProtection, true);
  assert.deepEqual(template.Resources.WorkerService.Properties.DesiredCount, { "Fn::If": ["StartApplication", 1, 0] });
});
