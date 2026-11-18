import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { enrollMfa, authCookies, totp } from "./mfa-helpers.mjs";
import { hashPassword as legacyHash } from "better-auth/crypto";
import { InviteCredentials } from "../packages/domain/invite-credentials.ts";
import { consumeRate } from "../packages/domain/rate-limits.ts";
import { setWorkspace } from "../packages/db/database.ts";
import { processMail } from "../apps/worker/mail-jobs.ts";
import { processInternalMail } from "../apps/worker/internal-mail.ts";
import { MailFailure } from "../packages/integrations/transactional-mail.ts";
import { addDays, localToday } from "../packages/domain/renewal-dates.ts";

export async function batch4Scenarios(t, { api, expect, second, owner, staff, adminDb, appDb, workerDb, createUser, captureMail, password }) {
  const today = localToday("Asia/Kolkata");
  const credentials = new InviteCredentials(Buffer.from(process.env.INVITE_ENCRYPTION_KEY, "base64url"));
  const path = (workspace, suffix) => `/api/v1/workspaces/${workspace.id}${suffix}`;
  const post = (workspace, suffix, body, key = randomUUID(), cookie = second.cookie, method = "POST") => api(path(workspace, suffix), { method, cookie, body, key });
  const get = (workspace, suffix, cookie = second.cookie) => api(path(workspace, suffix), { cookie });
  async function workspace(label) {
    return expect(await api("/api/v1/workspaces", { method: "POST", cookie: second.cookie, body: { name: label, timezone: "Asia/Kolkata" } }), 201);
  }
  async function records(space, recurrence = "once", mode = "activate") {
    const client = await expect(await post(space, "/clients", { name: "Batch four customer" }), 201);
    const contact = await expect(await post(space, `/clients/${client.id}/contacts`, { name: "Recipient", email: randomUUID() + "@example.test" }), 201);
    const created = await expect(await post(space, "/items", { clientId: client.id, operatorId: second.id,
      service: "Hosting", provider: "Synthetic", expiryOn: addDays(today, 60), respondBy: addDays(today, 15),
      payer: "client", currency: "INR", clientQuoteMinor: 10000, term: "Annual", recurrence, mode }), 201);
    return { client, contact, ...created };
  }
  async function issue(space, record) {
    const issued = await expect(await post(space, `/cycles/${record.cycle.id}/requests`, { contactId: record.contact.id, expectedVersion: record.cycle.version }), 201);
    const delivery = await adminDb.decisionDelivery.findFirstOrThrow({ where: { requestId: issued.requestId, kind: "invitation" } });
    return { ...issued, token: credentials.decrypt(delivery.ciphertext, issued.requestId) };
  }
  const publicPost = (route, body, headers = {}) => api("/api/v1/decisions/" + route, { method: "POST", body, headers });

  await t.test("batch4 MFA enforcement, backup recovery, session revocation and legacy password upgrade", async () => {
    let person = await createUser("mfa-" + randomUUID(), false);
    await expect(await api("/api/v1/workspaces", { method: "POST", cookie: person.cookie, body: { name: "Denied without MFA", timezone: "UTC" } }), 403, "mfa_required");
    const originalCookie = person.cookie;
    const otherLogin = await api("/api/auth/sign-in/email", { method: "POST", headers: person.headers, body: { email: person.email, password } });
    await expect(otherLogin, 200);
    const oldUnverified = authCookies(otherLogin);
    person = await enrollMfa(api, expect, person, password);
    await expect(await api("/api/v1/account/sessions", { cookie: originalCookie }), 401);
    await expect(await api("/api/v1/account/sessions", { cookie: oldUnverified }), 403, "mfa_required");
    await expect(await api("/api/auth/two-factor/disable", { method: "POST", cookie: person.cookie, body: { password } }), 404, "not_found");
    await adminDb.account.updateMany({ where: { userId: person.id, providerId: "credential" }, data: { password: await legacyHash(password) } });
    async function login() {
      const response = await api("/api/auth/sign-in/email", { method: "POST", headers: person.headers, body: { email: person.email, password } });
      assert.equal((await expect(response, 200)).twoFactorRedirect, true);
      return authCookies(response);
    }
    person.headers = { ...person.headers, "x-renewrelay-test-client-ip": "198.51.100.92" };
    let pendingCookie = await login();
    const account = await adminDb.account.findFirstOrThrow({ where: { userId: person.id, providerId: "credential" } });
    assert.ok(account.password.startsWith("rr-scrypt-v1$"));
    await expect(await api("/api/v1/workspaces", { cookie: pendingCookie }), 401);
    const correct = await totp(person.totpSecret);
    await expect(await api("/api/auth/two-factor/verify-totp", { method: "POST", cookie: pendingCookie,
      headers: person.headers, body: { code: correct === "000000" ? "999999" : "000000" } }), 401);
    const recovered = await api("/api/auth/two-factor/verify-backup-code", { method: "POST", cookie: pendingCookie,
      headers: person.headers, body: { code: person.backupCodes[0] } });
    await expect(recovered, 200);
    const recoveryCookie = authCookies(recovered);
    const sessions = await expect(await api("/api/v1/account/sessions", { cookie: recoveryCookie }), 200);
    assert.ok(sessions.items.length >= 2);
    assert.ok(sessions.items.every(session => !Object.hasOwn(session, "token")));
    assert.ok(sessions.items.some(session => !session.mfaVerifiedAt));
    pendingCookie = await login();
    await expect(await api("/api/auth/two-factor/verify-backup-code", { method: "POST", cookie: pendingCookie,
      headers: person.headers, body: { code: person.backupCodes[0] } }), 401);
    const verified = await api("/api/auth/two-factor/verify-totp", { method: "POST", cookie: pendingCookie, headers: person.headers, body: { code: await totp(person.totpSecret) } });
    await expect(verified, 200);
    const freshCookie = authCookies(verified);
    const uri = await expect(await api("/api/auth/two-factor/get-totp-uri", { method: "POST", cookie: freshCookie, headers: person.headers, body: { password } }), 200);
    assert.equal(typeof uri.totpURI, "string");
    const regenerated = await expect(await api("/api/auth/two-factor/generate-backup-codes", { method: "POST", cookie: freshCookie, headers: person.headers, body: { password } }), 200);
    assert.ok(regenerated.backupCodes.length > 0);
    const prior = await expect(await api("/api/auth/get-session", { cookie: person.cookie }), 200);
    const revokeKey = randomUUID();
    const revoked = await expect(await api("/api/v1/account/sessions/revoke", { method: "POST", cookie: freshCookie, key: revokeKey, body: { sessionId: prior.session.id } }), 200);
    assert.deepEqual(await expect(await api("/api/v1/account/sessions/revoke", { method: "POST", cookie: freshCookie, key: revokeKey, body: { sessionId: prior.session.id } }), 200), revoked);
    await expect(await api("/api/v1/account/sessions", { cookie: person.cookie }), 401);
    const otherSession = await adminDb.session.findFirstOrThrow({ where: { userId: second.id } });
    assert.equal((await expect(await api("/api/v1/account/sessions/revoke", { method: "POST", cookie: freshCookie, body: { sessionId: otherSession.id } }), 200)).revoked, 0);
    const unmanaged = await adminDb.session.create({ data: { id: randomUUID(), userId: person.id, token: randomUUID(), expiresAt: new Date(Date.now() + 86400_000) } });
    // Revocation by ID never exposes or relies on a client-provided session token.
    await expect(await api("/api/v1/account/sessions/revoke", { method: "POST", cookie: freshCookie, body: { sessionId: unmanaged.id } }), 200);
    const profile = await expect(await api("/api/v1/account/export", { cookie: freshCookie }), 200);
    assert.equal(profile.profile.id, person.id);
    const security = await expect(await api("/api/v1/account/security-events", { cookie: freshCookie }), 200);
    assert.ok(security.items.some(event => event.event === "mfa.recovered"));
    assert.ok(security.items.some(event => event.event === "sessions.revoked"));
    const eligibility = await expect(await api("/api/v1/account/deletion-preview", { cookie: freshCookie }), 200);
    assert.equal(eligibility.eligible, true);
    await expect(await api("/api/v1/account/deletion", { method: "POST", cookie: freshCookie,
      body: { confirmEmail: person.email, password, confirm: true } }), 200);
    assert.equal(await adminDb.user.count({ where: { id: person.id } }), 0);
    assert.equal(await adminDb.twoFactor.count({ where: { userId: person.id } }), 0);
    await expect(await api("/api/v1/account/export", { cookie: freshCookie }), 401);
  });

  await t.test("batch4 password reset tokens expire, consume once and return generic account responses", async () => {
    const person = await createUser("reset-" + randomUUID(), false);
    const requestReset = email => api("/api/auth/request-password-reset", { method: "POST", headers: person.headers,
      body: { email, redirectTo: process.env.BETTER_AUTH_URL + "/api/v1/health" } });
    let started = performance.now();
    const known = await expect(await requestReset(person.email), 200);
    assert.ok(performance.now() - started >= 230);
    started = performance.now();
    const unknown = await expect(await requestReset(randomUUID() + "@example.test"), 200);
    assert.ok(performance.now() - started >= 230);
    assert.deepEqual(known, unknown);
    const duplicate = await expect(await api("/api/auth/sign-up/email", { method: "POST", headers: person.headers,
      body: { name: "Duplicate", email: person.email, password } }), 200);
    assert.equal(duplicate.token, null);
    const tokenFromMail = async () => {
      const text = (await captureMail(person.email, /reset-password/)).text;
      return new URL(text.match(/https?:\/\/[^\s]+/)[0]).pathname.split("/").at(-1);
    };
    const expired = await tokenFromMail();
    await adminDb.verification.updateMany({ where: { identifier: "reset-password:" + expired }, data: { expiresAt: new Date(0) } });
    await expect(await api("/api/auth/reset-password", { method: "POST", headers: person.headers,
      body: { token: expired, newPassword: "Synthetic-New-Password-91!" } }), 400);
    await expect(await requestReset(person.email), 200);
    const fresh = await tokenFromMail();
    assert.notEqual(fresh, expired);
    const body = { token: fresh, newPassword: "Synthetic-New-Password-91!" };
    await expect(await api("/api/auth/reset-password", { method: "POST", headers: person.headers, body }), 200);
    await expect(await api("/api/auth/reset-password", { method: "POST", headers: person.headers, body }), 400);
    await expect(await api("/api/v1/account/export", { cookie: person.cookie }), 401);
  });

  await t.test("batch4 shared atomic counters enforce expiry, trusted-IP and aggregate tenant budgets", async () => {
    const scope = "synthetic/" + randomUUID();
    const now = new Date("2026-01-01T00:00:00Z");
    const concurrent = await Promise.allSettled(Array.from({ length: 12 }, () => consumeRate(appDb, "synthetic", scope, 5, 1000, now)));
    assert.equal(concurrent.filter(result => result.status === "fulfilled").length, 5);
    assert.equal(concurrent.filter(result => result.status === "rejected" && result.reason.status === 429).length, 7);
    await consumeRate(appDb, "synthetic", scope, 5, 1000, new Date(now.getTime() + 1000));
    const seed = async (principal, count) => {
      const window = Math.floor(Date.now() / 60_000);
      const key = createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(JSON.stringify([principal, window])).digest("hex");
      await adminDb.apiRateLimit.upsert({ where: { key }, create: { key, count, expiresAt: new Date((window + 1) * 60_000) }, update: { count } });
    };
    await seed("ip/public/198.51.100.91", 120);
    const limited = await publicPost("preview", { token: "A".repeat(43) }, { "x-renewrelay-test-client-ip": "198.51.100.91", "x-forwarded-for": "203.0.113.2" });
    assert.ok(Number(limited.headers.get("retry-after")) > 0);
    await expect(limited, 429, "rate_limited");
    const space = await workspace("Tenant rate fixture");
    await adminDb.membership.create({ data: { workspaceId: space.id, userId: staff.id, email: staff.email, role: "member" } });
    await seed("tenant/write/" + space.id, 1200);
    await expect(await post(space, "/clients", { name: "Limited" }), 429, "rate_limited");
    await expect(await post(space, "/clients", { name: "Also limited" }, randomUUID(), staff.cookie), 429, "rate_limited");
    const independent = await workspace("Independent budget");
    await expect(await post(independent, "/clients", { name: "Allowed" }), 201);
  });

  await t.test("batch4 staff resend invalidates every old credential while retaining revision and saved dates", async () => {
    const space = await workspace("Resend contract");
    const record = await records(space);
    const request = await issue(space, record);
    const exchanged = await api("/d/" + request.token, { redirect: "manual" });
    const oldCookie = authCookies(exchanged);
    const oldCsrf = new URL(exchanged.headers.get("location")).hash.slice(1);
    await expect(await publicPost("otp/start", { token: request.token }), 200);
    const otp = (await captureMail(record.contact.email, /^\d{6}\s*$/)).text.trim();
    const key = randomUUID();
    const route = `/cycles/${record.cycle.id}/requests/${request.requestId}/resend`;
    await expect(await post(space, `/cycles/${record.cycle.id}/requests/${randomUUID()}/resend`, { expectedVersion: 2 }), 404);
    await expect(await post(space, route, { expectedVersion: 2 }, randomUUID(), owner.cookie), 404);
    const input = { expectedVersion: 2 };
    const result = await expect(await post(space, route, input, key), 200);
    assert.equal(result.revision, 1);
    assert.equal(result.version, 3);
    assert.deepEqual(await expect(await post(space, route, input, key), 200), result);
    await expect(await publicPost("preview", { token: request.token }), 410);
    await expect(await publicPost("respond", { token: request.token, code: otp, expectedVersion: 2, choice: "approve" }), 410);
    await expect(await api("/api/v1/decisions/session/respond", { method: "POST", cookie: oldCookie,
      headers: { "x-csrf-token": oldCsrf }, body: { expectedVersion: 2, choice: "approve" } }), 401);
    const job = await adminDb.decisionDelivery.findFirstOrThrow({ where: { requestId: request.requestId, kind: "resend" } });
    const fresh = credentials.decrypt(job.ciphertext, request.requestId);
    const preview = await expect(await publicPost("preview", { token: fresh }), 200);
    assert.equal(preview.expiryOn, record.cycle.expiryOn);
    assert.equal(preview.timezone, "Asia/Kolkata");
    assert.equal(preview.version, 3);
    assert.equal(Object.hasOwn(preview, "supplierCostMinor"), false);
    await expect(await post(space, route, input), 409, "stale_version");
    await assert.rejects(() => appDb.$transaction(async tx => {
      await setWorkspace(tx, space.id);
      await tx.decisionRequest.update({ where: { id: request.requestId }, data: { amountMinor: 999 } });
    }));
    await adminDb.suppressedRecipient.create({ data: { email: record.contact.email } });
    await expect(await post(space, route, { expectedVersion: 3 }), 422, "recipient_suppressed");
    const visible = await expect(await get(space, `/cycles/${record.cycle.id}`), 200);
    assert.ok(visible.allowedActions.includes("issue"));
    assert.ok(visible.history.items.some(event => event.event === "decision.resent"));
  });

  await t.test("batch4 timezone preview fences concurrent changes and reschedules only open work", async () => {
    const space = await workspace("Timezone confirmation");
    const record = await records(space);
    const request = await issue(space, record);
    const draft = await records(space, "once", "draft");
    await expect(await post(space, "/timezone/preview", { timezone: "America/New_York" }, randomUUID(), owner.cookie), 404);
    await adminDb.membership.create({ data: { workspaceId: space.id, userId: staff.id, email: staff.email, role: "member" } });
    await expect(await post(space, "/timezone/preview", { timezone: "America/New_York" }, randomUUID(), staff.cookie), 403, "forbidden");
    const initial = await expect(await post(space, "/timezone/preview", { timezone: "America/New_York" }), 200);
    assert.equal(initial.affectedCount, 2);
    const confirm = preview => ({ timezone: preview.timezone, expectedVersion: preview.expectedVersion, previewToken: preview.previewToken, confirm: true });
    await expect(await post(space, `/cycles/${record.cycle.id}/blocker`, { expectedVersion: 2, blocked: true, reason: "Synthetic concurrency" }, randomUUID(), second.cookie, "PATCH"), 200);
    await expect(await post(space, "/timezone", confirm(initial)), 409, "stale_preview");
    await expect(await publicPost("preview", { token: request.token }), 200);
    const preview = await expect(await post(space, "/timezone/preview", { timezone: "America/New_York" }), 200);
    const key = randomUUID();
    const result = await expect(await post(space, "/timezone", confirm(preview), key), 200);
    assert.equal(result.affectedCount, 2);
    assert.deepEqual(await expect(await post(space, "/timezone", confirm(preview), key), 200), result);
    await expect(await publicPost("preview", { token: request.token }), 410);
    const current = await expect(await get(space, `/cycles/${record.cycle.id}`), 200);
    assert.equal(current.cycle.timezone, "America/New_York");
    assert.equal(current.cycle.expiryOn, record.cycle.expiryOn);
    assert.equal(current.cycle.state, "open");
    const draftNow = await expect(await get(space, `/cycles/${draft.cycle.id}`), 200);
    assert.equal(draftNow.cycle.state, "draft");
    assert.equal(draftNow.cycle.timezone, "America/New_York");
    await assert.rejects(() => appDb.$transaction(async tx => {
      await setWorkspace(tx, space.id);
      await tx.decisionRequest.update({ where: { id: request.requestId }, data: { supersededAt: null } });
    }));
    await expect(await post(space, "/timezone/preview", { timezone: "Invalid/Timezone" }), 400, "invalid_request");
    await expect(await post(space, "/timezone", { ...confirm(preview), confirm: false }), 400, "invalid_request");
  });

  await t.test("batch4 explicit successor correction preserves closed history and checks both versions", async () => {
    const space = await workspace("Successor correction");
    const record = await records(space, "yearly");
    const route = `/cycles/${record.cycle.id}`;
    await expect(await post(space, route + "/ready", { expectedVersion: 1, action: "renew", reason: "Client handled offline" }), 200);
    const completed = await expect(await post(space, route + "/complete", { expectedVersion: 2, outcome: "renewed", performedOn: today,
      providerReference: "SYNTHETIC", next: { expiryOn: addDays(today, 365) } }), 200);
    const successor = { id: completed.successor.id, expectedVersion: 1, dates: { expiryOn: addDays(today, 400) }, confirm: true };
    const body = { expectedVersion: 3, correction: "Operator confirmed corrected next term.", successor };
    await expect(await post(space, route + "/correct", { ...body, successor: { ...successor, confirm: false } }), 400, "invalid_request");
    await expect(await post(space, route + "/correct", { ...body, successor: { ...successor, expectedVersion: 2 } }), 409, "stale_version");
    const key = randomUUID();
    const result = await expect(await post(space, route + "/correct", body, key), 200);
    assert.deepEqual(await expect(await post(space, route + "/correct", body, key), 200), result);
    assert.equal(result.expiryOn, record.cycle.expiryOn);
    assert.equal(result.state, "renewed");
    const next = await expect(await get(space, `/cycles/${completed.successor.id}`), 200);
    assert.equal(next.cycle.expiryOn, successor.dates.expiryOn);
    assert.equal(next.cycle.version, 2);
    assert.ok(next.history.items.some(event => event.event === "cycle.successor_corrected"));
  });

  await t.test("batch4 paged data export excludes credentials, isolates tenants and permits read-only access", async () => {
    const space = await workspace("Privacy export");
    const record = await records(space);
    const issued = await issue(space, record);
    await adminDb.decisionResponse.create({ data: { workspaceId: space.id, requestId: issued.requestId, sessionId: randomUUID(),
      key: randomUUID(), digest: "synthetic", choice: "question", question: "A private customer question", cycleVersion: 2 } });
    await post(space, "/clients", { name: "Second client" });
    const first = await expect(await get(space, "/exports/data?dataset=clients&limit=1"), 200);
    assert.equal(first.items.length, 1);
    const next = await expect(await get(space, `/exports/data?dataset=clients&limit=1&after=${first.nextCursor}&asOf=${encodeURIComponent(first.asOf)}`), 200);
    assert.equal(next.items.length, 1);
    assert.equal(next.nextCursor, null);
    assert.notEqual(next.items[0].id, first.items[0].id);
    for (const dataset of ["workspace", "members", "invitations", "clients", "contacts", "items", "cycles", "requests", "responses", "audit", "billing", "payments", "deliveries", "notifications", "imports", "invitationDeliveries", "mailEvents"]) {
      await expect(await get(space, "/exports/data?dataset=" + dataset), 200);
    }
    await expect(await get(space, "/exports/data?dataset=clients&after=invalid"), 400, "invalid_cursor");
    const responses = await expect(await get(space, "/exports/data?dataset=responses"), 200);
    assert.equal(responses.items[0].question, "A private customer question");
    for (const dataset of ["invitations", "responses", "deliveries", "notifications"]) {
      const exported = await expect(await get(space, "/exports/data?dataset=" + dataset), 200);
      for (const item of exported.items) for (const field of ["tokenDigest", "ciphertext", "messageCiphertext", "digest", "key", "sessionId"])
        assert.equal(Object.hasOwn(item, field), false, dataset + "/" + field);
    }
    const deliveries = await expect(await get(space, "/exports/data?dataset=deliveries"), 200);
    assert.equal(deliveries.items.length, 3, "Future reminders are part of the authorized data export");
    await expect(await get(space, "/exports/data?dataset=credentials"), 400, "invalid_request");
    await expect(await get(space, "/exports/data?dataset=clients", owner.cookie), 404);
    await adminDb.membership.create({ data: { workspaceId: space.id, userId: staff.id, email: staff.email, role: "member" } });
    await expect(await get(space, "/exports/data?dataset=clients", staff.cookie), 403, "forbidden");
    const lifecycle = await expect(await get(space, "/data-lifecycle"), 200);
    assert.equal(lifecycle.workspaceDeletion.recoveryDays, 30);
    await adminDb.workspaceBilling.update({ where: { workspaceId: space.id }, data: { trialEndsAt: new Date(0) } });
    await expect(await get(space, "/exports/data?dataset=contacts"), 200);
    await expect(await post(space, "/clients", { name: "Forbidden write" }), 403, "workspace_read_only");
    const eligibility = await expect(await api("/api/v1/account/deletion-preview", { cookie: second.cookie }), 200);
    assert.equal(eligibility.eligible, false);
    await expect(await api("/api/v1/account/deletion", { method: "POST", cookie: second.cookie,
      body: { confirmEmail: second.email, password, confirm: true } }), 409, "identity_in_use");
  });

  await t.test("batch4 mail suppression/revocation and frozen internal retries preserve eligibility", async () => {
    const space = await workspace("Mail policy");
    await adminDb.workspaceBilling.update({ where: { workspaceId: space.id }, data: { paidThrough: new Date(Date.now() + 86400_000) } });
    const record = await records(space);
    let sends = 0;
    for (const state of ["suppressed", "accepted", "revoked"]) {
      const email = randomUUID() + "@example.test";
      const invite = await expect(await post(space, "/invites", { email, role: "member" }), 201);
      if (state === "suppressed") await adminDb.suppressedRecipient.create({ data: { email } });
      else await adminDb.invitation.update({ where: { id: invite.id }, data: { [state === "accepted" ? "acceptedAt" : "revokedAt"]: new Date() } });
      await processMail(workerDb, async () => { sends++; }, credentials, space.id);
      assert.equal((await adminDb.mailJob.findFirstOrThrow({ where: { inviteId: invite.id } })).status, "canceled");
    }
    assert.equal(sends, 0);
    const job = await adminDb.internalNotification.create({ data: { workspaceId: space.id, cycleId: record.cycle.id,
      recipientId: second.id, recipient: second.email, kind: "client_activity", dedupeKey: randomUUID(),
      runAt: new Date(), expiresAt: new Date(Date.now() + 86400_000) } });
    let frozen;
    await processInternalMail(workerDb, async message => { frozen = message; throw new MailFailure(true, false); }, { workspaceId: space.id, credentials, deduplicated: true });
    const pending = await adminDb.internalNotification.findUniqueOrThrow({ where: { id: job.id } });
    assert.equal(pending.status, "pending");
    assert.ok(pending.messageCiphertext);
    await adminDb.renewalCycle.update({ where: { id: record.cycle.id }, data: { service: "Changed label" } });
    await adminDb.internalNotification.update({ where: { id: job.id }, data: { runAt: new Date(0) } });
    await processInternalMail(workerDb, async message => { assert.deepEqual(message, frozen); return { id: null, deduplicated: true }; }, { workspaceId: space.id, credentials, deduplicated: true });
    const sent = await adminDb.internalNotification.findUniqueOrThrow({ where: { id: job.id } });
    assert.equal(sent.status, "sent");
    assert.equal(sent.messageCiphertext, null);
    await adminDb.internalNotification.update({ where: { id: job.id }, data: {
      status: "leased", leaseToken: randomUUID(), leaseUntil: new Date(0), firstAttemptAt: null, messageCiphertext: null,
    } });
    await processInternalMail(workerDb, async () => { throw new Error("An unverifiable old send must not be retried"); },
      { workspaceId: space.id, credentials, deduplicated: true });
    assert.equal((await adminDb.internalNotification.findUniqueOrThrow({ where: { id: job.id } })).status, "uncertain");
    await assert.rejects(() => adminDb.internalNotification.create({ data: { workspaceId: space.id, cycleId: randomUUID(),
      recipientId: second.id, recipient: second.email, kind: "client_activity", dedupeKey: randomUUID(), runAt: new Date(), expiresAt: new Date(Date.now() + 10000) } }));
  });
}
