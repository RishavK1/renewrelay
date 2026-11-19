import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { SMTPServer } from "smtp-server";
import { SignJWT } from "jose";
import { openDatabase } from "../packages/db/database.ts";
import { loginScenarios } from "./login-scenarios.mjs";
import { enrollmentScenarios } from "./enrollment-scenarios.mjs";

// Run with npm run test:signup, which prepares an isolated migrated database.
test("signup and verification over HTTP, PostgreSQL runtime roles and loopback SMTP", { timeout: 120_000 }, async t => {
  const database = new URL(process.env.MIGRATION_DATABASE_URL ?? "");
  assert.ok(["127.0.0.1", "localhost"].includes(database.hostname));
  assert.match(database.pathname, /^\/renewrelay_audit_signup_/);
  const origin = "http://127.0.0.1:3547";
  const messages = [];
  let rejectMail = false;
  const smtp = new SMTPServer({ disabledCommands: ["AUTH", "STARTTLS"],
    onData(stream, session, callback) {
      const chunks = [];
      stream.on("data", chunk => chunks.push(chunk));
      stream.on("end", () => {
        if (rejectMail) { callback(Object.assign(new Error("Synthetic failure"), { responseCode: 550 })); return; }
        const raw = Buffer.concat(chunks).toString();
        const split = raw.indexOf("\r\n\r\n");
        const headers = raw.slice(0, split);
        const body = raw.slice(split + 4);
        const text = /content-transfer-encoding: base64/i.test(headers) ? Buffer.from(body, "base64").toString()
          : body.replace(/=\r\n/g, "").replace(/=([\dA-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
        messages.push({ to: session.envelope.rcptTo[0].address, text }); callback();
      });
      stream.on("error", callback);
    },
  });
  await new Promise((resolve, reject) => { smtp.once("error", reject); smtp.listen(3548, "127.0.0.1", resolve); });
  t.after(() => new Promise(resolve => smtp.close(resolve)));
  const secret = randomBytes(32).toString("base64url");
  const env = { ...process.env, NODE_ENV: "production", BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: secret,
    SMTP_URL: "smtp://127.0.0.1:3548", MAIL_FROM: "renewrelay@example.test", RENEWRELAY_ENV: "local",
    INVITE_ENCRYPTION_KEY: randomBytes(32).toString("base64url"), TRUSTED_CLIENT_IP_HEADER: "x-renewrelay-test-client-ip",
    OUTBOUND_MAIL_ENABLED: "false", RAZORPAY_BILLING_ENABLED: "false" };
  delete env.RESEND_API_KEY;
  delete env.NODE_OPTIONS;
  const logs = [];
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "apps/web", "--hostname", "127.0.0.1", "--port", "3547"], { env, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", chunk => logs.push(chunk.toString()));
  server.stderr.on("data", chunk => logs.push(chunk.toString()));
  t.after(async () => {
    if (server.exitCode === null) { const exited = once(server, "exit"); server.kill(); await exited; }
  });
  const db = openDatabase(process.env.MIGRATION_DATABASE_URL, 1);
  t.after(() => db.$disconnect());
  async function poll(get) {
    for (let i = 0; i < 150; i++) { const result = await get(); if (result) return result; await wait(200); }
    throw new Error("Timed out waiting for local fixture");
  }
  await poll(async () => { try { return (await fetch(origin + "/api/v1/health")).ok; } catch { return false; } });
  let sequence = 0;
  // Better Auth groups IPv6 clients by subnet; vary the subnet, not only host bits.
  const ip = () => `2001:db8:${(++sequence).toString(16)}::1`;
  const api = (path, body, extra = {}) => fetch(origin + path, { method: body ? "POST" : "GET", redirect: "manual",
    headers: { Origin: origin, "Content-Type": "application/json", "x-renewrelay-test-client-ip": ip(), ...extra }, body: body ? JSON.stringify(body) : undefined });
  const email = `signup-${randomUUID()}@example.test`;
  const password = "Synthetic-password-42!";
  const signup = { name: "Synthetic account", email, password };
  await t.test("HTML uses fresh nonces without relaxing API headers", async () => {
    const page = await fetch(origin + "/signup");
    assert.equal(page.status, 200);
    const policy = page.headers.get("content-security-policy");
    const nonce = policy.match(/'nonce-([^']+)'/)[1];
    assert.ok(!policy.includes("unsafe-inline") && !policy.includes("unsafe-eval"));
    assert.match(await page.text(), new RegExp(`nonce="${nonce}"`));
    const second = await fetch(origin + "/signup");
    assert.notEqual(second.headers.get("content-security-policy"), policy);
    const health = await fetch(origin + "/api/v1/health");
    assert.equal(health.headers.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'");
    assert.equal(page.headers.get("referrer-policy"), "no-referrer");
    assert.match(page.headers.get("cache-control"), /no-store/);
  });
  await t.test("signup creates one unverified identity, hashes password and grants no session", async () => {
    const response = await api("/api/auth/sign-up/email", signup);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).token, null);
    assert.ok(!response.headers.getSetCookie().some(value => value.includes("session_token=")));
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    assert.equal(user.emailVerified, false);
    const account = await db.account.findFirstOrThrow({ where: { userId: user.id } });
    assert.match(account.password, /^rr-scrypt-v1\$/);
    assert.notEqual(account.password, password);
    assert.equal((await api("/api/auth/get-session")).status, 200);
    assert.equal(await (await api("/api/auth/get-session")).json(), null);
    assert.equal((await api("/api/auth/sign-in/email", { email, password })).status, 403);
    assert.equal((await api("/api/v1/workspaces")).status, 401);
    assert.equal((await api("/api/auth/sign-up/email", signup)).status, 200);
    assert.equal(await db.user.count({ where: { email } }), 1);
  });
  let link;
  await t.test("local mail points to app origin with fragment credential; verification creates no session", async () => {
    const message = await poll(() => messages.find(message => message.to === email));
    assert.match(message.text, /expires in 1 hour/);
    link = new URL(message.text.match(/https?:\/\/\S+/)[0]);
    assert.equal(link.origin, origin); assert.equal(link.pathname, "/verify-email"); assert.equal(link.search, "");
    const token = new URLSearchParams(link.hash.slice(1)).get("token"); assert.ok(token);
    const result = await api(`/api/auth/verify-email?${new URLSearchParams({ token })}`);
    assert.equal(result.status, 200); assert.equal((await result.json()).status, true);
    assert.equal((await db.user.findUniqueOrThrow({ where: { email } })).emailVerified, true);
    assert.ok(!result.headers.getSetCookie().some(value => value.includes("session_token=")));
    assert.equal(await (await api("/api/auth/get-session")).json(), null);
    assert.equal((await api("/api/v1/workspaces")).status, 401);
    // Reopening a valid verification link is harmless and still grants no session.
    const reopened = await api(`/api/auth/verify-email?${new URLSearchParams({ token })}`);
    assert.equal(reopened.status, 200);
    assert.ok(!reopened.headers.getSetCookie().some(value => value.includes("session_token=")));
  });
  await t.test("tampered, expired and foreign callback links are rejected", async () => {
    assert.equal((await api("/api/auth/verify-email?token=invalid")).status, 401);
    const expired = await new SignJWT({ email }).setProtectedHeader({ alg: "HS256" }).setExpirationTime(Math.floor(Date.now() / 1000) - 60).sign(new TextEncoder().encode(secret));
    assert.equal((await api(`/api/auth/verify-email?${new URLSearchParams({ token: expired })}`)).status, 401);
    const token = new URLSearchParams(link.hash.slice(1)).get("token");
    assert.equal((await api(`/api/auth/verify-email?${new URLSearchParams({ token, callbackURL: "https://untrusted.invalid" })}`)).status, 403);
  });
  await t.test("cross-origin writes, mass assignment, weak passwords and excessive bodies do not bypass identity guards", async () => {
    assert.equal((await api("/api/auth/sign-up/email", signup, { Origin: "https://untrusted.invalid" })).status, 403);
    assert.equal((await api("/api/auth/sign-up/email", signup, { Origin: "" })).status, 403);
    assert.equal((await api("/api/auth/sign-up/email", { ...signup, email: `weak-${randomUUID()}@example.test`, password: "short" })).status, 400);
    const assignedEmail = `assign-${randomUUID()}@example.test`;
    assert.equal((await api("/api/auth/sign-up/email", { ...signup, email: assignedEmail, emailVerified: true, twoFactorEnabled: true, role: "owner" })).status, 200);
    const assigned = await db.user.findUniqueOrThrow({ where: { email: assignedEmail } });
    assert.equal(assigned.emailVerified, false); assert.ok(!assigned.twoFactorEnabled);
    assert.equal((await api("/api/auth/sign-up/email", { ...signup, name: "x".repeat(9000) })).status, 413);
  });
  await t.test("resends are generic and recipient-limited even when the IP changes", async () => {
    const unknown = `unknown-${randomUUID()}@example.test`;
    const before = messages.length;
    for (let i = 0; i < 3; i++) {
      const response = await api("/api/auth/send-verification-email", { email: unknown });
      assert.equal(response.status, 200); assert.deepEqual(await response.json(), { status: true });
    }
    const blocked = await api("/api/auth/send-verification-email", { email: unknown.toUpperCase() });
    assert.equal(blocked.status, 429); assert.ok(Number(blocked.headers.get("retry-after")) > 0);
    const verified = await api("/api/auth/send-verification-email", { email });
    assert.equal(verified.status, 200); assert.deepEqual(await verified.json(), { status: true });
    assert.equal(messages.length, before);
    const target = messages.find(message => message.to.startsWith("assign-"));
    assert.ok(target);
    const resent = await api("/api/auth/send-verification-email", { email: target.to });
    assert.equal(resent.status, 200);
    await poll(() => messages.filter(message => message.to === target.to).length === 2);
    rejectMail = true;
    const failed = await api("/api/auth/send-verification-email", { email: target.to });
    assert.equal(failed.status, 200);
    assert.deepEqual(await failed.json(), { status: true }, "SMTP outage must not expose whether an account exists");
    rejectMail = false;
    assert.equal((await db.user.findUniqueOrThrow({ where: { email: target.to } })).emailVerified, false);
  });
  await t.test("a failed initial email leaves an unverified account recoverable by resend", async () => {
    const recoveryEmail = `mail-recovery-${randomUUID()}@example.test`;
    rejectMail = true;
    try {
      assert.equal((await api("/api/auth/sign-up/email", { ...signup, email: recoveryEmail })).status, 200);
      assert.ok(!messages.some(message => message.to === recoveryEmail));
      assert.equal((await db.user.findUniqueOrThrow({ where: { email: recoveryEmail } })).emailVerified, false);
    } finally { rejectMail = false; }
    assert.equal((await api("/api/auth/send-verification-email", { email: recoveryEmail })).status, 200);
    const recovered = await poll(() => messages.find(message => message.to === recoveryEmail));
    const recoveredLink = new URL(recovered.text.match(/https?:\/\/\S+/)[0]);
    const token = new URLSearchParams(recoveredLink.hash.slice(1)).get("token");
    assert.ok(token);
    assert.equal((await api(`/api/auth/verify-email?${new URLSearchParams({ token })}`)).status, 200);
    assert.equal((await db.user.findUniqueOrThrow({ where: { email: recoveryEmail } })).emailVerified, true);
  });
  await loginScenarios(t, { api, db, origin, email, password });
  await enrollmentScenarios(t, { api, db, password });
  const allLogs = logs.join("");
  assert.ok(!allLogs.includes(password));
  assert.ok(!allLogs.includes(new URLSearchParams(link.hash.slice(1)).get("token")));
});
