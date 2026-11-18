import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as wait } from "node:timers/promises";
import { transactionalMailer, MailFailure } from "../packages/integrations/transactional-mail";

test("mail requests retain send keys and classify bounded timeout versus definite rejection", async () => {
  const original = globalThis.fetch;
  const message = { id: "synthetic-send", to: "recipient@example.test", subject: "Synthetic", text: "Synthetic only" };
  try {
    globalThis.fetch = async (_url, options) => {
      assert.equal(new Headers(options?.headers).get("Idempotency-Key"), message.id);
      await wait(35);
      assert.equal(options?.signal?.aborted, true);
      throw options?.signal?.reason;
    };
    const send = transactionalMailer({ apiKey: "re_synthetic", smtpUrl: "smtp://127.0.0.1:3548", from: "sender@example.test", timeoutMs: 20 });
    await assert.rejects(() => send(message), error => error instanceof MailFailure && error.retryable && error.ambiguous);
    globalThis.fetch = async () => new Response(JSON.stringify({ name: "rate_limit_exceeded", statusCode: 429, message: "Synthetic" }), { status: 429 });
    await assert.rejects(() => send(message), error => error instanceof MailFailure && error.retryable && !error.ambiguous);
    globalThis.fetch = async () => new Response(JSON.stringify({ id: "synthetic_provider_id" }), { status: 200 });
    assert.equal((await send(message)).id, "synthetic_provider_id");
  } finally { globalThis.fetch = original; }
});
