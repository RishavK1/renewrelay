import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { enrollMfa, totp, authCookies } from "./mfa-helpers.mjs";

export async function loginScenarios(t, { api, db, origin, email, password }) {
  const cookieHeaders = cookie => ({ Cookie: cookie });
  async function expect(response, status) { assert.equal(response.status, status); return response.json(); }
  const login = async (address = email, secret = password) => api("/api/auth/sign-in/email", { email: address, password: secret });
  const getSession = async cookie => (await api("/api/auth/get-session", undefined, cookieHeaders(cookie))).json();
  const signout = cookie => api("/api/auth/sign-out", {}, cookieHeaders(cookie));
  let person;
  await t.test("login blocks unverified/wrong credentials and server landing requires an actual session", async () => {
    assert.equal((await login(email, "Incorrect-synthetic-passphrase")).status, 401);
    const unknown = await login(`unknown-login-${randomUUID()}@example.test`);
    assert.equal(unknown.status, 401);
    const unverified = await db.user.findFirstOrThrow({ where: { emailVerified: false } });
    const blocked = await login(unverified.email);
    assert.equal(blocked.status, 403); assert.equal((await blocked.json()).code, "EMAIL_NOT_VERIFIED");
    const absent = await api("/auth-complete?mfaVerified=true");
    assert.equal(absent.status, 307); assert.equal(absent.headers.get("location"), "/login");
    const malformed = await api("/auth-complete", undefined, { Cookie: "better-auth.session_token=forged" });
    assert.equal(malformed.status, 307);
    const signedIn = await login(); const body = await expect(signedIn, 200);
    const cookie = authCookies(signedIn); assert.ok(cookie);
    const setCookie = signedIn.headers.getSetCookie().find(value => value.includes("session_token="));
    assert.ok(/HttpOnly/i.test(setCookie)); assert.ok(/SameSite=Lax/i.test(setCookie)); assert.ok(!/;\s*Domain=/i.test(setCookie));
    assert.equal((await getSession(cookie)).user.id, body.user.id);
    const landing = await api("/auth-complete", undefined, cookieHeaders(cookie));
    assert.equal(landing.status, 200); assert.match(landing.headers.get("content-security-policy"), /nonce-/);
    const html = await landing.text(); assert.ok(!html.includes(body.token));
    assert.ok(!html.includes("totpURI") && !html.includes("backupCodes"));
    assert.equal((await api("/login", undefined, cookieHeaders(cookie))).headers.get("location"), "/auth-complete");
    assert.equal((await api("/", undefined, cookieHeaders(cookie))).headers.get("location"), "/auth-complete");
    assert.equal((await api("/signup", undefined, cookieHeaders(cookie))).headers.get("location"), "/auth-complete");
    // MFA is still required to create an owner workspace even after basic login.
    const create = await api("/api/v1/workspaces", { name: "Denied", timezone: "UTC" }, { ...cookieHeaders(cookie), "Idempotency-Key": randomUUID() });
    assert.equal(create.status, 403);
    person = { id: body.user.id, email, cookie, headers: {} };
  });
  await t.test("real MFA enrollment fixture preserves existing server policy and protected session stamp", async () => {
    const fixtureApi = (path, options = {}) => api(path, options.body, { ...(options.cookie ? cookieHeaders(options.cookie) : {}), ...options.headers });
    person = await enrollMfa(fixtureApi, expect, person, password);
    const session = await getSession(person.cookie);
    assert.equal(session.user.twoFactorEnabled, true); assert.ok(session.session.mfaVerifiedAt);
    const row = await db.session.findUniqueOrThrow({ where: { id: session.session.id } });
    assert.ok(row.mfaVerifiedAt);
    // A legacy/full session with MFA enabled but no per-session stamp cannot pass.
    await db.session.update({ where: { id: row.id }, data: { mfaVerifiedAt: null } });
    assert.equal((await api("/auth-complete", undefined, cookieHeaders(person.cookie))).headers.get("location"), "/two-factor");
    assert.equal((await api("/api/v1/workspaces", undefined, cookieHeaders(person.cookie))).status, 403);
    await signout(person.cookie);
  });
  await t.test("password-only MFA challenge cannot access the landing; TOTP creates the stamped session", async () => {
    const challenge = await login(); const body = await expect(challenge, 200);
    assert.equal(body.twoFactorRedirect, true);
    const pending = authCookies(challenge);
    const challengeCookie = challenge.headers.getSetCookie().find(value => /two_factor=/.test(value));
    assert.ok(challengeCookie && /HttpOnly/i.test(challengeCookie) && /SameSite=Lax/i.test(challengeCookie));
    assert.equal(await getSession(pending), null);
    assert.equal((await api("/auth-complete", undefined, cookieHeaders(pending))).headers.get("location"), "/login");
    assert.equal((await api("/api/v1/workspaces", undefined, cookieHeaders(pending))).status, 401);
    const bypass = await api("/api/auth/two-factor/verify-totp", { code: await totp(person.totpSecret), trustDevice: true }, cookieHeaders(pending));
    assert.equal(bypass.status, 400);
    const actual = await totp(person.totpSecret); const wrong = actual === "000000" ? "111111" : "000000";
    const bad = await api("/api/auth/two-factor/verify-totp", { code: wrong }, cookieHeaders(pending));
    assert.equal(bad.status, 401); assert.equal(await getSession(pending), null);
    const verified = await api("/api/auth/two-factor/verify-totp", { code: await totp(person.totpSecret), trustDevice: false }, cookieHeaders(pending));
    await expect(verified, 200); const cookie = authCookies(verified);
    assert.ok((await getSession(cookie)).session.mfaVerifiedAt);
    assert.equal((await api("/auth-complete", undefined, cookieHeaders(cookie))).status, 200);
    assert.equal((await api("/api/auth/two-factor/verify-totp", { code: await totp(person.totpSecret) }, cookieHeaders(pending))).status, 401);
    await expect(await signout(cookie), 200);
    assert.equal(await getSession(cookie), null);
    assert.equal((await api("/auth-complete", undefined, cookieHeaders(cookie))).headers.get("location"), "/login");
  });
  await t.test("recovery sign-in consumes exactly one code and still stamps MFA", async () => {
    const first = await login(); const pending = authCookies(first);
    const recovered = await api("/api/auth/two-factor/verify-backup-code", { code: person.backupCodes[0], trustDevice: false }, cookieHeaders(pending));
    await expect(recovered, 200); const cookie = authCookies(recovered);
    assert.ok((await getSession(cookie)).session.mfaVerifiedAt);
    await signout(cookie);
    const second = await login();
    const replay = await api("/api/auth/two-factor/verify-backup-code", { code: person.backupCodes[0] }, cookieHeaders(authCookies(second)));
    assert.equal(replay.status, 401); assert.equal(await getSession(authCookies(second)), null);
    const another = await api("/api/auth/two-factor/verify-backup-code", { code: person.backupCodes[1] }, cookieHeaders(authCookies(second)));
    await expect(another, 200); await signout(authCookies(another));
  });
  await t.test("missing, expired and exhausted MFA challenges require a new sign-in", async () => {
    const noChallenge = await api("/api/auth/two-factor/verify-totp", { code: "000000" });
    assert.equal(noChallenge.status, 401); assert.equal((await noChallenge.json()).code, "INVALID_TWO_FACTOR_COOKIE");
    const expired = await login(); const pending = authCookies(expired);
    await db.verification.updateMany({ where: { value: person.id, identifier: { startsWith: "2fa-" } }, data: { expiresAt: new Date(0) } });
    assert.equal((await api("/api/auth/two-factor/verify-totp", { code: await totp(person.totpSecret) }, cookieHeaders(pending))).status, 401);
    const exhausted = authCookies(await login());
    const current = await totp(person.totpSecret); const wrong = current === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) assert.equal((await api("/api/auth/two-factor/verify-totp", { code: wrong }, cookieHeaders(exhausted))).status, 401);
    const capped = await api("/api/auth/two-factor/verify-totp", { code: await totp(person.totpSecret) }, cookieHeaders(exhausted));
    assert.equal(capped.status, 400); assert.equal((await capped.json()).code, "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE");
    assert.equal(await getSession(exhausted), null);
    // A new password challenge must not reset the account-wide failure budget.
    const another = authCookies(await login());
    for (let i = 0; i < 5; i++) assert.equal((await api("/api/auth/two-factor/verify-totp", { code: wrong }, cookieHeaders(another))).status, 401);
    const locked = await api("/api/auth/two-factor/verify-totp", { code: await totp(person.totpSecret) }, cookieHeaders(another));
    assert.equal(locked.status, 429); assert.equal((await locked.json()).code, "ACCOUNT_TEMPORARILY_LOCKED");
    assert.equal(await getSession(another), null);
  });
  await t.test("sign-out must not report success if database revocation fails", async () => {
    const failureEmail = `logout-failure-${randomUUID()}@example.test`;
    // Fixture-only creation uses real password signup, then verifies via admin so no
    // external inbox or account is involved in this database-failure regression.
    await expect(await api("/api/auth/sign-up/email", { name: "Synthetic logout failure", email: failureEmail, password }), 200);
    await db.user.update({ where: { email: failureEmail }, data: { emailVerified: true } });
    const signedIn = await login(failureEmail); await expect(signedIn, 200);
    const cookie = authCookies(signedIn);
    await db.$executeRaw`CREATE FUNCTION rr_test_reject_session_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS (SELECT 1 FROM auth_users WHERE id = OLD."userId" AND email LIKE 'logout-failure-%@example.test') THEN RAISE EXCEPTION 'Synthetic session deletion failure'; END IF; RETURN OLD; END; $$`;
    await db.$executeRaw`CREATE TRIGGER rr_test_delete_failure BEFORE DELETE ON auth_sessions FOR EACH ROW EXECUTE FUNCTION rr_test_reject_session_delete()`;
    try {
      assert.equal((await signout(cookie)).status, 500);
      assert.ok(await getSession(cookie), "Failed revocation must not be mistaken for a revoked session");
    } finally {
      await db.$executeRaw`DROP TRIGGER rr_test_delete_failure ON auth_sessions`;
      await db.$executeRaw`DROP FUNCTION rr_test_reject_session_delete()`;
    }
    await expect(await signout(cookie), 200);
    assert.equal(await getSession(cookie), null);
    assert.equal((await api("/auth-complete", undefined, cookieHeaders(cookie))).status, 307);
  });
  assert.ok(origin.startsWith("http://127.0.0.1:"));
}
