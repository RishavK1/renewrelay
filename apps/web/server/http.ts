import { limitRequest } from "./rate-limits";
import { requestId as currentRequestId, logError } from "../../../packages/operations/telemetry";
import type { z } from "zod";
import { idempotencyKey, page } from "../../../packages/contracts/api";
import type { Actor, Command } from "../../../packages/domain/context";
import { DomainError } from "../../../packages/domain/errors";
import { runtime } from "./runtime";

export type RouteParams<K extends string> = { params: Promise<Record<K, string>> };

function response(payload: unknown, status: number) {
  return Response.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

async function respond(run: (requestId: string) => Promise<unknown>, status: number) {
  const requestId = currentRequestId();
  try {
    const result = await run(requestId);
    return result instanceof Response ? result : response({ data: result }, status);
  } catch (error) {
    if (error instanceof DomainError) {
      const { code, message, fieldErrors } = error;
      const result = response({ error: { code, message, fieldErrors, requestId } }, error.status);
      if (error.status === 429) result.headers.set("Retry-After", String(error.retryAfter));
      return result;
    }
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "P2024" || code === "P2028" || code === "P2034") {
      return response({ error: { code: "temporarily_unavailable", message: "Retry shortly with the same key.", requestId } }, 503);
    }
    logError("web", "business_request", error);
    return response({ error: { code: "internal_error", message: "The request could not be completed.", requestId } }, 500);
  }
}

export function parse<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const fields: Record<string, string[]> = Object.create(null);
  for (const { path, message } of result.error.issues) {
    const field = path.join(".") || "_request";
    (fields[field] ??= []).push(message);
  }
  throw new DomainError(400, "invalid_request", "Check the request fields.", fields);
}

export function query<S extends z.ZodType>(request: Request, schema: S) {
  const params = new URL(request.url).searchParams;
  for (const key of params.keys()) {
    if (params.getAll(key).length !== 1) throw new DomainError(400, "invalid_request", "Repeated query parameter.");
  }
  return parse(schema, Object.fromEntries(params));
}

export function pagination(request: Request) {
  return query(request, page);
}

async function actor(request: Request): Promise<Actor> {
  const session = await runtime().auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });
  if (!session) throw new DomainError(401, "unauthenticated", "Sign in to continue.");
  if (!session.user.emailVerified) throw new DomainError(403, "email_unverified", "Verify your email to continue.");
  if (session.user.twoFactorEnabled && !session.session.mfaVerifiedAt) {
    throw new DomainError(403, "mfa_required", "Verify two-factor authentication for this session.");
  }
  return { id: session.user.id, email: session.user.email.toLowerCase(), authenticatedAt: session.session.createdAt,
    mfaVerified: !!session.user.twoFactorEnabled && !!session.session.mfaVerifiedAt };
}

async function readBody(request: Request, maxBytes: number, format = "json") {
  if (Number(request.headers.get("content-length")) > maxBytes) {
    throw new DomainError(413, "body_too_large", "The request body is too large.");
  }
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        void reader.cancel().catch(() => undefined);
        throw new DomainError(413, "body_too_large", "The request body is too large.");
      }
      chunks.push(value);
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError(400, `invalid_${format}`, "Send a valid UTF-8 request body.");
  } finally {
    reader.releaseLock();
  }
}

export async function readJsonText(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    throw new DomainError(415, "unsupported_media_type", "Send a JSON request body.");
  }
  return readBody(request, 8 * 1024);
}

export function read(request: Request, run: (currentActor: Actor) => Promise<unknown>) {
  return respond(async () => {
    const currentActor = await actor(request);
    await limitRequest(request, "read", currentActor);
    return run(currentActor);
  }, 200);
}

function checkOrigin(request: Request) {
  // An exact Origin protects cookie-authenticated mutations.
  if (request.headers.get("origin") !== runtime().origin) {
    throw new DomainError(403, "invalid_origin", "Send the request from the configured origin.");
  }
}

export function uploadCsv(request: Request, maxBytes: number, run: (currentActor: Actor, csv: string) => Promise<unknown>) {
  return respond(async () => {
    checkOrigin(request);
    const currentActor = await actor(request);
    await limitRequest(request, "import", currentActor);
    if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "text/csv") {
      throw new DomainError(415, "unsupported_media_type", "Send a UTF-8 text/csv request body.");
    }
    return run(currentActor, await readBody(request, maxBytes, "csv"));
  }, 200);
}

function runCommand<Input>(
  request: Request,
  operation: string,
  readInput: () => Promise<Input>,
  run: (cmd: Command, input: Input) => Promise<unknown>,
  status: number,
) {
  return respond(async (requestId) => {
    checkOrigin(request);
    const currentActor = await actor(request);
    await limitRequest(request, "write", currentActor);
    const key = parse(idempotencyKey, request.headers.get("idempotency-key"));
    const input = await readInput();
    const target = new URL(request.url).pathname;
    return run({ actor: currentActor, key, requestId, operation, input: { target, body: input ?? null } }, input);
  }, status);
}

export function write<S extends z.ZodType>(
  request: Request,
  operation: string,
  schema: S,
  run: (cmd: Command, input: z.output<S>) => Promise<unknown>,
  status = 200,
) {
  return runCommand(request, operation, () => parseJson(request, schema), run, status);
}

async function parseJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
  const text = await readJsonText(request);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new DomainError(400, "invalid_json", "Send a valid JSON request body.");
  }
  return parse(schema, value);
}

export function writeOptionalJson<S extends z.ZodType>(
  request: Request, operation: string, schema: S, run: (cmd: Command, body?: z.output<S>) => Promise<unknown>,
) {
  return runCommand(request, operation, async () => {
    if (request.headers.has("content-type")) return parseJson(request, schema);
    await readBody(request, 0);
    return undefined;
  }, run, 200);
}

export function writeWithoutBody(request: Request, operation: string, run: (cmd: Command) => Promise<unknown>) {
  return runCommand(request, operation, async () => {
    await readBody(request, 0);
    return null;
  }, run, 200);
}

export function publicCommand<S extends z.ZodType>(
  request: Request, schema: S, run: (input: z.output<S>, key: string) => Promise<unknown>,
) {
  return respond(async () => {
    checkOrigin(request);
    await limitRequest(request, "public");
    const key = parse(idempotencyKey, request.headers.get("idempotency-key"));
    return run(await parseJson(request, schema), key);
  }, 200);
}

export const boundedText = readBody;
