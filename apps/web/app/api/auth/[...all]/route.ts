import { observeRoute } from "@renewrelay/operations/telemetry";
import { setTimeout as wait } from "node:timers/promises";
import { setActor } from "@renewrelay/db/database";
import { hashPassword } from "@renewrelay/domain/passwords";
import { randomUUID } from "node:crypto";
import { runtime } from "@server/runtime";
import { readJsonText } from "@server/http";
import { limitRequest } from "@server/rate-limits";
import { DomainError } from "@renewrelay/domain/errors";
import { consumeRate } from "@renewrelay/domain/rate-limits";
import { z } from "zod";

const readPaths = new Set(["/api/auth/get-session", "/api/auth/verify-email"]);
const writePaths = new Set([
  "/api/auth/sign-up/email", "/api/auth/sign-in/email", "/api/auth/sign-out",
  "/api/auth/send-verification-email", "/api/auth/request-password-reset", "/api/auth/reset-password",
  "/api/auth/two-factor/enable", "/api/auth/two-factor/verify-totp", "/api/auth/two-factor/verify-backup-code",
  "/api/auth/two-factor/generate-backup-codes", "/api/auth/two-factor/get-totp-uri",
]);
const verificationPaths = new Set(["/api/auth/two-factor/verify-totp", "/api/auth/two-factor/verify-backup-code"]);

async function handle(request: Request) {
  const started = performance.now();
  try {
    const path = new URL(request.url).pathname;
    const resetLink = /^\/api\/auth\/reset-password\/[A-Za-z0-9_-]{16,128}$/.test(path);
    if (request.method === "GET" ? !readPaths.has(path) && !resetLink : !writePaths.has(path)) {
      throw new DomainError(404, "not_found", "The requested resource was not found.");
    }
    await limitRequest(request, "auth");
    let body: string | undefined;
    if (request.method === "POST") {
      if (request.headers.get("origin") !== runtime().origin) throw new DomainError(403, "invalid_origin", "Use the configured origin.");
      body = await readJsonText(request);
      let input;
      try { input = JSON.parse(body); } catch { throw new DomainError(400, "invalid_json", "Send a JSON object."); }
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new DomainError(400, "invalid_request", "Send a JSON object.");
      if (input.trustDevice === true || (input.method !== undefined && input.method !== "totp")) {
        throw new DomainError(400, "invalid_request", "Use authenticator verification for each sign-in.");
      }
      if (["/api/auth/sign-up/email", "/api/auth/send-verification-email"].includes(path) && z.email().safeParse(input.email).success) {
        // Shared across IPs/replicas and checked before account lookup. The DB key
        // is HMAC'd; unknown and verified addresses receive the same limit.
        await consumeRate(runtime().db, runtime().decisionSecret,
          `identity-verification/${String(input.email).toLowerCase()}`, 3, 600_000);
      }
      if (path.includes("/two-factor/") && !verificationPaths.has(path)) {
        const session = await runtime().auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
        if (session?.user.twoFactorEnabled && !session.session.mfaVerifiedAt) throw new DomainError(403, "mfa_required", "Verify your current session first.");
        if (session && Date.now() - session.session.createdAt.getTime() > 600_000) throw new DomainError(403, "reauthentication_required", "Sign in again before changing security settings.");
      }
    }
    if (path === "/api/auth/sign-out") {
      // The identity library intentionally swallows deletion errors. Confirm DB
      // revocation first so clearing the browser cookie cannot hide an active,
      // replayable session when the database refuses the delete.
      const session = await runtime().auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
      if (session) await runtime().authDb.session.deleteMany({ where: { id: session.session.id, userId: session.user.id } });
    }
    const response = await runtime().auth.handler(body === undefined ? request : new Request(request.url, { method: "POST", headers: request.headers, body }));
    response.headers.set("Cache-Control", "no-store");
    if (response.ok && path === "/api/auth/sign-in/email" && body) {
      const input = JSON.parse(body);
      const result = await response.clone().json();
      if ((result.twoFactorRedirect || result.token || result.user) && typeof input.email === "string" && typeof input.password === "string") {
        const user = await runtime().authDb.user.findUnique({ where: { email: input.email.toLowerCase() } });
        const account = user && await runtime().authDb.account.findFirst({ where: { userId: user.id, providerId: "credential" } });
        if (account?.password && !account.password.startsWith("rr-scrypt-v1$")) {
          const password = await hashPassword(input.password);
          await runtime().authDb.account.updateMany({ where: { id: account.id, password: account.password }, data: { password } });
        }
      }
    }
    if (response.ok && path === "/api/auth/two-factor/generate-backup-codes") {
      const session = await runtime().auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
      if (session) await runtime().authDb.$transaction(async tx => {
        await setActor(tx, session.user.id);
        await tx.identitySecurityEvent.create({ data: { userId: session.user.id, event: "mfa.backup_rotated", details: {} } });
      });
    }
    if (response.ok && verificationPaths.has(path)) {
      const cookies = new Map((request.headers.get("cookie") ?? "").split(";").map(value => {
        const index = value.indexOf("="); return [value.slice(0, index).trim(), value.slice(index + 1)] as const;
      }));
      for (const value of response.headers.getSetCookie()) {
        const cookie = value.split(";")[0]!;
        const index = cookie.indexOf("="); cookies.set(cookie.slice(0, index), cookie.slice(index + 1));
      }
      const headers = new Headers(request.headers);
      headers.set("cookie", [...cookies].map(([key, value]) => `${key}=${value}`).join("; "));
      const session = await runtime().auth.api.getSession({ headers, query: { disableCookieCache: true } });
      if (session?.user.twoFactorEnabled) {
        await runtime().authDb.$transaction(async tx => {
          await setActor(tx, session.user.id);
          await tx.session.update({ where: { id: session.session.id }, data: { mfaVerifiedAt: new Date() } });
          await tx.identitySecurityEvent.create({ data: { userId: session.user.id,
            event: path.endsWith("verify-backup-code") ? "mfa.recovered" : "mfa.verified", details: { sessionId: session.session.id } } });
        });
      }
    }
    if (["/api/auth/sign-in/email", "/api/auth/sign-up/email", "/api/auth/request-password-reset"].includes(path)) {
      await wait(Math.max(0, 250 - (performance.now() - started)));
    }
    return response;
  } catch (error) {
    if (!(error instanceof DomainError)) {
      console.error("RenewRelay identity boundary failed", { name: error instanceof Error ? error.name : "UnknownError" });
    }
    const status = error instanceof DomainError ? error.status : 500;
    return Response.json({ error: { code: error instanceof DomainError ? error.code : "internal_error",
      message: error instanceof DomainError ? error.message : "The request could not be completed.", requestId: randomUUID() } },
      { status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": String(error instanceof DomainError ? error.retryAfter : 60) } : {}) } });
  }
}
const GETHandler = handle;
const POSTHandler = handle;

export const GET = observeRoute("/api/auth/{action}", GETHandler);

export const POST = observeRoute("/api/auth/{action}", POSTHandler);
