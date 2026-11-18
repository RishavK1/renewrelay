import { consumeRate } from "../rate-limits";
import { revokeDecisions, revokeRequestAccess } from "./revocation";
import { requireResolvedQuestions } from "./questions";
import { requireOperational } from "../billing/policy";
import { scheduleClientReminders } from "../notifications/schedules";
import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "../../db/generated/client";
import type { Transaction } from "../../db/database";
import { setWorkspace, lockWorkspace } from "../../db/database";
import { allStaff, audit, checkVersion, once, type Command, withWorkspace } from "../context";
import { DomainError, notFound } from "../errors";
import { generateInviteToken, inviteDigest, type InviteCredentials } from "../invite-credentials";
import { findCycle } from "../renewals/records";
import { dateText, localToday, responseDeadline } from "../renewal-dates";


export function issue(db: PrismaClient, cmd: Command, workspaceId: string, cycleId: string,
  input: { contactId: string; expectedVersion: number; customerNote?: string }, credentials: InviteCredentials, secret: string) {
  return withWorkspace(db, cmd.actor, workspaceId, allStaff, true, ({ tx }) => once(tx, cmd, workspaceId, async () => {
    const { cycle, item } = await findCycle(tx, workspaceId, cycleId);
    checkVersion(cycle.version, input.expectedVersion);
    if (cycle.closedAt || cycle.state === "draft" || !cycle.respondBy || dateText(cycle.respondBy) < localToday(cycle.timezone) ||
      cycle.clientQuoteMinor === null || !cycle.term) {
      throw new DomainError(422, "invalid_transition", "Use an active cycle with a current response deadline, quote and term.");
    }
    await requireResolvedQuestions(tx, workspaceId, cycleId);
    const contact = await tx.contact.findFirst({ where: { workspaceId, id: input.contactId, clientId: item.clientId, archivedAt: null } });
    if (!contact) notFound();
    await consumeRate(tx, secret, "decision/issue/" + cycleId, 10, 3600_000);
    await consumeRate(tx, secret, "decision/recipient/" + contact.email, 120, 3600_000);
    const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    const previous = await tx.decisionRequest.aggregate({ where: { workspaceId, cycleId }, _max: { revision: true } });
    await revokeDecisions(tx, workspaceId, cycleId);
    // Date eligibility is also checked in the captured business timezone on every public command.
    const deadlineAt = responseDeadline(dateText(cycle.respondBy), cycle.timezone);
    const request = await tx.decisionRequest.create({ data: {
      workspaceId, cycleId, contactId: contact.id, revision: (previous._max.revision ?? 0) + 1,
      issuerId: cmd.actor.id, issuerLabel: workspace.name, recipientEmail: contact.email,
      service: cycle.service, currency: cycle.currency, amountMinor: cycle.clientQuoteMinor, term: cycle.term,
      respondBy: cycle.respondBy, expiryOn: cycle.expiryOn, noticeBy: cycle.noticeBy, deadlineAt, customerNote: input.customerNote,
    } });
    await scheduleClientReminders(tx, request, cycle.timezone, credentials);
    const token = generateInviteToken();
    const expiresAt = new Date(Math.min(deadlineAt.getTime(), Date.now() + 7 * 86400_000));
    await tx.decisionLink.create({ data: { workspaceId, requestId: request.id, digest: inviteDigest(token), validFrom: new Date(), expiresAt } });
    await tx.decisionDelivery.create({ data: {
      workspaceId, requestId: request.id, kind: "invitation", recipient: contact.email, runAt: new Date(), expiresAt,
      ciphertext: credentials.encrypt(token, request.id),
    } });
    const updated = await tx.renewalCycle.update({ where: { workspaceId_id: { workspaceId, id: cycleId } },
      data: { state: "open", intendedAction: null, nextActionOn: cycle.respondBy, version: { increment: 1 } } });
    await audit(tx, cmd, workspaceId, "decision.issued", cycleId, { requestId: request.id, revision: request.revision });
    return { requestId: request.id, revision: request.revision, version: updated.version, queued: true };
  }));
}

async function scoped<T>(db: PrismaClient, token: string, run: (tx: Transaction, request: Awaited<ReturnType<typeof resolve>>) => Promise<T>, allowExpired = false, allowDecided = false) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT set_config('renewrelay.decision_digest', ${inviteDigest(token)}, true)`;
    const link = await tx.decisionLink.findUnique({ where: { digest: inviteDigest(token) } });
    if (!link) notFound();
    await setWorkspace(tx, link.workspaceId);
    await lockWorkspace(tx, link.workspaceId);
    await requireOperational(tx, link.workspaceId);
    const request = await resolve(tx, link.id, allowExpired, allowDecided);
    return run(tx, request);
  });
}

async function resolve(tx: Transaction, linkId: string, allowExpired = false, allowDecided = false) {
  const link = await tx.decisionLink.findUniqueOrThrow({ where: { id: linkId }, include: { request: { include: { cycle: true, contact: true } } } });
  const { request } = link;
  if ((!allowDecided && request.decidedAt) || link.revokedAt || (!allowExpired && link.expiresAt <= new Date()) || link.validFrom > new Date() || request.supersededAt ||
    request.contact.archivedAt || request.recipientEmail !== request.contact.email ||
    request.cycle.closedAt || request.deadlineAt <= new Date() || dateText(request.respondBy) < localToday(request.cycle.timezone)) {
    throw new DomainError(410, "decision_unavailable", "This request is no longer available.");
  }
  return request;
}

export function preview(db: PrismaClient, token: string) {
  return scoped(db, token, async (_tx, r) => ({
    requestId: r.id, revision: r.revision, issuer: r.issuerLabel, service: r.service,
    currency: r.currency, amountMinor: r.amountMinor, term: r.term, respondBy: dateText(r.respondBy),
    timezone: r.cycle.timezone, expiryOn: r.expiryOn ? dateText(r.expiryOn) : null, noticeBy: r.noticeBy ? dateText(r.noticeBy) : null,
    note: r.customerNote, version: r.cycle.version, decided: !!r.decidedAt,
  }));
}

function codeDigest(secret: string, requestId: string, code: string) {
  return createHmac("sha256", secret).update(JSON.stringify([requestId, code])).digest("hex");
}

export async function startOtp(db: PrismaClient, token: string, secret: string, send: (to: string, code: string) => Promise<void>, sessionId?: string) {
  const result = await scoped(db, token, async (tx, r) => {
    if (r.decidedAt) throw new DomainError(410, "decision_unavailable", "This request is already completed.");
    if (await tx.suppressedRecipient.findUnique({ where: { email: r.recipientEmail } })) {
      throw new DomainError(422, "recipient_suppressed", "Ask your agency to update the recipient address.");
    }
    await consumeRate(tx, secret, "otp/recipient/" + r.recipientEmail, 10, 3600_000);
    const recent = await tx.decisionChallenge.count({ where: { workspaceId: r.workspaceId, requestId: r.id, createdAt: { gt: new Date(Date.now() - 3600_000) } } });
    const latest = await tx.decisionChallenge.findFirst({ where: { workspaceId: r.workspaceId, requestId: r.id }, orderBy: { createdAt: "desc" } });
    if (recent >= 5 || (latest && latest.createdAt.getTime() > Date.now() - 60_000)) {
      throw new DomainError(429, "otp_limit", "Wait before requesting another code.");
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await tx.decisionChallenge.create({ data: {
      workspaceId: r.workspaceId, requestId: r.id, sessionId: sessionId ?? randomUUID(), accessDigest: inviteDigest(sessionId ?? token),
      digest: codeDigest(secret, r.id, code), expiresAt: new Date(Date.now() + 600_000),
    } });
    return { email: r.recipientEmail, code };
  });
  await send(result.email, result.code);
  return { sent: true };
}

export async function respond(db: PrismaClient, token: string, secret: string, key: string,
  input: { code?: string; expectedVersion: number; choice: "approve" | "cancel" | "question"; question?: string }, sessionId?: string) {
  const result = await scoped(db, token, async (tx, r) => {
    const challenge = await tx.decisionChallenge.findFirst({ where: { workspaceId: r.workspaceId, requestId: r.id, accessDigest: inviteDigest(sessionId ?? token) }, orderBy: { createdAt: "desc" } });
    if (!challenge || challenge.expiresAt <= new Date() || challenge.attempts >= 5) {
      throw new DomainError(403, "otp_required", "Request a fresh verification code.");
    }
    const valid = input.code
      ? timingSafeEqual(Buffer.from(codeDigest(secret, r.id, input.code)), Buffer.from(challenge.digest))
      : !!challenge.verifiedAt;
    if (!valid) {
      await tx.decisionChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      return { error: true as const };
    }
    const hash = inviteDigest(JSON.stringify(input));
    const receiptKey = { workspaceId: r.workspaceId, requestId: r.id, sessionId: challenge.sessionId, key };
    const previous = await tx.decisionResponse.findUnique({ where: { workspaceId_requestId_sessionId_key: receiptKey } });
    if (previous) {
      if (previous.digest !== hash) throw new DomainError(409, "idempotency_conflict", "This key was used with different input.");
      return { id: previous.id, choice: previous.choice, version: previous.cycleVersion };
    }
    if (r.decidedAt) throw new DomainError(409, "already_decided", "This request already has a final response.");
    checkVersion(r.cycle.version, input.expectedVersion);
    await consumeRate(tx, secret, "decision/responses/" + r.id, 30, 3600_000);
    const final = input.choice !== "question";
    const updated = final ? await tx.renewalCycle.update({
      where: { workspaceId_id: { workspaceId: r.workspaceId, id: r.cycleId } },
      data: { state: "ready", intendedAction: input.choice === "approve" ? "renew" : "cancel",
        nextActionOn: r.cycle.noticeBy ?? r.cycle.expiryOn, version: { increment: 1 } },
    }) : r.cycle;
    const response = await tx.decisionResponse.create({ data: {
      ...receiptKey, digest: hash, choice: input.choice, question: input.question, cycleVersion: updated.version,
    } });
    if (final) await tx.decisionRequest.update({ where: { id: r.id }, data: { decidedAt: new Date() } });
    await tx.$queryRaw`SELECT set_config('renewrelay.actor_id', ${r.contactId}, true)`;
    await tx.auditEvent.create({ data: {
      workspaceId: r.workspaceId, actorId: r.contactId, entityId: r.cycleId,
      event: input.choice === "question" ? "decision.question" : "decision.responded",
      requestId: randomUUID(), details: { actorKind: "client_contact", requestId: r.id, revision: r.revision, responseId: response.id, choice: input.choice },
    } });
    const operator = await tx.membership.findFirst({
      where: { workspaceId: r.workspaceId, userId: r.cycle.operatorId, removedAt: null },
    });
    if (operator) await tx.internalNotification.create({ data: {
      workspaceId: r.workspaceId, cycleId: r.cycleId, recipientId: operator.userId, recipient: operator.email,
      kind: "client_activity", dedupeKey: "response/" + response.id, runAt: new Date(),
      expiresAt: new Date(Date.now() + 86400_000),
    } });
    if (final) await tx.decisionDelivery.updateMany({
      where: { workspaceId: r.workspaceId, requestId: r.id, status: { in: ["pending", "leased"] } },
      data: { status: "canceled", ciphertext: null, messageCiphertext: null, leaseToken: null, leaseUntil: null },
    });
    return { id: response.id, choice: response.choice, version: response.cycleVersion };
  }, false, true);
  if ("error" in result) throw new DomainError(403, "invalid_code", "The verification code is incorrect.");
  return result;
}

export async function verifyOtp(db: PrismaClient, token: string, secret: string, code: string, sessionId: string) {
  const valid = await scoped(db, token, async (tx, request) => {
    if (request.decidedAt) throw new DomainError(410, "decision_unavailable", "This decision has been completed.");
    const challenge = await tx.decisionChallenge.findFirst({
      where: { workspaceId: request.workspaceId, requestId: request.id, accessDigest: inviteDigest(sessionId) },
      orderBy: { createdAt: "desc" },
    });
    if (!challenge || challenge.expiresAt <= new Date() || challenge.attempts >= 5) {
      throw new DomainError(403, "otp_required", "Request a fresh verification code.");
    }
    if (!timingSafeEqual(Buffer.from(challenge.digest), Buffer.from(codeDigest(secret, request.id, code)))) {
      await tx.decisionChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      return false;
    }
    await tx.decisionChallenge.update({ where: { id: challenge.id }, data: { verifiedAt: new Date() } });
    return true;
  });
  if (!valid) throw new DomainError(403, "invalid_code", "The verification code is incorrect.");
  return { verified: true };
}

export function reissue(db: PrismaClient, token: string, key: string, credentials: InviteCredentials, secret: string) {
  return scoped(db, token, async (tx, request) => {
    if (request.decidedAt) throw new DomainError(410, "decision_unavailable", "This decision has been completed.");
    const dedupeKey = "reissue/" + request.id + "/" + key;
    const prior = await tx.decisionDelivery.findUnique({ where: { dedupeKey } });
    if (prior) return { queued: true };
    const recent = await tx.decisionDelivery.findMany({
      where: { workspaceId: request.workspaceId, requestId: request.id, kind: "reissue",
        runAt: { gt: new Date(Date.now() - 3600_000) } },
      orderBy: { runAt: "desc" }, take: 5,
    });
    if (recent.length >= 5 || (recent[0] && recent[0].runAt.getTime() > Date.now() - 60_000)) {
      throw new DomainError(429, "reissue_limit", "Wait before requesting another link.");
    }
    await consumeRate(tx, secret, "decision/recipient/" + request.recipientEmail, 120, 3600_000);
    const fresh = generateInviteToken();
    const expiresAt = new Date(Math.min(request.deadlineAt.getTime(), Date.now() + 7 * 86400_000));
    await tx.decisionLink.create({ data: {
      workspaceId: request.workspaceId, requestId: request.id, digest: inviteDigest(fresh), validFrom: new Date(), expiresAt,
    } });
    await tx.decisionDelivery.create({ data: {
      workspaceId: request.workspaceId, requestId: request.id, kind: "reissue", dedupeKey,
      recipient: request.recipientEmail, runAt: new Date(), expiresAt, ciphertext: credentials.encrypt(fresh, request.id),
    } });
    return { queued: true };
  }, true);
}

export function resend(db: PrismaClient, cmd: Command, workspaceId: string, cycleId: string, requestId: string,
  input: { expectedVersion: number }, credentials: InviteCredentials, secret: string) {
  return withWorkspace(db, cmd.actor, workspaceId, allStaff, true, ({ tx }) => once(tx, cmd, workspaceId, async () => {
    const { cycle } = await findCycle(tx, workspaceId, cycleId);
    checkVersion(cycle.version, input.expectedVersion);
    const request = await tx.decisionRequest.findFirst({
      where: { workspaceId, id: requestId, cycleId, supersededAt: null, decidedAt: null }, include: { contact: true },
    });
    if (!request) notFound();
    if (cycle.closedAt || cycle.state !== "open" || request.deadlineAt <= new Date() ||
      request.contact.archivedAt || request.recipientEmail !== request.contact.email) {
      throw new DomainError(410, "decision_unavailable", "Revise and issue an actionable request first.");
    }
    if (await tx.suppressedRecipient.findUnique({ where: { email: request.recipientEmail } })) {
      throw new DomainError(422, "recipient_suppressed", "Update the recipient address before resending.");
    }
    await consumeRate(tx, secret, "decision/resend/" + request.id, 3, 3600_000);
    await consumeRate(tx, secret, "decision/recipient/" + request.recipientEmail, 120, 3600_000);
    await revokeRequestAccess(tx, workspaceId, [request.id]);
    await scheduleClientReminders(tx, request, cycle.timezone, credentials);
    const token = generateInviteToken();
    const expiresAt = new Date(Math.min(request.deadlineAt.getTime(), Date.now() + 7 * 86400_000));
    await tx.decisionLink.create({ data: { workspaceId, requestId, digest: inviteDigest(token), validFrom: new Date(), expiresAt } });
    await tx.decisionDelivery.create({ data: { workspaceId, requestId, recipient: request.recipientEmail,
      kind: "resend", runAt: new Date(), expiresAt, ciphertext: credentials.encrypt(token, requestId) } });
    const updated = await tx.renewalCycle.update({ where: { workspaceId_id: { workspaceId, id: cycleId } }, data: { version: { increment: 1 } } });
    await audit(tx, cmd, workspaceId, "decision.resent", cycleId, { requestId, revision: request.revision });
    return { requestId, revision: request.revision, version: updated.version, queued: true };
  }));
}
