import type { z } from "zod";
import type { createClient, updateClient, createContact, updateContact } from "../../contracts/api";

export type ClientDraft = z.infer<typeof createClient>;
export type ClientView = ClientDraft & { id: string; version: number; archivedAt: string | null };
export type ClientCreateResult =
  | { status: "success"; client: ClientView }
  | { status: "error"; code: string; message: string; fieldErrors?: Record<string, string[]>; retryAfterSeconds?: number; recovery?: "/login" | "/check-email" | "/two-factor" | "/setup-authenticator" };
/** Bind this action to the authorized workspace. Adapter owns URL, credentials,
 * Origin, JSON, same-key idempotent retries and response-envelope validation.
 */
export type ClientCreateAction = (draft: ClientDraft, signal: AbortSignal) => Promise<ClientCreateResult>;

export type ContactView = { id: string; clientId: string; name: string; email: string; version: number; archivedAt: string | null };
export type ClientRecordCommand =
  | { operation: "client.update"; clientId: string; input: z.infer<typeof updateClient> }
  | { operation: "contact.create"; clientId: string; input: z.infer<typeof createContact> }
  | { operation: "contact.update"; clientId: string; contactId: string; input: z.infer<typeof updateContact> };
export type ClientRecordResult = { status: "success"; record: ClientView | ContactView } | Extract<ClientCreateResult, { status: "error" }>;
export type ClientRecordAction = (command: ClientRecordCommand, signal: AbortSignal) => Promise<ClientRecordResult>;
export type ClientEditorTarget = { kind: "client"; client: ClientView } | { kind: "contact-create"; client: ClientView } | { kind: "contact-edit"; client: ClientView; contact: ContactView };
