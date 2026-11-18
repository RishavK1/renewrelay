import assert from "node:assert/strict";
import test from "node:test";
import { webConfig, workerConfig } from "../packages/contracts/environment";
const common = { BETTER_AUTH_URL: "http://127.0.0.1:3547", INVITE_ENCRYPTION_KEY: "A".repeat(43),
  SMTP_URL: "smtp://127.0.0.1:3548", MAIL_FROM: "sender@example.test" };
const web = { ...common, DATABASE_URL: "postgresql://renewrelay_app:synthetic@127.0.0.1/local",
  AUTH_DATABASE_URL: "postgresql://renewrelay_auth:synthetic@127.0.0.1/local", BETTER_AUTH_SECRET: "synthetic".repeat(8) };
test("shared configuration rejects privileged DB credentials and invalid production flags without exposing values", () => {
  assert.equal(webConfig(web).RENEWRELAY_ENV, "local");
  assert.throws(() => webConfig({ ...web, DATABASE_URL: "postgresql://renewrelay_migrator:DO_NOT_PRINT@127.0.0.1/local" }), error =>
    error instanceof Error && error.message.includes("DATABASE_URL") && !error.message.includes("DO_NOT_PRINT"));
  assert.throws(() => webConfig({ ...web, RESEND_DEBUG: "true" }));
  assert.throws(() => webConfig({ ...web, RAZORPAY_BILLING_ENABLED: "true" }));
  assert.throws(() => webConfig({ ...web, RENEWRELAY_ENV: "production" }));
  assert.equal(workerConfig({ ...common, WORKER_DATABASE_URL: "postgresql://renewrelay_worker:synthetic@127.0.0.1/local" }).WORKER_MAIL_CONCURRENCY, 4);
  assert.throws(() => workerConfig({ ...common, WORKER_DATABASE_URL: web.DATABASE_URL }));
});
