import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { localToday, addDays } from "../packages/domain/renewal-dates.ts";

export async function testRenewals(t, { api, expect, createWorkspace, owner, second, staff, other, origin, prefix, appDb, workerDb, adminDb, captureMail }) {
  const workspace = await expect(await createWorkspace(second, "Renewal test"), 201);
  const scope = `${prefix}/${workspace.id}`;
  const createClient = (url, person, name) => api(`${url}/clients`, { method: "POST", cookie: person.cookie, body: { name } });
  const client = await expect(await createClient(scope, second, "Renewal client"), 201);
  const foreign = await expect(await createClient(`${prefix}/${other.id}`, second, "Outside client"), 201);
  const today = localToday("Asia/Kolkata");
  const input = {
    clientId: client.id, operatorId: second.id, service: "Annual hosting", provider: "Example Host",
    expiryOn: "2025-06-30", noticeBy: "2025-06-20", respondBy: "2025-06-15",
    payer: "agency", rebillable: true, currency: "INR", supplierCostMinor: 800_000, clientQuoteMinor: 1_000_000,
    term: "12 months", recurrence: "yearly",
  };
  const at = (path, cookie = second.cookie) => api(scope + path, { cookie });
  const send = (path, body, key, method = "POST", cookie = second.cookie) =>
    api(scope + path, { method, cookie, body, key });
  const cyclePath = (id) => `/cycles/${id}`;

  await t.test("synthetic client decision protects terms and records one outcome", async () => {
    const contactEmail = `decision-${randomUUID()}@example.test`;
    const contact = await expect(await send(`/clients/${client.id}/contacts`, {
      name: "Synthetic customer", email: contactEmail,
    }), 201);
    const created = await expect(await send("/items", {
      ...input, service: "Decision test", recurrence: "once", payer: "client", rebillable: false,
      expiryOn: addDays(today, 60), noticeBy: null, respondBy: addDays(today, 15),
    }), 201);
    const path = cyclePath(created.cycle.id);
    await expect(await send(path + "/requests", { contactId: contact.id, expectedVersion: 1 }), 201);
    const request = await adminDb.decisionRequest.findFirstOrThrow({ where: { cycleId: created.cycle.id } });
    const invitation = await captureMail(contactEmail, /Decision code:/);
    const token = invitation.text.match(/Decision code: ([\w-]{43})/)?.[1];
    assert.ok(token);
    const scanner = await api("/d/" + token, { redirect: "manual" });
    assert.equal(scanner.status, 303);
    const decisionCookie = scanner.headers.getSetCookie()[0].split(";")[0];
    const csrf = new URL(scanner.headers.get("location")).hash.slice(1);
    assert.equal(new URL(scanner.headers.get("location")).pathname, "/d");
    assert.equal(await adminDb.decisionResponse.count({ where: { requestId: request.id } }), 0);
    const cookiePreview = await expect(await api("/d", { cookie: decisionCookie }), 200);
    assert.equal(cookiePreview.amountMinor, 1000000);
    await expect(await api("/api/v1/decisions/session/otp/start", {
      method: "POST", cookie: decisionCookie, body: {},
    }), 403, "invalid_csrf");
    const wrongOrigin = await api("/api/v1/decisions/session/otp/start", {
      method: "POST", cookie: decisionCookie, body: {}, headers: { "x-csrf-token": csrf, Origin: "https://foreign.test" },
    });
    await expect(wrongOrigin, 403, "invalid_origin");
    const publicSend = (route, body, key) => api("/api/v1/decisions/" + route, { method: "POST", body, key });
    const terms = await expect(await publicSend("preview", { token }), 200);
    assert.equal(terms.amountMinor, 1000000);
    assert.equal(Object.hasOwn(terms, "supplierCostMinor"), false);
    await expect(await api("/api/v1/decisions/session/otp/start", {
      method: "POST", cookie: decisionCookie, body: {}, headers: { "x-csrf-token": csrf },
    }), 200);
    const otpMail = await captureMail(contactEmail, /^\d{6}\s*$/);
    const code = otpMail.text.trim();
    await expect(await api("/api/v1/decisions/session/otp/verify", {
      method: "POST", cookie: decisionCookie, body: { code: code === "999999" ? "000000" : "999999" }, headers: { "x-csrf-token": csrf },
    }), 403);
    await expect(await api("/api/v1/decisions/session/otp/verify", {
      method: "POST", cookie: decisionCookie, body: { code }, headers: { "x-csrf-token": csrf },
    }), 200);
    const body = { expectedVersion: terms.version, choice: "approve" };
    const sessionRespond = (body, key) => api("/api/v1/decisions/session/respond", { method: "POST", cookie: decisionCookie, body, key, headers: { "x-csrf-token": csrf } });
    const key = randomUUID();
    const results = await Promise.all([sessionRespond(body, key), sessionRespond(body, key)]);
    assert.deepEqual(await expect(results[0], 200), await expect(results[1], 200));
    assert.equal(await adminDb.decisionResponse.count({ where: { requestId: request.id } }), 1);
    const ready = await expect(await at(path), 200);
    assert.equal(ready.cycle.state, "ready");
    await expect(await publicSend("preview", { token }), 410);
    await expect(await send(path + "/requests", { contactId: contact.id, expectedVersion: ready.cycle.version }), 201);
    await expect(await publicSend("preview", { token }), 410);
    await expect(await api("/d", { cookie: decisionCookie }), 410);
    const current = await expect(await at(path), 200);
    await expect(await send(path + "/ready", { expectedVersion: current.cycle.version, action: "renew", reason: "Synthetic provider test" }), 200);
    await expect(await send(path + "/complete", { expectedVersion: current.cycle.version + 1, outcome: "renewed",
      performedOn: today, providerReference: "SYNTHETIC-HOST-100" }), 200);
    await expect(await send(`/items/${created.item.id}/archive`, { expectedVersion: 1, abandonReason: "Synthetic flow complete" }), 200);
  });

  await t.test("renewal completion is atomic, idempotent and independently billable", async () => {
    await expect(await send("/items", { ...input, respondBy: "2025-06-21" }), 400, "invalid_request");
    await expect(await send("/items", { ...input, clientId: foreign.id }), 404);
    await expect(await send("/items", { ...input, operatorId: owner.id }), 409, "invalid_operator");
    const original = await expect(await send("/items", input), 201);
    const id = original.cycle.id;
    const path = cyclePath(id);
    assert.equal(original.cycle.currency, "INR");
    assert.equal(original.cycle.clientQuoteMinor, 1_000_000);
    assert.equal(original.cycle.overdue, true);
    assert.equal(original.cycle.providerNoticeMissed, true);
    const detail = await expect(await at(path), 200);
    assert.equal(detail.suggestedNext.expiryOn, "2026-06-30");
    assert.deepEqual((await expect(await at("/cycles?bucket=waiting_on_client&provider=example%20host"), 200)).items.map(({ id }) => id), []);
    assert.deepEqual((await expect(await at(`/cycles?bucket=overdue&clientId=${client.id}&operatorId=${second.id}`), 200)).items.map(({ id }) => id), [original.cycle.id]);
    await expect(await at(path, owner.cookie), 404);
    await expect(await api(`${prefix}/${other.id}${path}`, { cookie: second.cookie }), 404);
    assert.equal(await appDb.renewalCycle.count(), 0);
    assert.equal(await appDb.renewalItem.count(), 0);
    assert.equal(await workerDb.renewalCycle.count(), 0);
    await expect(await send(`/clients/${client.id}/archive`, { expectedVersion: 1 }), 409, "client_has_renewals");

    const finish = { expectedVersion: 4, outcome: "renewed", performedOn: "2025-06-18", providerReference: "HOST-857" };
    await expect(await send(path + "/complete", { ...finish, expectedVersion: 1 }), 422, "invalid_transition");
    const ready = await expect(await send(path + "/record-offline", {
      expectedVersion: 1, action: "renew", source: "Client email", instructedOn: "2025-06-15", reason: "Client accepted the written quote.",
    }), 200);
    assert.equal(ready.state, "ready");
    assert.equal(ready.nextActionOn, "2025-06-20");
    await expect(await send(path + "/blocker", {
      expectedVersion: 2, blocked: true, reason: "Provider rejected the first request.",
    }, undefined, "PATCH"), 200);
    assert.equal((await expect(await at("/cycles?bucket=blocked"), 200)).items[0].id, id);
    await expect(await send(path + "/complete", { ...finish, expectedVersion: 3, next: detail.suggestedNext }), 422, "invalid_transition");
    await expect(await send(path + "/blocker", {
      expectedVersion: 3, blocked: false, reason: "Provider resolved the account hold.",
    }, undefined, "PATCH"), 200);
    await expect(await send(path + "/complete", finish), 422, "invalid_transition");
    await expect(await send(path + "/complete", { ...finish, next: { expiryOn: "2025-06-30" } }), 422, "invalid_transition");
    const keys = [randomUUID(), randomUUID()];
    const body = { ...finish, next: detail.suggestedNext };
    const pair = await Promise.all([
      send(path + "/complete", body, keys[0]),
      send(path + "/complete", body, keys[1]),
    ]);
    assert.deepEqual(pair.map(({ status }) => status).sort(), [200, 409]);
    const winner = pair[0].ok ? pair[0] : pair[1];
    const losing = pair[0].ok ? pair[1] : pair[0];
    const result = await expect(winner, 200);
    await expect(losing, 409, "stale_version");
    assert.deepEqual(await expect(await send(path + "/complete", body, keys[pair[0].ok ? 0 : 1]), 200), result);
    assert.equal(result.cycle.billingStatus, "to_invoice");
    assert.equal(result.successor.sequence, 2);
    const itemCycles = await expect(await at(`/cycles?itemId=${original.item.id}`), 200);
    assert.equal(itemCycles.items.length, 2);
    const firstPage = await expect(await at(`/cycles?itemId=${original.item.id}&limit=1`), 200);
    assert.equal(firstPage.items[0].id, result.successor.id);
    const secondPage = await expect(await at(`/cycles?itemId=${original.item.id}&limit=1&after=${firstPage.nextCursor}`), 200);
    assert.equal(secondPage.items[0].id, result.cycle.id);
    const totals = await expect(await at("/cycles/billing-totals"), 200);
    assert.deepEqual(totals, [{ currency: "INR", quoteTotalMinor: "1000000", totalItems: "1", quotesMissing: "0" }]);
    const invoiced = await expect(await send(path + "/billing", {
      expectedVersion: 5, status: "invoiced", invoiceReference: "INV-20",
    }, undefined, "PATCH"), 200);
    assert.equal(invoiced.invoiceReference, "INV-20");
    const corrected = await expect(await send(path + "/correct", {
      expectedVersion: 6, correction: "Provider confirmed at 10:30 local.",
    }), 200);
    assert.equal(corrected.providerReference, "HOST-857");
    const history = await expect(await at(path + "/history?limit=1"), 200);
    const rest = await expect(await at(path + `/history?after=${history.nextCursor}`), 200);
    const instruction = rest.items.find(({ event }) => event === "cycle.offline_instruction");
    assert.equal(instruction.actorId, second.id);
    assert.equal(instruction.details.quoteMinor, 1_000_000);
    assert.ok(rest.items.some(({ event }) => event === "cycle.corrected"));
    const exported = await at("/exports/renewals.csv?billingStatus=invoiced&archived=include");
    assert.equal(exported.status, 200);
    assert.match(await exported.text(), /INV-20/);
    await expect(await at("/exports/renewals.csv", owner.cookie), 404);
    const events = await adminDb.auditEvent.count({ where: { workspaceId: workspace.id, event: "renewals.exported" } });
    assert.equal(events, 1);

  });

  await t.test("drafts, cancellation and archive preserve explicit operator control", async () => {
    const draft = await expect(await send("/items", {
      ...input, service: "Cancel hosting", mode: "draft", payer: "client", rebillable: false,
    }), 201);
    assert.equal(draft.cycle.overdue, false);
    const path = cyclePath(draft.cycle.id);
    await expect(await send(path + "/ready", { expectedVersion: 1, action: "cancel", reason: "No approval required." }), 422);
    await expect(await send(path + "/activate", { expectedVersion: 1 }), 200);
    const revised = await expect(await send(path, {
      expiryOn: "2025-06-30", noticeBy: "2025-06-24", respondBy: "2025-06-23",
      service: "Cancel hosting", provider: "Example Host", currency: "INR", payer: "client", expectedVersion: 2,
    }, undefined, "PATCH"), 422);
    assert.equal(revised.error.code, "invalid_transition");
    await expect(await send(path + "/ready", { expectedVersion: 2, action: "cancel", reason: "Contract ended." }), 200);
    const completed = await expect(await send(path + "/complete", {
      expectedVersion: 3, outcome: "cancelled", performedOn: "2025-06-18", note: "Provider processed the cancellation.",
    }), 200);
    assert.equal(completed.successor, null);
    assert.equal(completed.cycle.billingStatus, "not_applicable");
    await expect(await send(`/items/${draft.item.id}/archive`, { expectedVersion: 1 }), 200);
    assert.equal((await expect(await at(`/items/${draft.item.id}`), 200)).id, draft.item.id);
    assert.equal((await expect(await at(path), 200)).cycle.state, "cancelled");

    const oneOff = await expect(await send("/items", {
      ...input, service: "One-off record", recurrence: "once", expiryOn: addDays(today, 29), noticeBy: null, respondBy: null,
    }), 201);
    const updated = await expect(await send(`/items/${oneOff.item.id}`, { expectedVersion: 1, recurrence: "monthly" }, undefined, "PATCH"), 200);
    assert.equal(updated.recurrence, "monthly");
    const due = await expect(await at("/cycles?bucket=due_soon&limit=1"), 200);
    assert.equal(due.items[0].id, oneOff.cycle.id);
    await expect(await send(`/items/${oneOff.item.id}/archive`, { expectedVersion: 2 }), 422);
    await expect(await send(`/items/${oneOff.item.id}/archive`, { expectedVersion: 2, abandonReason: "Client no longer uses this." }), 200);
    assert.equal((await expect(await at(cyclePath(oneOff.cycle.id)), 200)).cycle.state, "withdrawn");
    const alerts = await expect(await at("/renewal-alerts"), 200);
    assert.equal(alerts.items.filter(({ entityId }) => entityId === draft.cycle.id).length, 1);
    assert.ok(alerts.items.some(({ event }) => event === "cycle.blocked"));

    const prepaid = await expect(await send("/items", {
      ...input, service: "One-off auto-renew check", recurrence: "once", autoRenew: true, payer: "client", rebillable: false,
    }), 201);
    const prepaidPath = cyclePath(prepaid.cycle.id);
    assert.equal(prepaid.cycle.autoRenew, true);
    assert.equal(prepaid.cycle.state, "open");
    await expect(await send(prepaidPath + "/ready", { expectedVersion: 1, action: "renew", reason: "Client handles payment." }), 200);
    const confirmed = await expect(await send(prepaidPath + "/complete", {
      expectedVersion: 2, outcome: "renewed", performedOn: "2025-06-25", note: "Confirmed the result at the provider.",
    }), 200);
    assert.equal(confirmed.successor, null);
    await expect(await send(`/items/${prepaid.item.id}/archive`, { expectedVersion: 1 }), 200);
  });

  await t.test("CSV preview validates, warns and commits exactly once within quota", async () => {
    const template = await at("/imports/template");
    assert.equal(template.status, 200);
    assert.match(template.headers.get("content-type"), /text\/csv/);
    const header = (await template.text()).trimEnd();
    function csvRows(changes) {
      return header + "\r\n" + changes.map((change) => {
        const row = { ...input, expiryOn: addDays(today, 60), noticeBy: "", respondBy: "", recurrence: "once", mode: "activate", ...change };
        return header.split(",").map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`).join(",");
      }).join("\r\n") + "\r\n";
    }
    const preview = (raw) => fetch(origin + scope + "/imports/preview", {
      method: "POST", headers: { Origin: origin, Cookie: second.cookie, "Content-Type": "text/csv" }, body: raw,
    });
    const commit = (batch, confirmPossibleDuplicates = false, key) =>
      send(`/imports/${batch.importId}/commit`, { expectedVersion: batch.version, confirmPossibleDuplicates }, key);
    const bad = await expect(await preview(csvRows([
      { clientId: foreign.id }, { expiryOn: "2025-06-30", mode: "" }, { expiryOn: "2026-02-29" },
    ])), 200);
    assert.equal(bad.canCommit, false);
    assert.deepEqual(new Set(bad.errors.map(({ field }) => field)), new Set(["clientId", "mode", "expiryOn"]));

    const staleText = csvRows([{ service: "Changed between preview and commit" }]);
    const staged = await expect(await preview(staleText), 200);
    const inserted = await expect(await send("/items", { ...input, service: "Changed between preview and commit" }), 201);
    await expect(await commit(staged), 409, "import_changed");
    const refreshed = await expect(await preview(staleText), 200);
    assert.equal(refreshed.version, staged.version + 1);
    await expect(await commit(staged, true), 409, "stale_version");
    await expect(await send(`/items/${inserted.item.id}/archive`, { expectedVersion: 1, abandonReason: "Test cleanup" }), 200);

    const duplicateText = csvRows([{ service: "Annual hosting" }]);
    const duplicate = await expect(await preview(duplicateText), 200);
    assert.equal(duplicate.warnings[0].field, "service");
    await expect(await commit(duplicate), 409, "duplicates_require_confirmation");
    const committed = await expect(await commit(duplicate, true), 200);
    assert.equal(committed.count, 1);
    assert.deepEqual(await expect(await commit(duplicate, true), 200), committed);
    assert.deepEqual((await expect(await preview(duplicateText), 200)).result, committed);

    const makeBatch = async (label) => expect(await preview(csvRows(
      Array.from({ length: 5 }, (_, i) => ({ service: `${label} ${i}` })),
    )), 200);
    const batchA = await makeBatch("Batch A");
    const batchB = await makeBatch("Batch B");
    const results = await Promise.all([commit(batchA), commit(batchB)]);
    assert.deepEqual(results.map(({ status }) => status).sort(), [200, 409]);
    await expect(results.find(({ status }) => status === 409), 409, "item_limit");
    assert.equal((await expect(await at("/items"), 200)).items.length, 7);
    assert.equal(await appDb.renewalImport.count(), 0);

    const expired = await makeBatch("Expired");
    await adminDb.renewalImport.update({ where: { id: expired.importId }, data: { expiresAt: new Date(0) } });
    await expect(await commit(expired), 410, "import_expired");
    const deleted = await workerDb.$executeRaw`DELETE FROM renewal_imports WHERE "committedAt" IS NULL AND "expiresAt" <= now()`;
    assert.ok(deleted >= 1);
    assert.equal((await workerDb.renewalImport.findMany()).length, 0);
  });

  await t.test("member removal reassigns open cycles and drafts atomically", async () => {
    // Staff is already a member of the other workspace through the M1 fixture.
    const shared = `${prefix}/${other.id}`;
    const sharedClient = await expect(await createClient(shared, second, "Shared renewal client"), 201);
    const created = await expect(await api(shared + "/items", {
      method: "POST", cookie: second.cookie, body: { ...input, clientId: sharedClient.id, operatorId: staff.id, mode: "draft" },
    }), 201);
    const removePath = `${shared}/members/${staff.id}`;
    await expect(await api(removePath, { method: "DELETE", cookie: second.cookie }), 409, "replacement_required");
    await expect(await api(removePath, { method: "DELETE", cookie: second.cookie, body: { replacementUserId: owner.id } }), 409, "invalid_operator");
    await expect(await api(removePath, { method: "DELETE", cookie: second.cookie, body: { replacementUserId: second.id } }), 200);
    const updated = await expect(await api(shared + cyclePath(created.cycle.id), { cookie: second.cookie }), 200);
    assert.equal(updated.item.operatorId, second.id);
    assert.equal(updated.cycle.operatorId, second.id);
    assert.equal(updated.cycle.version, 2);
    await expect(await api(shared + cyclePath(created.cycle.id), { cookie: staff.cookie }), 404);
  });
}
