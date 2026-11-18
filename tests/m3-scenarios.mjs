import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { processDecisionMail } from "../apps/worker/decision-mail.ts";
import { processMailEvents } from "../apps/worker/mail-events.ts";
import { scheduleWorkspaceMail } from "../apps/worker/internal-mail.ts";
import { InviteCredentials } from "../packages/domain/invite-credentials.ts";
import { MailFailure } from "../packages/integrations/transactional-mail.ts";
import { addDays, localToday } from "../packages/domain/renewal-dates.ts";

export async function m3Scenarios(t, { api, expect, second, adminDb, workerDb, origin }) {
  const credentials = new InviteCredentials(Buffer.from(process.env.INVITE_ENCRYPTION_KEY, "base64url"));
  const workspace = await expect(await api("/api/v1/workspaces", {
    method: "POST", cookie: second.cookie, body: { name: "Delivery recovery", timezone: "Asia/Kolkata" },
  }), 201);
  const root = "/api/v1/workspaces/" + workspace.id;
  const post = (path, body) => api(root + path, { method: "POST", cookie: second.cookie, body });
  const client = await expect(await post("/clients", { name: "Recovery customer" }), 201);
  const email = `recovery-${randomUUID()}@example.test`;
  const contact = await expect(await post(`/clients/${client.id}/contacts`, { name: "Recovery contact", email }), 201);
  const today = localToday("Asia/Kolkata");
  const created = await expect(await post("/items", {
    clientId: client.id, operatorId: second.id, service: "=HYPERLINK(test)", provider: "Recovery Host",
    expiryOn: addDays(today, 60), respondBy: addDays(today, 15), payer: "client",
    currency: "INR", clientQuoteMinor: 10000, term: "Annual", recurrence: "yearly",
  }), 201);
  const request = await expect(await post(`/cycles/${created.cycle.id}/requests`, {
    contactId: contact.id, expectedVersion: 1,
  }), 201);

  await t.test("scheduled reminders retain revision scope and replay one logical provider send after a crash", async () => {
    const jobs = await adminDb.decisionDelivery.findMany({ where: { requestId: request.requestId }, orderBy: { runAt: "asc" } });
    assert.equal(jobs.length, 3);
    assert.equal(jobs.filter(job => job.kind === "reminder").length, 2);
    const job = jobs[0];
    const accepted = new Map();
    const fakeProvider = async message => {
      if (!accepted.has(message.id)) accepted.set(message.id, { text: message.text, id: randomUUID(), message });
      assert.equal(accepted.get(message.id).text, message.text);
      return { id: accepted.get(message.id).id, deduplicated: true };
    };
    await processDecisionMail(workerDb, fakeProvider, credentials, origin, true);
    const sent = await adminDb.decisionDelivery.findUniqueOrThrow({ where: { id: job.id } });
    assert.equal(sent.status, "sent");
    assert.equal(sent.ciphertext, null);
    // Simulate restoring a queue record whose mail was already accepted at the provider.
    await adminDb.decisionDelivery.update({ where: { id: job.id }, data: {
      status: "leased", ciphertext: job.ciphertext, providerId: null,
      messageCiphertext: credentials.encrypt(JSON.stringify(accepted.get(job.id).message), job.id),
      leaseToken: randomUUID(), leaseUntil: new Date(Date.now() - 1000),
    } });
    await processDecisionMail(workerDb, fakeProvider, credentials, origin, true);
    assert.equal(accepted.size, 1);
    const restored = await adminDb.decisionDelivery.findUniqueOrThrow({ where: { id: job.id } });
    assert.equal(restored.providerId, sent.providerId);

    // A second reminder has a frozen payload and retries on definite transient rejection.
    const reminder = jobs[1];
    await adminDb.decisionDelivery.update({ where: { id: reminder.id }, data: { runAt: new Date() } });
    await processDecisionMail(workerDb, async () => { throw new MailFailure(true, false); }, credentials, origin, true);
    const retry = await adminDb.decisionDelivery.findUniqueOrThrow({ where: { id: reminder.id } });
    assert.equal(retry.status, "pending");
    assert.ok(retry.runAt > new Date());
    assert.equal(retry.ciphertext, reminder.ciphertext);
    await adminDb.decisionDelivery.update({ where: { id: reminder.id }, data: { runAt: new Date() } });
    await processDecisionMail(workerDb, fakeProvider, credentials, origin, true);
    assert.equal(accepted.size, 2);
    await scheduleWorkspaceMail(workerDb);
    await scheduleWorkspaceMail(workerDb);
    const internal = await adminDb.internalNotification.findMany({ where: { workspaceId: workspace.id, cycleId: created.cycle.id } });
    assert.ok(internal.length > 0);
    assert.equal(internal.length, new Set(internal.map(job => job.dedupeKey)).size);

    const exported = await api(root + "/exports/renewals.csv", { cookie: second.cookie });
    assert.equal(exported.status, 200);
    assert.match(await exported.text(), /"\t=HYPERLINK\(test\)"/);
  });

  await t.test("signed duplicate and out-of-order delivery events persist once and suppression wins", async () => {
    const job = await adminDb.decisionDelivery.findFirstOrThrow({
      where: { requestId: request.requestId, providerId: { not: null } },
    });
    const sendEvent = async (id, type, signatureOverride) => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = JSON.stringify({ type, created_at: new Date().toISOString(),
        data: { email_id: job.providerId, tags: { delivery_id: job.id } } });
      const secret = Buffer.from(process.env.RESEND_WEBHOOK_SECRET.replace(/^whsec_/, ""), "base64");
      const signature = "v1," + createHmac("sha256", secret).update(`${id}.${timestamp}.${body}`).digest("base64");
      return fetch(origin + "/api/v1/webhooks/mail", { method: "POST", body, headers: {
        "content-type": "application/json", "svix-id": id, "svix-timestamp": timestamp,
        "svix-signature": signatureOverride ?? signature,
      } });
    };
    assert.equal((await sendEvent(randomUUID(), "email.bounced", "bad")).status, 400);
    const eventId = randomUUID();
    assert.equal((await sendEvent(eventId, "email.bounced")).status, 204);
    assert.equal((await sendEvent(eventId, "email.bounced")).status, 204);
    assert.equal(await adminDb.mailProviderEvent.count({ where: { id: eventId } }), 1);
    await processMailEvents(workerDb);
    assert.ok(await adminDb.suppressedRecipient.findUnique({ where: { email } }));
    assert.equal((await sendEvent(randomUUID(), "email.delivered")).status, 204);
    await processMailEvents(workerDb);
    assert.equal((await adminDb.decisionDelivery.findUniqueOrThrow({ where: { id: job.id } })).status, "suppressed");
    const remaining = await adminDb.decisionDelivery.count({
      where: { requestId: request.requestId, status: { in: ["pending", "leased"] } },
    });
    assert.equal(remaining, 0);
    const visible = await expect(await api(root + "/deliveries", { cookie: second.cookie }), 200);
    assert.ok(visible.items.some(job => job.status === "suppressed"));
  });

  await t.test("expired links reissue only to the original recipient and questions keep work open", async () => {
    const another = await expect(await post(`/clients/${client.id}/contacts`, {
      name: "Question contact", email: `question-${randomUUID()}@example.test`,
    }), 201);
    const item = await expect(await post("/items", {
      clientId: client.id, operatorId: second.id, service: "Question scenario", provider: "Example",
      expiryOn: addDays(today, 30), respondBy: addDays(today, 10), payer: "client",
      currency: "INR", clientQuoteMinor: 2500, term: "Monthly", recurrence: "once",
    }), 201);
    const issued = await expect(await post(`/cycles/${item.cycle.id}/requests`, { contactId: another.id, expectedVersion: 1 }), 201);
    const initial = await adminDb.decisionDelivery.findFirstOrThrow({ where: { requestId: issued.requestId, kind: "invitation" } });
    const token = credentials.decrypt(initial.ciphertext, issued.requestId);
    const digest = (await import("../packages/domain/invite-credentials.ts")).inviteDigest;
    await adminDb.decisionLink.update({ where: { digest: digest(token) }, data: { expiresAt: new Date(0) } });
    const publicPost = (route, body, key) => api("/api/v1/decisions/" + route, { method: "POST", body, key });
    await expect(await publicPost("preview", { token }), 410);
    const key = randomUUID();
    await expect(await publicPost("reissue", { token }, key), 200);
    await expect(await publicPost("reissue", { token }, key), 200);
    await expect(await publicPost("reissue", { token }), 429);
    const freshJob = await adminDb.decisionDelivery.findFirstOrThrow({ where: { requestId: issued.requestId, kind: "reissue" } });
    assert.equal(freshJob.recipient, another.email);
    const freshToken = credentials.decrypt(freshJob.ciphertext, issued.requestId);
    const exchanged = await api("/d/" + freshToken, { redirect: "manual" });
    assert.equal(exchanged.status, 303);
    const cookie = exchanged.headers.getSetCookie()[0].split(";")[0];
    const csrf = new URL(exchanged.headers.get("location")).hash.slice(1);
    const session = (route, body, key) => api("/api/v1/decisions/session/" + route, {
      method: "POST", cookie, headers: { "x-csrf-token": csrf }, body, key,
    });
    await expect(await session("otp/start", {}), 200);
    const challenge = await adminDb.decisionChallenge.findFirstOrThrow({ where: { requestId: issued.requestId } });
    // Set a known verifier for this failure/retry fixture after proving real SMTP codes in the main scenario.
    const code = "024680";
    const hash = createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(JSON.stringify([issued.requestId, code])).digest("hex");
    await adminDb.decisionChallenge.update({ where: { id: challenge.id }, data: { digest: hash } });
    const forwarded = await api("/d/" + freshToken, { redirect: "manual" });
    const forwardedCookie = forwarded.headers.getSetCookie()[0].split(";")[0];
    await expect(await api("/api/v1/decisions/session/otp/verify", {
      method: "POST", cookie: forwardedCookie, body: { code },
      headers: { "x-csrf-token": new URL(forwarded.headers.get("location")).hash.slice(1) },
    }), 403);
    await expect(await session("otp/verify", { code }), 200);
    await expect(await session("respond", { expectedVersion: 2, choice: "question", question: "Can you clarify the term?" }), 200);
    const waiting = await expect(await api(root + "/cycles/" + item.cycle.id, { cookie: second.cookie }), 200);
    assert.equal(waiting.cycle.state, "open");
    const notifications = await adminDb.internalNotification.count({ where: { workspaceId: workspace.id, cycleId: item.cycle.id, kind: "client_activity" } });
    assert.equal(notifications, 1);
    await expect(await session("respond", { expectedVersion: 2, choice: "cancel" }), 200);
    const ready = await expect(await api(root + "/cycles/" + item.cycle.id, { cookie: second.cookie }), 200);
    assert.equal(ready.cycle.state, "ready");
    assert.equal(ready.cycle.intendedAction, "cancel");
    await expect(await api("/d", { cookie }), 410);
    await expect(await publicPost("reissue", { token }), 410);
  });

  await t.test("closed cycles cancel pending mail and SMTP crashes become reconciliation exceptions", async () => {
    // Expired SMTP lease cannot be retried without knowing whether it was accepted.
    const job = await adminDb.decisionDelivery.findFirstOrThrow({ where: { requestId: request.requestId } });
    await adminDb.decisionDelivery.update({ where: { id: job.id }, data: {
      status: "leased", leaseToken: randomUUID(), leaseUntil: new Date(Date.now() - 1000),
    } });
    await processDecisionMail(workerDb, async () => { throw new Error("Must not send"); }, credentials, origin, false);
    assert.equal((await adminDb.decisionDelivery.findUniqueOrThrow({ where: { id: job.id } })).status, "uncertain");
    await expect(await post(`/items/${created.item.id}/archive`, {
      expectedVersion: 1, abandonReason: "Synthetic recovery completed",
    }), 200);
  });
}
