import assert from "node:assert/strict";
import test from "node:test";
import { signupAction, verifyEmail } from "../apps/web/components/auth/signup-action";

test("signup adapter uses only same-origin supported endpoints and normalizes safe outcomes", async t => {
  const calls: { url: string; init?: RequestInit }[] = [];
  let response = new Response(JSON.stringify({ user: { emailVerified: false }, token: null }));
  const mock = t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init }); return response;
  });
  const signal = new AbortController().signal;
  const command = { operation: "sign-up", name: "Sample", email: "sample@example.test", password: "Synthetic-password-42" } as const;
  assert.deepEqual(await signupAction(command, signal), { status: "success", next: "check-email" });
  assert.equal(calls[0]?.url, "/api/auth/sign-up/email");
  assert.equal(calls[0]?.init?.credentials, "same-origin");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), { name: command.name, email: command.email, password: command.password });
  response = new Response(JSON.stringify({ status: true }));
  assert.deepEqual(await signupAction({ operation: "send-verification", email: command.email }, signal), { status: "success" });
  assert.equal(calls[1]?.url, "/api/auth/send-verification-email");
  response = new Response("Sensitive provider failure", { status: 429, headers: { "X-Retry-After": "17" } });
  const limited = await signupAction(command, signal);
  assert.equal(limited.status === "error" && limited.retryAfterSeconds, 17);
  assert.ok(!JSON.stringify(limited).includes("Sensitive"));
  response = new Response("Sensitive stack", { status: 500 });
  assert.ok(!JSON.stringify(await signupAction(command, signal)).includes("Sensitive"));
  const count = calls.length;
  assert.equal((await signupAction({ operation: "sign-in", email: command.email, password: command.password }, signal)).status, "error");
  assert.equal(calls.length, count, "future operations must not be silently wired");
  response = new Response(JSON.stringify({ status: true }));
  assert.equal((await verifyEmail("synthetic-token")).status, "success");
  response = new Response(JSON.stringify({ status: false }));
  assert.equal((await verifyEmail("synthetic-token")).status, "error");
  response = new Response("invalid", { status: 401 });
  assert.equal((await verifyEmail("synthetic-token")).status, "error");
  mock.mock.restore();
});
