import type { z } from "zod";
import type { completeCycle, setBilling, setBlocker } from "../../contracts/renewals";
import type { resolveDecisionQuestion } from "../../contracts/decisions";
import type { DecisionFailure } from "../decisions/contracts";

export type FollowThroughCommand =
  | { operation: "complete"; input: z.infer<typeof completeCycle> }
  | { operation: "billing"; input: z.infer<typeof setBilling> }
  | { operation: "clear-blocker"; input: z.infer<typeof setBlocker> }
  | { operation: "resolve-question"; responseId: string; input: z.infer<typeof resolveDecisionQuestion> };
export type FollowThroughResult = { status: "success"; version: number; successorId?: string | null } | DecisionFailure;
/** Bind to one authorized workspace/cycle. Adapter maps the actual API result,
 * refreshes cycle/response projections, and owns Origin/session/MFA, a stable
 * idempotency key for unchanged retries, and unknown-result reconciliation. */
export type FollowThroughAction = (command: FollowThroughCommand, signal: AbortSignal) => Promise<FollowThroughResult>;
