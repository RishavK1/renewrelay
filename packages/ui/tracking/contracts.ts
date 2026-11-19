import type { z } from "zod";
import { page } from "../../contracts/api";
import type { DecisionFailure } from "../decisions/contracts";
export const trackingPageInput = page;
export type TrackingMode = "alerts" | "deliveries";
export type AlertRow = { id: string; entityId: string; event: string; createdAt: string };
export type DeliveryRow = { id: string; requestId: string; kind: string; status: string; attempts: number; runAt: string; lastError: string | null };
export type TrackingPage<T> = { items: T[]; nextCursor: string | null };
export type TrackingData = { mode: "alerts"; page: TrackingPage<AlertRow> } | { mode: "deliveries"; page: TrackingPage<DeliveryRow> };
export type TrackingRead = (query: z.output<typeof page>, signal: AbortSignal) => Promise<({ status: "success" } & TrackingData) | DecisionFailure>;
/** Adapter binds authorized workspace/mode, translates envelopes and date strings,
 * validates projections, supplies same-workspace related records, clears caches on
 * access changes. No recipient/provider/token fields belong to these projections. */
export type RelatedRenewal = { cycleId: string; service: string; clientName?: string };
export type TrackingRelated = { cycles: Record<string, RelatedRenewal>; requests: Record<string, RelatedRenewal> };
