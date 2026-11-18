import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword as hashLegacy } from "better-auth/crypto";
import { hashPassword, verifyPassword } from "../packages/domain/passwords";

test("versioned password hashing preserves legacy verification without accepting malformed hashes", async () => {
  const password = "Synthetic-Password-24!";
  const legacy = await hashLegacy(password);
  const current = await hashPassword(password);
  assert.ok(current.startsWith("rr-scrypt-v1$"));
  for (const hash of [legacy, current]) {
    assert.equal(await verifyPassword({ hash, password }), true);
    assert.equal(await verifyPassword({ hash, password: password + "wrong" }), false);
  }
  assert.equal(await verifyPassword({ hash: "rr-scrypt-v1$bad$bad", password }), false);
});
