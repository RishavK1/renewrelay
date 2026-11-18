import assert from "node:assert/strict";
import test from "node:test";
import { createSendLimiter } from "../apps/worker/dispatch";

test("one persistent limiter spaces concurrent mail starts across successive batches", async () => {
  const limit = createSendLimiter(50);
  const starts: number[] = [];
  const send = () => limit(async () => { starts.push(Date.now()); });
  await Promise.all([send(), send(), send()]);
  await Promise.all([send(), send()]);
  for (let index = 1; index < starts.length; index++) assert.ok(starts[index]! - starts[index - 1]! >= 19);
  assert.throws(() => createSendLimiter(0), RangeError);
});
