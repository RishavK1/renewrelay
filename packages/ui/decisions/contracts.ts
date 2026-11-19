import { z } from "zod";
import { respondDecision } from "../../contracts/decisions";
import type { issueDecision } from "../../contracts/decisions";

/** Mirrors the existing session/respond route, without legacy bearer input. */
export const sessionResponse = z.strictObject({ expectedVersion: z.number().int().min(1), choice: respondDecision.shape.choice, question: respondDecision.shape.question }).refine(value => (value.choice === "question") === !!value.question, "Supply question text only for a question.");
export type SessionResponse = z.infer<typeof sessionResponse>;
export type DecisionTerms = { requestId: string; revision: number; issuer: string; service: string; currency: string; amountMinor: number; term: string; respondBy: string; timezone: string; expiryOn: string | null; noticeBy: string | null; note: string | null; version: number; decided: boolean };
export type DecisionFailure = { status: "error"; code: string; message: string; retryAfterSeconds?: number };
/** Adapter owns workspace authorization, expected-version conflicts and a stable
 * idempotency key for retries of an unchanged payload. Queued is not delivered. */
export type IssueAction = (input: z.infer<typeof issueDecision>, signal: AbortSignal) => Promise<{ status: "success"; requestId: string; revision: number; version: number; queued: true } | DecisionFailure>;
export type PublicDecisionCommand = { operation: "start-code" } | { operation: "verify-code"; code: string } | { operation: "respond"; input: SessionResponse };
export type PublicDecisionResult = { status: "success"; kind: "code-started" } | { status: "success"; kind: "verified" } | { status: "success"; kind: "responded"; response: { id: string; choice: SessionResponse["choice"]; version: number } } | DecisionFailure;
/** App-origin adapter owns the exchanged HttpOnly session, fragment CSRF, Origin
 * and JSON headers, error envelopes and stable response idempotency keys.
 * Do not attach staff auth or expose raw bearer tokens through these props. */
export type PublicDecisionAction = (command: PublicDecisionCommand, signal: AbortSignal) => Promise<PublicDecisionResult>;
export type DecisionResponseRow = { id: string; choice: SessionResponse["choice"]; question: string | null; createdAt: string; request: { id: string; revision: number; recipientEmail: string; service: string; currency: string; amountMinor: number; term: string; respondBy: string; customerNote: string | null }; resolution: { note: string; createdAt: string } | null };
export type DecisionPreviewRecord = { id: string; cycleId: string; contactId: string; recipientEmail: string; superseded: boolean; terms: DecisionTerms; responses: DecisionResponseRow[] };
