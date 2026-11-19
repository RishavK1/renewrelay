import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import { mkdir, mkdtemp, rm, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
await mkdir(join(root, ".next"), { recursive: true });
const directory = await mkdtemp(join(root, ".next", "settings-unit-"));
after(() => rm(directory, { recursive: true, force: true }));
const output = join(directory, "settings.mjs");
await build({ stdin: { contents: `export * from "./packages/ui/settings/policy"; export * from "./packages/ui/settings/contracts"; export { exportDataset, dataExportQuery } from "./packages/domain/data-export"; export { previewRenewal } from "./apps/marketing/components/renewals/renewal-fixtures"; export { TimezoneForm } from "./packages/ui/settings/timezone-form"; export { DeleteWorkspace, DeletionStatus } from "./packages/ui/settings/deletion-screens"; export { ExportScreen } from "./packages/ui/settings/export-screen";`, resolveDir: root }, outfile: output, bundle: true, packages: "external", platform: "node", format: "esm", jsx: "automatic", logLevel: "silent" });
const ui = await import(pathToFileURL(output).href);
const access = { role: "owner", recentAuth: true, writable: true, deleting: false };
const workspace = { id: "00000000-0000-4000-8000-000000000001", name: "Sample workspace", timezone: "Asia/Kolkata", version: 1, role: "owner" };
const billing = { mode: "paid", writable: true, limits: { items: 100, seats: 5 }, usage: { items: 0, seats: 1 }, trialEndsAt: "2026-01-01T00:00:00Z", paidThrough: "2099-01-01T00:00:00Z", graceEndsAt: null, cancellationScheduled: false, deletionRequestedAt: null, purgeAfter: null, providerStatus: "active", checkoutState: null, checkoutUrl: null, version: 1 };
const action = async () => { throw new Error("Static render cannot call a service"); };
const render = (Component, props) => renderToStaticMarkup(createElement(Component, props));
test("timezone payload requires exact opaque snapshot/version/confirmation", () => {
  assert.equal(ui.timezoneChangeInput.safeParse({ timezone: "Europe/London", expectedVersion: 1, previewToken: "a".repeat(64), confirm: true }).success, true);
  for (const extra of [{ confirm: false }, { expectedVersion: 0 }, { previewToken: "visible-name" }, { unsafe: true }]) assert.equal(ui.timezoneChangeInput.safeParse({ timezone: "UTC", expectedVersion: 1, previewToken: "a".repeat(64), confirm: true, ...extra }).success, false);
  assert.equal(ui.timezonePreviewInput.safeParse({ timezone: "Made/Up" }).success, false);
});
test("dataset enum and parsed query match the server export contract", () => {
  assert.deepEqual(ui.exportDatasets, ui.exportDataset.options);
  for (const dataset of ui.exportDatasets) for (const limit of ["1", "25", "100"]) {
    const input = { dataset, limit, asOf: "2026-01-01T00:00:00Z" };
    assert.deepEqual(ui.dataExportInput.parse(input), ui.dataExportQuery.parse(input));
  }
  for (const limit of ["0", "101", "1.5", "01"]) assert.equal(ui.dataExportInput.safeParse({ dataset: "clients", limit }).success, false);
});
test("CSV filters exclude pagination and reject reversed expiry dates", () => {
  assert.equal(ui.csvExportInput.safeParse({ after: "cursor" }).success, false);
  assert.equal(ui.csvExportInput.safeParse({ limit: "25" }).success, false);
  assert.equal(ui.csvExportInput.safeParse({ from: "2026-12-02", through: "2026-12-01" }).success, false);
  assert.deepEqual(ui.csvExportInput.parse({}), { archived: "include" });
});
test("export safety and timezone restrictions distinguish roles and access modes", () => {
  assert.equal(ui.canExportSettings({ ...access, writable: false }, "csv"), true);
  assert.equal(ui.canExportSettings({ ...access, role: "admin", recentAuth: false }, "csv"), true);
  assert.equal(ui.canExportSettings({ ...access, role: "admin" }, "data"), false);
  assert.equal(ui.canExportSettings({ ...access, recentAuth: false }, "data"), false);
  assert.equal(ui.canExportSettings({ ...access, deleting: true }, "csv"), false);
  assert.equal(ui.canChangeTimezone({ ...access, writable: false }), false);
  assert.equal(ui.canChangeTimezone({ ...access, recentAuth: false }), false);
});
test("checkout never offers new setup during active verified paid period", () => {
  assert.equal(ui.canStartCheckout(billing), false);
  assert.equal(ui.canStartCheckout({ ...billing, mode: "deleting" }), false);
  assert.equal(ui.canStartCheckout({ ...billing, checkoutState: "processing" }), true);
  assert.equal(ui.canStartCheckout({ ...billing, mode: "grace", paidThrough: "2026-01-01T00:00:00Z" }), true);
});
test("deletion is blocked without separately loaded retention data", () => {
  const html = render(ui.DeleteWorkspace, { workspace, billing, access, action, lifecycle: null, lifecycleFailure: "Load failed", reloadLifecycle: action, preview: true });
  assert.ok(html.includes("Load failed"));
  assert.match(html, /<fieldset disabled=""/);
  assert.ok(html.includes("Export records first"));
});
test("recovery expiry hides confirmation and does not promise reactivated links", () => {
  const html = render(ui.DeletionStatus, { billing: { ...billing, mode: "deleting", deletionRequestedAt: "2026-01-01T00:00:00Z", purgeAfter: "2026-02-01T00:00:00Z" }, lifecycle: null, access, action, preview: true });
  assert.ok(!html.includes(">Review restoration</button>"));
  assert.ok(html.includes("Recovery is unavailable"));
  assert.ok(html.includes("not a guaranteed erasure date"));
});
test("UI modules have no fetch/provider/credential imports and dev routes stay guarded", async () => {
  for (const name of ["billing-screens.tsx", "deletion-screens.tsx", "timezone-form.tsx", "export-screen.tsx"]) {
    const source = await readFile(join(root, "packages/ui/settings", name), "utf8");
    assert.doesNotMatch(source, /\bfetch\s*\(|process\.env|from.*domain\//);
  }
  const source = await readFile(join(root, "apps/marketing/app/(auth-preview)/layout.tsx"), "utf8");
  assert.ok(source.includes('process.env.NODE_ENV !== "development"'));
});

test("new preview renewals inherit the current workspace timezone", () => {
 const record = ui.previewRenewal({ clientId: workspace.id, service: "Hosting", provider: "Example", operatorId: "owner", recurrence: "yearly", expiryOn: "2027-01-01", noticeBy: null, respondBy: null, payer: "client", rebillable: false, autoRenew: false, currency: "INR", supplierCostMinor: null, clientQuoteMinor: null, term: null, mode: "draft" }, "item", "cycle", "Europe/London");
 assert.equal(record.cycle.timezone, "Europe/London");
 assert.equal(record.cycle.expiryOn, "2027-01-01");
});

test("terminal checkout cannot resume an active paid term or appear as processing", () => {
 assert.equal(ui.canStartCheckout({ ...billing, checkoutState: "terminal", checkoutUrl: "https://example.invalid/old", providerStatus: "cancelled" }), false);
 assert.equal(ui.checkoutView("terminal", null), "closed");
 assert.equal(ui.checkoutView("ready", null), "processing");
 assert.equal(ui.checkoutView(null, null), "unavailable");
 assert.equal(ui.checkoutView("ready", "https://example.invalid/preview"), "ready");
});

test("non-owner timezone preview controls are blocked before calling an adapter", () => {
 const html = render(ui.TimezoneForm, { workspace, access: { ...access, role: "admin" }, action, preview: true });
 assert.match(html, /<input[^>]+disabled=""/);
 assert.match(html, /<button[^>]+disabled=""[^>]*>Preview impact<\/button>/);
});
