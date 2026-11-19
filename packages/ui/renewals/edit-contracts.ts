import type { z } from "zod";
import type { activateDraft, editCycle, offlineDecision } from "../../contracts/renewals";
import type { DecisionFailure } from "../decisions/contracts";
export type RenewalEditCommand =
  | { operation: "revise"; input: z.infer<typeof editCycle> }
  | { operation: "activate"; input: z.infer<typeof activateDraft> }
  | { operation: "record-offline"; input: z.infer<typeof offlineDecision> };
/** Bind to a single authorized workspace/cycle. Future adapter owns session,
 * Origin/JSON, stable idempotency key for unchanged retries, reconciliation,
 * versions and refetch of the server cycle/item/action projections. */
export type RenewalEditAction = (command: RenewalEditCommand, signal: AbortSignal) => Promise<{ status: "success"; version: number } | DecisionFailure>;
