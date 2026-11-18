import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { createInvitation, createWorkspace, page, updateContact } from "../packages/contracts/api";
import { generateInviteToken, InviteCredentials, inviteDigest } from "../packages/domain/invite-credentials";

test("workspace input requires an IANA timezone and rejects unknown keys", () => {
  assert.deepEqual(createWorkspace.parse({ name: "  Agency  ", timezone: "Asia/Kolkata" }), {
    name: "Agency",
    timezone: "Asia/Kolkata",
  });
  assert.equal(createWorkspace.safeParse({ name: "Agency", timezone: "+05:30" }).success, false);
  assert.equal(createWorkspace.safeParse({ name: "Agency", timezone: "Asia/Unknown" }).success, false);
  assert.equal(createWorkspace.safeParse({ name: "Agency", timezone: "UTC", role: "owner" }).success, false);
});

test("client and contact inputs enforce version, roles and email normalization", () => {
  assert.deepEqual(createInvitation.parse({ email: "Staff@Example.test", role: "member" }), {
    email: "staff@example.test",
    role: "member",
  });
  assert.equal(createInvitation.safeParse({ email: "a@example.test", role: "owner" }).success, false);
  assert.equal(updateContact.safeParse({ name: "Staff", email: "a@example.test", expectedVersion: 0 }).success, false);
  assert.equal(page.safeParse({ limit: "101" }).success, false);
  assert.equal(page.parse({ limit: "100" }).limit, 100);
});

test("invitation credentials are random and ciphertext is authenticated and bound to one invitation", () => {
  const credentials = new InviteCredentials(randomBytes(32));
  const token = generateInviteToken();
  const encrypted = credentials.encrypt(token, "invite-a");
  assert.equal(token.length, 43);
  assert.notEqual(token, generateInviteToken());
  assert.notEqual(encrypted, credentials.encrypt(token, "invite-a"));
  assert.equal(inviteDigest(token).length, 64);
  assert.equal(credentials.decrypt(encrypted, "invite-a"), token);
  assert.throws(() => credentials.decrypt(encrypted, "invite-b"));
  const tampered = Buffer.from(encrypted, "base64url");
  tampered[12] = (tampered[12] ?? 0) ^ 1;
  assert.throws(() => credentials.decrypt(tampered.toString("base64url"), "invite-a"));
});
