import type { z } from "zod";
import type { commitImport } from "../../contracts/renewals";
import type { DecisionFailure } from "../decisions/contracts";
export const importColumns = ["clientId", "operatorId", "service", "provider", "expiryOn", "noticeBy", "respondBy", "payer", "rebillable", "autoRenew", "currency", "supplierCostMinor", "clientQuoteMinor", "term", "recurrence", "mode"] as const;
export const importMaxBytes = 2 * 1024 * 1024;
export const importMaxRows = 2000;
export type ImportReferences = { clients: { id: string; label: string }[]; operators: { id: string; label: string }[]; complete: boolean };
export type ImportIssue = { line: number; field: string; message: string };
export type ImportReceipt = { importId: string; count: number; records: { itemId: string; cycleId: string }[] };
export type ImportPreview =
  | { importId: null; version: null; committed: false; canCommit: false; errors: ImportIssue[]; totalErrors: number; warnings: ImportIssue[] }
  | { importId: string; version: number; committed: false; canCommit: true; expiresAt: string; remainingSlots: number; rows: number; errors: ImportIssue[]; totalErrors: number; warnings: ImportIssue[] }
  | { importId: string; version: number; committed: true; result: ImportReceipt };
export type StagedImport = Extract<ImportPreview, { canCommit: true }>;
export type ImportAccess = { role: "owner" | "admin" | "member"; writable: boolean; deleting: boolean };
export type ImportCommand = { operation: "preview"; file: File } | { operation: "commit"; importId: string; input: z.infer<typeof commitImport> };
export type ImportResult = DecisionFailure | { status: "success"; operation: "preview"; preview: ImportPreview } | { status: "success"; operation: "commit"; result: ImportReceipt };
/** Authorized workspace adapter sends preview as raw UTF-8 text/csv (not multipart).
 * Commit uses exact shared body plus a stable key. Retain/reconcile unknown receipts,
 * versions and authoritative access; refetch created records after confirmed commit.
 * File selection and client validation do not replace server enforcement. */
export type ImportAction = (command: ImportCommand, signal: AbortSignal) => Promise<ImportResult>;
/** Adapter reads the exact workspace template CSV; UI owns only its Blob download. */
export type ImportTemplateAction = (signal: AbortSignal) => Promise<{ status: "success"; csv: string } | DecisionFailure>;
