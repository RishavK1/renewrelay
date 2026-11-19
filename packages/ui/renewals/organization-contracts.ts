import type { z } from "zod";
import type { archiveItem, correctCycle, cycleFilter, editRenewal, withdrawCycle } from "../../contracts/renewals";
import type { DecisionFailure } from "../decisions/contracts";
export type RenewalFilters = z.output<typeof cycleFilter>;
export type OrganizationCommand =
  | { operation: "assignment"; input: z.infer<typeof editRenewal> }
  | { operation: "withdraw"; input: z.infer<typeof withdrawCycle> }
  | { operation: "archive"; input: z.infer<typeof archiveItem> }
  | { operation: "correct"; input: z.infer<typeof correctCycle> };
/** Bound to current workspace/item/cycle. Adapter owns actual auth, trusted related
 * records, item-vs-cycle versions, stable keys, reconciliation and server refetch. */
export type OrganizationAction = (command: OrganizationCommand, signal: AbortSignal) => Promise<{ status: "success" } | DecisionFailure>;
export type RenewalHistoryRow = { id: string; event: string; actorId: string | null; details: unknown; createdAt: string };
export type PreviewHistoryRow = RenewalHistoryRow & { entityId: string };
