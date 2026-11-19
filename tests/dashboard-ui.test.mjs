import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import { after } from "node:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Compile the actual components with the same automatic JSX runtime as Next.
// This is static server rendering; no browser, database or API is involved.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
await mkdir(join(root, ".next"), { recursive: true });
const directory = await mkdtemp(join(root, ".next", "ui-unit-"));
after(() => rm(directory, { recursive: true, force: true }));
const output = join(directory, "views.mjs");
await build({ stdin: { contents: `
  export { isUnconfirmedResult, requiresDecisionReopen } from "./packages/ui/decisions/action-policy";
  export { RenewalDetails } from "./packages/ui/renewals/renewal-views";
  export { RenewalsFirstState } from "./packages/ui/dashboard/renewals-first-state";
  export { sampleRenewals } from "./apps/marketing/components/renewals/renewal-fixtures";
`, resolveDir: root }, outfile: output, bundle: true, packages: "external", platform: "node", format: "esm", jsx: "automatic", logLevel: "silent" });
const { isUnconfirmedResult, requiresDecisionReopen, RenewalDetails, RenewalsFirstState, sampleRenewals } = await import(pathToFileURL(output).href);

const clientId = "10000000-0000-4000-8000-000000000001";
function detail(record, props = {}) {
  return renderToStaticMarkup(createElement(RenewalDetails, { record, clientName: "Sample client", operatorName: "Sample operator", canWrite: true, ...props }));
}

test("unknown-result policy retains returned connection errors as well as unavailable receipts", () => {
  assert.equal(isUnconfirmedResult("connection_error"), true);
  assert.equal(isUnconfirmedResult("temporarily_unavailable"), true);
  for (const code of ["invalid_input", "rate_limited", "stale_version", "forbidden"]) assert.equal(isUnconfirmedResult(code), false);
});

test("actual decision session/CSRF errors require reopening rather than another OTP", () => {
  for (const code of ["decision_session_required", "decision_session_expired", "invalid_csrf", "decision_unavailable", "already_decided", "stale_version", "idempotency_conflict"]) assert.equal(requiresDecisionReopen(code), true, code);
  for (const code of ["otp_required", "invalid_code", "rate_limited", "connection_error"]) assert.equal(requiresDecisionReopen(code), false, code);
});

test("known unresolved questions suppress both request entry points without removing response access", () => {
  const sample = sampleRenewals(clientId)[0];
  // Use an explicit server projection; fixture eligibility must not depend on today's date.
  const open = { ...sample, allowedActions: ["issue", "revise", "withdraw"] };
  assert.ok(detail(open).includes(`/renewals/${open.cycle.id}/request`));
  for (const state of ["open", "ready"]) {
    const html = detail({ ...open, cycle: { ...open.cycle, state } }, { hasUnresolvedQuestions: true });
    assert.ok(!html.includes(`/renewals/${open.cycle.id}/request`), state);
    assert.ok(html.includes(`/renewals/${open.cycle.id}/responses`));
    assert.ok(html.includes("Resolve the client’s questions"));
  }
  assert.ok(!detail(open, { canWrite: false }).includes(`/renewals/${open.cycle.id}/request`));
});

test("ended items do not offer assignment; a known active successor still permits item editing", () => {
  const sample = sampleRenewals(clientId)[0];
  const closed = { ...sample, cycle: { ...sample.cycle, state: "renewed", closedAt: "2026-11-19T00:00:00Z" }, allowedActions: ["correct", "billing"] };
  const href = `/renewals/${sample.cycle.id}/assignment`;
  assert.ok(!detail(closed).includes(href));
  assert.ok(!detail(closed, { hasActiveCycle: false }).includes(href));
  assert.ok(detail(closed, { hasActiveCycle: true }).includes(href));
  assert.ok(!detail({ ...closed, item: { ...closed.item, archivedAt: "2026-11-19T00:00:00Z" } }, { hasActiveCycle: true }).includes(href));
});

test("first renewal action remains available when the preview badge is off", () => {
  const html = renderToStaticMarkup(createElement(RenewalsFirstState, { state: { kind: "existing-clients" }, preview: false }));
  assert.ok(html.includes('href="/renewals/new"'));
  assert.ok(html.includes("Add renewal"));
});
