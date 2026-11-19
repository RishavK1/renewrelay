import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
await mkdir(join(root, ".next"), { recursive: true });
const directory = await mkdtemp(join(root, ".next", "team-unit-"));
after(() => rm(directory, { recursive: true, force: true }));
const output = join(directory, "team.mjs");
await build({ stdin: { contents: `
export * from "./packages/ui/team/policy";
export { TeamDirectory } from "./packages/ui/team/team-directory";
export { TeamForm } from "./packages/ui/team/team-form";
export { AcceptTeamInvitation } from "./packages/ui/team/accept-invitation";
export { createInvitation, transferOwnership } from "./packages/contracts/api";
export { removal } from "./packages/contracts/renewals";
`, resolveDir: root }, outfile: output, bundle: true, packages: "external", platform: "node", format: "esm", jsx: "automatic", logLevel: "silent" });
const ui = await import(pathToFileURL(output).href);
const access = { actorId: "owner", role: "owner", writable: true, deleting: false, recentAuth: true };
const workspace = { id: "00000000-0000-4000-8000-000000000001", name: "Sample workspace", timezone: "Asia/Kolkata", version: 3, role: "owner" };
const members = [{ userId: "owner", email: "owner@sample.example", role: "owner", joinedAt: "2026-10-01T00:00:00Z" }, { userId: "member", email: "staff@sample.example", role: "member", joinedAt: "2026-10-02T00:00:00Z" }];
const invite = { id: "70000000-0000-4000-8000-000000000001", email: "invited@sample.example", role: "member", expiresAt: "2026-01-01T00:00:00Z", acceptedAt: null, revokedAt: null };
const render = (Component, props) => renderToStaticMarkup(createElement(Component, props));
const action = async () => { throw new Error("Static rendering must not submit a command"); };

test("read-only safety capabilities match remove/revoke domain access mode", () => {
  const readonly = { ...access, writable: false };
  assert.equal(ui.canInviteTeam(readonly), false);
  assert.equal(ui.canTransferTeam(readonly), false);
  assert.equal(ui.canRemoveTeamMember(readonly, members[1]), true);
  assert.equal(ui.canRevokeTeamInvitation(readonly, invite), true);
  assert.equal(ui.canRemoveTeamMember(access, members[0]), false);
  assert.equal(ui.canRemoveTeamMember({ ...access, actorId: "member" }, members[1]), false);
  assert.equal(ui.canManageTeam({ ...access, role: "member" }), false);
  assert.equal(ui.canManageTeam({ ...access, deleting: true }), false);
});

test("expired unaccepted invites remain revocable; accepted/revoked invites are closed", () => {
  assert.equal(ui.invitationStatus(invite, Date.parse("2026-02-01")), "Expired");
  assert.equal(ui.canRevokeTeamInvitation(access, invite), true);
  assert.equal(ui.canRevokeTeamInvitation(access, { ...invite, acceptedAt: "2025-12-31T00:00:00Z" }), false);
  assert.equal(ui.canRevokeTeamInvitation(access, { ...invite, revokedAt: "2025-12-31T00:00:00Z" }), false);
});

test("member directory is not rendered to regular members", () => {
  const html = render(ui.TeamDirectory, { workspace, access: { ...access, role: "member" }, members, invitations: [invite] });
  assert.ok(html.includes("Team access is restricted"));
  assert.ok(!html.includes(members[1].email));
  assert.ok(!html.includes(invite.email));
});

test("read-only directory keeps safety links and hides invitation and transfer actions", () => {
  const html = render(ui.TeamDirectory, { workspace, access: { ...access, writable: false }, members, invitations: [invite] });
  assert.ok(html.includes("/team/members/member/remove"));
  assert.ok(html.includes(`/team/invitations/${invite.id}/revoke`));
  assert.ok(!html.includes('href="/team/invite"'));
  assert.ok(!html.includes('href="/team/transfer-ownership"'));
});

test("transfer form requires recent auth; owner/self removal cannot be reviewed", () => {
  const html = render(ui.TeamForm, { mode: "transfer", workspace, access: { ...access, recentAuth: false }, members, action });
  assert.ok(html.includes("Sign in again before transferring ownership"));
  assert.match(html, /type="submit" disabled=""/);
  const remove = render(ui.TeamForm, { mode: "remove", workspace, access, members, member: members[0], action });
  assert.match(remove, /type="submit" disabled=""/);
});

test("shared invitation/removal/transfer input schemas reject invented fields and roles", () => {
  assert.deepEqual(ui.createInvitation.parse({ email: "Staff@Sample.example", role: "admin" }), { email: "staff@sample.example", role: "admin" });
  assert.equal(ui.createInvitation.safeParse({ email: "staff@sample.example", role: "owner" }).success, false);
  assert.equal(ui.removal.safeParse({}).success, false); // absent body must be null at the action seam
  assert.equal(ui.removal.safeParse({ replacementUserId: "member", expectedVersion: 1 }).success, false);
  assert.equal(ui.transferOwnership.safeParse({ userId: "member", expectedVersion: 0 }).success, false);
});

test("acceptance landing discloses no workspace or assigned role before confirmation", () => {
  const html = render(ui.AcceptTeamInvitation, { account: { email: "invited@sample.example", emailVerified: true, mfaRequired: false, mfaVerified: false }, action });
  assert.ok(html.includes("Join your team"));
  assert.ok(html.includes("Accept invitation"));
  assert.ok(!html.includes(workspace.name));
  const signedOut = render(ui.AcceptTeamInvitation, { account: null, action });
  assert.ok(signedOut.includes("Sign in to continue"));
  assert.ok(!signedOut.includes(">Accept invitation</button>"));
});
