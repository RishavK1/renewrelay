import { z } from "zod";
import { timezone, version } from "../../contracts/api";
import { requestDeletion } from "../../contracts/billing";
import { cycleFilter } from "../../contracts/renewals";
import type { DecisionFailure } from "../decisions/contracts";
import type { TeamWorkspace } from "../team/contracts";

// These route-local schemas mirror the API without importing server/DB modules.
export const timezonePreviewInput = z.strictObject({ timezone });
export const timezoneChangeInput = z.strictObject({ timezone, expectedVersion: version, previewToken: z.string().regex(/^[a-f0-9]{64}$/), confirm: z.literal(true) });
export const exportDatasets = ["workspace", "members", "invitations", "clients", "contacts", "items", "cycles", "requests", "responses", "audit", "billing", "payments", "deliveries", "notifications", "imports", "invitationDeliveries", "mailEvents"] as const;
export const dataExportInput = z.strictObject({ dataset: z.enum(exportDatasets), after: z.string().min(1).max(128).optional(), asOf: z.iso.datetime().optional(), limit: z.string().regex(/^(100|[1-9][0-9]?)$/).transform(Number).default(25) });
export const csvExportInput = z.strictObject({ ...z.object(cycleFilter.shape).omit({ after: true, limit: true }).shape, archived: z.enum(["include", "exclude"]).default("include") }).refine(value => !value.from || !value.through || value.from <= value.through, "Dates must be in order.");
export type Billing = { mode: "paid" | "trial" | "grace" | "read_only" | "deleting"; writable: boolean; limits: { items: number; seats: number }; usage: { items: number; seats: number }; trialEndsAt: string; paidThrough: string | null; graceEndsAt: string | null; cancellationScheduled: boolean; deletionRequestedAt: string | null; purgeAfter: string | null; providerStatus: string | null; checkoutState: string | null; checkoutUrl: string | null; version: number };
export type Lifecycle = { workspaceDeletion: { recoveryDays: number; requestedAt: string | null; purgeAfter: string | null; purgedAt: string | null; providerCancellationRequired: boolean }; temporaryData: { uncommittedImportHours: number; decisionSessionMinutes: number; rateCounters: string }; financialAndAuditRetention: string; sharedIdentity: string; externalSystems: string };
export type TimezonePreview = { timezone: string; previousTimezone: string; expectedVersion: number; previewToken: string; affectedCount: number; cycles: { id: string; version: number; fromTimezone: string; toTimezone: string; approvalInvalidated: boolean; dates: { expiryOn: string; noticeBy: string | null; respondBy: string | null } }[] };
export type SettingsAccess = { role: TeamWorkspace["role"]; recentAuth: boolean; writable: boolean; deleting: boolean };
export type SettingsCommand =
  | { operation: "timezone.preview"; input: z.infer<typeof timezonePreviewInput> }
  | { operation: "timezone.change"; input: z.infer<typeof timezoneChangeInput> }
  | { operation: "checkout" | "cancel" | "restore"; input: Record<string, never> }
  | { operation: "delete"; input: z.infer<typeof requestDeletion> };
export type SettingsResult = DecisionFailure
  | { status: "success"; operation: "timezone.preview"; preview: TimezonePreview }
  | { status: "success"; operation: "timezone.change"; timezone: string; version: number; affectedCount: number }
  | { status: "success"; operation: "checkout"; state: string | null; checkoutUrl: string | null }
  | { status: "success"; operation: "cancel"; state: "scheduled" | "processing" }
  | { status: "success"; operation: "delete"; purgeAfter: string }
  | { status: "success"; operation: "restore"; recovered: true };
/** Adapter binds workspace, Origin/session/MFA and stable idempotency receipts.
 * Refetch billing after lifecycle changes; never infer access from checkout state.
 * Preview tokens remain opaque. No service calls are made by UI components. */
export type SettingsAction = (command: SettingsCommand, signal: AbortSignal) => Promise<SettingsResult>;
export type ExportCommand = { kind: "csv"; query: z.infer<typeof csvExportInput> } | { kind: "data"; query: z.infer<typeof dataExportInput> };
export type ExportResult = DecisionFailure | { status: "success"; kind: "csv"; count?: number } | { status: "success"; kind: "data"; dataset: typeof exportDatasets[number]; asOf: string; items: unknown[]; nextCursor: string | null };
/** Future download adapter owns authenticated response/Blob handling. The preview
 * displays sample metadata only; it must never claim a real file was exported. */
export type ExportAction = (command: ExportCommand, signal: AbortSignal) => Promise<ExportResult>;
export type BillingRead = (signal: AbortSignal) => Promise<{ status: "success"; billing: Billing } | DecisionFailure>;
export type LifecycleRead = (signal: AbortSignal) => Promise<{ status: "success"; lifecycle: Lifecycle } | DecisionFailure>;
