import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { totp, authCookies } from "./mfa-helpers.mjs";
import { parseEnrollment } from "../apps/web/components/auth/enrollment-action.ts";

export async function enrollmentScenarios(t, { api, db, password }) {
  let email, userId, cookie, pending, originalCookie;
  const headers = value => ({ Cookie: value });
  const session = value => api("/api/auth/get-session", undefined, headers(value)).then(response => response.json());
  await t.test("enrollment page rejects missing sessions and requires recent verified login", async () => {
    assert.equal((await api("/setup-authenticator")).headers.get("location"), "/login");
    email = `enroll-${randomUUID()}@example.test`;
    assert.equal((await api("/api/auth/sign-up/email", { name: "Synthetic enrollment", email, password })).status, 200);
    const user = await db.user.update({ where: { email }, data: { emailVerified: true } }); userId = user.id;
    const login = await api("/api/auth/sign-in/email", { email, password }); assert.equal(login.status, 200);
    cookie = authCookies(login); originalCookie = cookie;
    const page = await api("/setup-authenticator", undefined, headers(cookie));
    assert.equal(page.status, 200); assert.match(page.headers.get("content-security-policy"), /nonce-/);
    const before = await session(cookie);
    await db.session.update({ where: { id: before.session.id }, data: { createdAt: new Date(Date.now() - 660_000) } });
    assert.equal((await api("/setup-authenticator", undefined, headers(cookie))).headers.get("location"), "/login?reauth=1");
    const stale = await api("/api/auth/two-factor/enable", { password }, headers(cookie));
    assert.equal(stale.status, 403); assert.equal((await stale.json()).error.code, "reauthentication_required");
    assert.equal((await api("/login?reauth=1", undefined, headers(cookie))).status, 200, "recent-auth UI must not redirect in a loop");
    await db.session.update({ where: { id: before.session.id }, data: { createdAt: new Date() } });
  });
  await t.test("wrong password creates no secret; enable stores encrypted material but does not activate MFA", async () => {
    const wrong = await api("/api/auth/two-factor/enable", { password: "Wrong-synthetic-passphrase" }, headers(cookie));
    assert.equal(wrong.status, 400); assert.equal(await db.twoFactor.count({ where: { userId } }), 0);
    const result = await api("/api/auth/two-factor/enable", { password, method: "totp" }, headers(cookie));
    assert.equal(result.status, 200); pending = parseEnrollment(await result.json(), email); assert.ok(pending);
    const stored = await db.twoFactor.findFirstOrThrow({ where: { userId } });
    assert.equal(stored.verified, false); assert.notEqual(stored.secret, pending.setupKey);
    assert.ok(!stored.backupCodes.includes(pending.recoveryCodes[0]));
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: userId } })).twoFactorEnabled, false);
    const current = await session(cookie); assert.equal(current.session.mfaVerifiedAt, null);
    const html = await (await api("/setup-authenticator", undefined, headers(cookie))).text();
    assert.ok(!html.includes(pending.setupKey)); assert.ok(!html.includes(pending.recoveryCodes[0]));
  });
  await t.test("pending setup can restart; stale key is replaced; wrong code never activates", async () => {
    const first = pending;
    const restarted = await api("/api/auth/two-factor/enable", { password, method: "totp" }, headers(cookie));
    assert.equal(restarted.status, 200); pending = parseEnrollment(await restarted.json(), email); assert.ok(pending);
    assert.notEqual(pending.setupKey, first.setupKey);
    assert.notDeepEqual(pending.recoveryCodes, first.recoveryCodes);
    const actual = await totp(pending.setupKey); const wrong = actual === "000000" ? "111111" : "000000";
    assert.equal((await api("/api/auth/two-factor/verify-totp", { code: wrong }, headers(cookie))).status, 401);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: userId } })).twoFactorEnabled, false);
  });
  await t.test("correct code activates MFA, rotates the session and prevents repeated setup", async () => {
    const confirmed = await api("/api/auth/two-factor/verify-totp", { code: await totp(pending.setupKey), trustDevice: false }, headers(cookie));
    assert.equal(confirmed.status, 200); cookie = authCookies(confirmed); assert.ok(cookie); assert.notEqual(cookie, originalCookie);
    const current = await session(cookie); assert.equal(current.user.twoFactorEnabled, true); assert.ok(current.session.mfaVerifiedAt);
    assert.equal(await session(originalCookie), null);
    assert.equal((await db.twoFactor.findFirstOrThrow({ where: { userId } })).verified, true);
    assert.equal((await api("/setup-authenticator", undefined, headers(cookie))).headers.get("location"), "/auth-complete");
    const repeated = await api("/api/auth/two-factor/enable", { password }, headers(cookie));
    assert.equal(repeated.status, 400); assert.equal((await repeated.json()).code, "TOTP_ALREADY_ENABLED");
    assert.equal((await api("/api/auth/two-factor/enable", { password }, { ...headers(cookie), Origin: "https://untrusted.invalid" })).status, 403);
    await api("/api/auth/sign-out", {}, headers(cookie));
  });
  await t.test("newly saved recovery code signs in exactly once after setup", async () => {
    const challenge = await api("/api/auth/sign-in/email", { email, password }); assert.equal(challenge.status, 200);
    assert.equal((await challenge.json()).twoFactorRedirect, true);
    const recover = await api("/api/auth/two-factor/verify-backup-code", { code: pending.recoveryCodes[0] }, headers(authCookies(challenge)));
    assert.equal(recover.status, 200); cookie = authCookies(recover);
    assert.ok((await session(cookie)).session.mfaVerifiedAt);
    await api("/api/auth/sign-out", {}, headers(cookie));
    const next = await api("/api/auth/sign-in/email", { email, password });
    assert.equal((await api("/api/auth/two-factor/verify-backup-code", { code: pending.recoveryCodes[0] }, headers(authCookies(next)))).status, 401);
  });
}
