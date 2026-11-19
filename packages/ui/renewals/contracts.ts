import type { ScheduleInput, CreateRenewal } from "../../contracts/renewals";

export type RenewalCreateResult =
  | { status: "success"; item: { id: string; clientId: string; service: string; provider: string; recurrence: CreateRenewal["recurrence"]; operatorId: string; version: number }; cycle: { id: string; itemId: string; state: "open" | "draft"; version: number } }
  | { status: "error"; code: string; message: string; fieldErrors?: Record<string, string[]>; retryAfterSeconds?: number; recovery?: "/login" | "/check-email" | "/two-factor" };
/** Workspace-scoped adapter owns credentials, stable request key and envelope. */
export type RenewalCreateAction = (input: CreateRenewal, signal: AbortSignal) => Promise<RenewalCreateResult>;
export type OperatorOption = { userId: string; label: string; removedAt: string | null };

export type RenewalStatus = "draft" | "open" | "ready" | "renewed" | "cancelled" | "withdrawn";
export type RenewalCycleRecord = Omit<CreateRenewal, "clientId" | "recurrence" | "mode"> & {
  id: string; itemId: string; version: number; sequence: number; state: RenewalStatus;
  timezone: string; nextActionOn: string; overdue: boolean; providerNoticeMissed: boolean;
  blockedReason: string | null; intendedAction: "renew" | "cancel" | null;
  billingStatus: "not_applicable" | "to_invoice" | "invoiced";
  closedAt: string | null; performedOn: string | null; providerReference: string | null; outcomeNote?: string | null; invoiceReference?: string | null;
};
export type RenewalDetailRecord = {
  item: Extract<RenewalCreateResult, { status: "success" }>["item"] & { archivedAt: string | null };
  cycle: RenewalCycleRecord;
  allowedActions: readonly string[];
  suggestedNext?: ScheduleInput | null;
};
/** Queue excludes supplier cost and terms absent from listCycles. */
export type RenewalQueueRow = Pick<RenewalCycleRecord, "id" | "itemId" | "operatorId" | "sequence" | "service" | "provider" | "state" | "intendedAction" | "expiryOn" | "noticeBy" | "respondBy" | "nextActionOn" | "timezone" | "currency" | "clientQuoteMinor" | "billingStatus" | "autoRenew" | "blockedReason" | "version" | "closedAt" | "overdue" | "providerNoticeMissed"> & { clientId: string };
