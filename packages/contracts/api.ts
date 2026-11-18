import { z } from "zod";

export const uuid = z.uuid();
export const version = z.number().int().min(1).max(2_147_483_646);
export const name = z.string().trim().min(1).max(120);
export const email = z.email().max(254).transform((value) => value.toLowerCase());
export const userId = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
export const idempotencyKey = z.string().min(8).max(128).regex(/^[a-zA-Z0-9._:-]+$/);

export const timezone = z.string().max(80).refine((value) => {
  if (!/^[a-zA-Z][a-zA-Z0-9_+/-]*$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "Use an IANA timezone");

export const createWorkspace = z.strictObject({ name, timezone });
export const createInvitation = z.strictObject({ email, role: z.enum(["admin", "member"]) });
export const acceptInvitation = z.strictObject({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });
export const transferOwnership = z.strictObject({ userId, expectedVersion: version });
export const createClient = z.strictObject({ name });
export const updateClient = z.strictObject({ name, expectedVersion: version });
export const archiveRecord = z.strictObject({ expectedVersion: version });
export const createContact = z.strictObject({ name, email });
export const updateContact = z.strictObject({ name, email, expectedVersion: version });
export const page = z.strictObject({
  after: uuid.optional(),
  limit: z.string().regex(/^(100|[1-9][0-9]?)$/).transform(Number).optional(),
});
