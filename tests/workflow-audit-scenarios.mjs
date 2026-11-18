import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { InviteCredentials, inviteDigest } from "../packages/domain/invite-credentials.ts";
import { addDays, localToday } from "../packages/domain/renewal-dates.ts";
import { setWorkspace } from "../packages/db/database.ts";
import { processDecisionMail } from "../apps/worker/decision-mail.ts";

export async function workflowAuditScenarios(t, { api, expect, second, staff, owner, other, adminDb, appDb, workerDb, origin }) {
  const workspace = await expect(await api("/api/v1/workspaces", {
    method: "POST", cookie: second.cookie, body: { name: "Workflow audit regressions", timezone: "Asia/Kolkata" },
  }), 201);
  const root = "/api/v1/workspaces/" + workspace.id;
  const read = (path, cookie = second.cookie) => api(root + path, { cookie });
  const send = (path, body, method = "POST", key = randomUUID(), cookie = second.cookie) =>
    api(root + path, { method, cookie, body, key });
  const client = await expect(await send("/clients", { name: "Workflow customer" }), 201);
  const credentials = new InviteCredentials(Buffer.from(process.env.INVITE_ENCRYPTION_KEY, "base64url"));
  const today = localToday("Asia/Kolkata");
  async function contact() {
    return expect(await send(`/clients/${client.id}/contacts`, {
      name: "Decision recipient", email: randomUUID() + "@example.test",
    }), 201);
  }
  async function item(label, mode = "activate") {
    return expect(await send("/items", {
      clientId: client.id, operatorId: second.id, service: label, provider: "Synthetic provider",
      expiryOn: addDays(today, 60), respondBy: addDays(today, 15), payer: "client", currency: "INR",
      clientQuoteMinor: 4200, supplierCostMinor: 2000, term: "Annual", recurrence: "once", mode,
    }), 201);
  }
  async function issue(cycleId, recipient, expectedVersion = 1) {
    const issued = await expect(await send(`/cycles/${cycleId}/requests`, { contactId: recipient.id, expectedVersion }), 201);
    const job = await adminDb.decisionDelivery.findFirstOrThrow({ where: { requestId: issued.requestId, kind: "invitation" } });
    return { ...issued, token: credentials.decrypt(job.ciphertext, issued.requestId) };
  }
  async function verifiedSession(issued) {
    const response = await api("/d/" + issued.token, { redirect: "manual" });
    assert.equal(response.status, 303);
    const cookie = response.headers.getSetCookie()[0].split(";")[0];
    const csrf = new URL(response.headers.get("location")).hash.slice(1);
    const call = (route, body, key) => api("/api/v1/decisions/session/" + route, {
      method: "POST", cookie, headers: { "x-csrf-token": csrf }, body, key,
    });
    await expect(await call("otp/start", {}), 200);
    const challenge = await adminDb.decisionChallenge.findFirstOrThrow({ where: { requestId: issued.requestId }, orderBy: { createdAt: "desc" } });
    const code = "135790";
    const digest = createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(JSON.stringify([issued.requestId, code])).digest("hex");
    await adminDb.decisionChallenge.update({ where: { id: challenge.id }, data: { digest } });
    await expect(await call("otp/verify", { code }), 200);
    return { call, cookie, code, challengeId: challenge.id };
  }
  const publicCall = (route, body) => api("/api/v1/decisions/" + route, { method: "POST", body });
  const waiting = async id => (await expect(await read(`/cycles?bucket=waiting_on_client&itemId=${id}`), 200)).items;

  await t.test("RR-01 contact A-B-A permanently revokes links, verified sessions, OTP and pending mail", async () => {
    const recipient = await contact();
    const pending = await item("Pending recipient change");
    const approved = await item("Approved recipient change");
    const closed = await item("Historical recipient change");
    const pendingRequest = await issue(pending.cycle.id, recipient);
    const approvedRequest = await issue(approved.cycle.id, recipient);
    const closedRequest = await issue(closed.cycle.id, recipient);
    const pendingSession = await verifiedSession(pendingRequest);
    const approvedSession = await verifiedSession(approvedRequest);
    await expect(await approvedSession.call("respond", { expectedVersion: 2, choice: "approve" }), 200);
    const closedSession = await verifiedSession(closedRequest);
    await expect(await closedSession.call("respond", { expectedVersion: 2, choice: "approve" }), 200);
    await expect(await send(`/cycles/${closed.cycle.id}/complete`, {
      expectedVersion: 3, outcome: "renewed", performedOn: today, providerReference: "SYNTHETIC-CLOSED",
    }), 200);
    const contactPath = `/clients/${client.id}/contacts/${recipient.id}`;
    await expect(await send(contactPath, { name: "Renamed only", email: recipient.email, expectedVersion: 1 }, "PATCH"), 200);
    await expect(await publicCall("preview", { token: pendingRequest.token }), 200);
    const changed = { name: recipient.name, email: randomUUID() + "@example.test", expectedVersion: 2 };
    await expect(await send(contactPath, { ...changed, expectedVersion: 1 }, "PATCH"), 409, "stale_version");
    await expect(await publicCall("preview", { token: pendingRequest.token }), 200);
    const key = randomUUID();
    const first = await expect(await send(contactPath, changed, "PATCH", key), 200);
    assert.deepEqual(await expect(await send(contactPath, changed, "PATCH", key), 200), first);
    await expect(await send(contactPath, { name: recipient.name, email: recipient.email, expectedVersion: 3 }, "PATCH"), 200);
    for (const issued of [pendingRequest, approvedRequest]) {
      await expect(await publicCall("preview", { token: issued.token }), 410);
      await expect(await publicCall("otp/start", { token: issued.token }), 410);
      await expect(await publicCall("reissue", { token: issued.token }), 410);
      await expect(await publicCall("respond", { token: issued.token, code: pendingSession.code, expectedVersion: 2, choice: "approve" }), 410);
      const request = await adminDb.decisionRequest.findUniqueOrThrow({ where: { id: issued.requestId } });
      assert.ok(request.supersededAt);
      assert.equal(await adminDb.decisionLink.count({ where: { requestId: issued.requestId, revokedAt: null } }), 0);
      assert.equal(await adminDb.decisionChallenge.count({ where: { requestId: issued.requestId, verifiedAt: { not: null } } }), 0);
      assert.equal(await adminDb.decisionDelivery.count({ where: { requestId: issued.requestId, status: { in: ["pending", "leased"] } } }), 0);
    }
    await expect(await pendingSession.call("respond", { expectedVersion: 2, choice: "approve" }), 401, "decision_session_expired");
    const reset = await expect(await read(`/cycles/${approved.cycle.id}`), 200);
    assert.equal(reset.cycle.state, "open");
    assert.equal(reset.cycle.intendedAction, null);
    assert.equal(reset.cycle.version, 4);
    assert.equal((await expect(await read(`/cycles/${closed.cycle.id}`), 200)).cycle.state, "renewed");
    assert.equal((await adminDb.decisionRequest.findUniqueOrThrow({ where: { id: closedRequest.requestId } })).supersededAt, null);
    assert.equal((await waiting(pending.item.id)).length, 0);
    assert.equal((await waiting(approved.item.id)).length, 0);
    await issue(pending.cycle.id, recipient, 3);
    assert.equal((await waiting(pending.item.id)).length, 1);
    await expect(await send(contactPath + "/archive", { expectedVersion: 4 }), 200);
    assert.equal((await waiting(pending.item.id)).length, 0);
    // Even restoring an old job cannot restore its authorization.
    const job = await adminDb.decisionDelivery.findFirstOrThrow({ where: { requestId: pendingRequest.requestId, kind: "invitation" } });
    await adminDb.decisionDelivery.update({ where: { id: job.id }, data: {
      status: "pending", ciphertext: credentials.encrypt(pendingRequest.token, pendingRequest.requestId), runAt: new Date(0),
    } });
    let oldSends = 0;
    await processDecisionMail(workerDb, async () => { oldSends++; return { id: null }; }, credentials, origin, false);
    assert.equal(oldSends, 0);
    assert.equal((await adminDb.decisionDelivery.findUniqueOrThrow({ where: { id: job.id } })).status, "canceled");
  });

  await t.test("RR-01 concurrent contact edit and response preserve the newer recipient intent", async () => {
    const recipient = await contact();
    const created = await item("Recipient response race");
    const issued = await issue(created.cycle.id, recipient);
    const session = await verifiedSession(issued);
    const [edit, response] = await Promise.all([
      send(`/clients/${client.id}/contacts/${recipient.id}`, {
        name: recipient.name, email: randomUUID() + "@example.test", expectedVersion: 1,
      }, "PATCH"),
      session.call("respond", { expectedVersion: 2, choice: "approve" }),
    ]);
    await expect(edit, 200);
    assert.ok([200, 401, 410].includes(response.status));
    await expect(response, response.status);
    const current = await expect(await read(`/cycles/${created.cycle.id}`), 200);
    assert.equal(current.cycle.state, "open");
    assert.equal(current.cycle.intendedAction, null);
    assert.equal((await waiting(created.item.id)).length, 0);
    await expect(await publicCall("preview", { token: issued.token }), 410);
  });

  await t.test("RR-02 staff retrieve paginated questions and must record an attributed resolution before revision", async () => {
    await adminDb.membership.create({ data: { workspaceId: workspace.id, userId: staff.id, email: staff.email, role: "member" } });
    const recipient = await contact();
    const created = await item("Question resolution");
    const path = `/cycles/${created.cycle.id}`;
    const request = await issue(created.cycle.id, recipient);
    const session = await verifiedSession(request);
    const questions = ["Can you clarify the term?", "Is migration included?"];
    const replies = [];
    for (const question of questions) replies.push(await expect(await session.call("respond", { expectedVersion: 2, choice: "question", question }), 200));
    const first = await expect(await read(path + "/responses?limit=1", staff.cookie), 200);
    assert.equal(first.items[0].question, questions[0]);
    assert.equal(first.items[0].request.revision, 1);
    assert.equal(first.items[0].request.recipientEmail, recipient.email);
    assert.equal(first.items[0].resolution, null);
    assert.equal(Object.hasOwn(first.items[0], "digest"), false);
    const next = await expect(await read(path + "/responses?limit=1&after=" + first.nextCursor), 200);
    assert.equal(next.items[0].question, questions[1]);
    assert.equal(next.nextCursor, null);
    await expect(await read(path + "/responses?after=" + randomUUID()), 400, "invalid_cursor");
    await expect(await read(path + "/responses?limit=101"), 400, "invalid_request");
    await expect(await api(root + path + "/responses"), 401);
    await expect(await read(path + "/responses", owner.cookie), 404);
    await expect(await api(`/api/v1/workspaces/${other.id}${path}/responses`, { cookie: second.cookie }), 404);
    const resolve = path + "/responses/" + replies[0].id + "/resolve";
    const note = "Confirmed annual term with the client by email.";
    await expect(await send(resolve, { expectedVersion: 2, note }, "POST", randomUUID(), owner.cookie), 404);
    await expect(await send(`/cycles/${randomUUID()}/responses/${replies[0].id}/resolve`, { expectedVersion: 2, note }), 404);
    await expect(await api(`/api/v1/workspaces/${other.id}${resolve}`, {
      method: "POST", cookie: second.cookie, body: { expectedVersion: 2, note },
    }), 404);
    await expect(await send(resolve, { expectedVersion: 2, note: " " }), 400, "invalid_request");
    await expect(await send(resolve, { expectedVersion: 1, note }), 409, "stale_version");
    await expect(await send(path + "/responses/" + randomUUID() + "/resolve", { expectedVersion: 2, note }), 404);
    await expect(await send(path + "/requests", { contactId: recipient.id, expectedVersion: 2 }), 409, "unresolved_questions");
    const key = randomUUID();
    const result = await expect(await send(resolve, { expectedVersion: 2, note }, "POST", key, staff.cookie), 200);
    assert.deepEqual(await expect(await send(resolve, { expectedVersion: 2, note }, "POST", key, staff.cookie), 200), result);
    await expect(await send(resolve, { expectedVersion: 2, note: "Changed" }, "POST", key, staff.cookie), 409, "idempotency_conflict");
    await expect(await send(resolve, { expectedVersion: 3, note }), 409, "question_resolved");
    await expect(await send(path + "/requests", { contactId: recipient.id, expectedVersion: 3 }), 409, "unresolved_questions");
    const secondResolution = path + "/responses/" + replies[1].id + "/resolve";
    const competing = await Promise.all([
      send(secondResolution, { expectedVersion: 3, note: "Migration confirmed." }),
      send(secondResolution, { expectedVersion: 3, note: "Migration confirmed." }),
    ]);
    assert.deepEqual(competing.map(response => response.status).sort(), [200, 409]);
    for (const response of competing) await expect(response, response.ok ? 200 : 409);
    await issue(created.cycle.id, recipient, 4);
    const history = await expect(await read(path + "/responses"), 200);
    assert.equal(history.items.length, 2);
    assert.equal(history.items[0].resolution.note, note);
    assert.equal(history.items[0].resolution.actorId, staff.id);
    assert.ok(history.items[0].request.supersededAt);
    const audit = await expect(await read(path + "/history"), 200);
    assert.ok(audit.items.some(event => event.event === "decision.question_resolved" && event.details.note === note));
    await adminDb.membership.update({ where: { workspaceId_userId: { workspaceId: workspace.id, userId: staff.id } }, data: { removedAt: new Date() } });
    await expect(await read(path + "/responses", staff.cookie), 404);
    await expect(await send(resolve, { expectedVersion: 5, note }, "POST", randomUUID(), staff.cookie), 404);
  });

  await t.test("RR-03 waiting queue tracks only a current issued undecided request", async () => {
    const recipient = await contact();
    const created = await item("Queue responsibility");
    assert.equal((await waiting(created.item.id)).length, 0);
    const issued = await issue(created.cycle.id, recipient);
    assert.equal((await waiting(created.item.id)).length, 1);
    const session = await verifiedSession(issued);
    await expect(await session.call("respond", { expectedVersion: 2, choice: "question", question: "Please explain." }), 200);
    assert.equal((await waiting(created.item.id)).length, 1);
    await expect(await session.call("respond", { expectedVersion: 2, choice: "approve" }), 200);
    assert.equal((await waiting(created.item.id)).length, 0);
    const withdrawn = await item("Withdrawn queue work");
    await issue(withdrawn.cycle.id, recipient);
    await expect(await send(`/cycles/${withdrawn.cycle.id}/withdraw`, { expectedVersion: 2, reason: "No longer needed" }), 200);
    assert.equal((await waiting(withdrawn.item.id)).length, 0);
    const draft = await item("Draft queue work", "draft");
    assert.equal((await waiting(draft.item.id)).length, 0);
    assert.equal(await appDb.decisionResponse.count(), 0);
    assert.equal(await appDb.decisionSession.count(), 0);
    await appDb.$transaction(async tx => {
      await setWorkspace(tx, other.id);
      assert.equal(await tx.decisionResponse.count({ where: { request: { cycleId: created.cycle.id } } }), 0);
      assert.equal(await tx.decisionSession.count({ where: { linkDigest: inviteDigest(issued.token) } }), 0);
    });
  });
}
