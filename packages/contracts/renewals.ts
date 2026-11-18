import { z } from "zod";
import { userId, uuid, version } from "./api";

const label = (max: number) => z.string().trim().min(1).max(max).refine(
  (value) => !/[\u0000-\u001f\u007f]/.test(value),
  "Use plain text without control characters.",
);
export const dateOnly = z.iso.date().refine((value) => !value.startsWith("0000"), "Use a year between 0001 and 9999.");
const currencyCodes = new Set(Intl.supportedValuesOf("currency"));
const currency = z.string().regex(/^[A-Z]{3}$/).refine((value) => currencyCodes.has(value), "Use a supported currency code.");
const amount = z.number().int().min(0).max(2_147_483_647);
export const renewalState = z.enum(["draft", "open", "ready", "renewed", "cancelled", "withdrawn"]);
export const recurrence = z.enum(["once", "monthly", "yearly"]);
const action = z.enum(["renew", "cancel"]);
const notes = label(1000);

const scheduleFields = {
  expiryOn: dateOnly,
  noticeBy: dateOnly.nullable().default(null),
  respondBy: dateOnly.nullable().default(null),
};
type Schedule = { expiryOn: string; noticeBy: string | null; respondBy: string | null };

function validateSchedule(value: Schedule, ctx: z.RefinementCtx) {
  if (value.noticeBy && value.noticeBy > value.expiryOn) {
    ctx.addIssue({ code: "custom", path: ["noticeBy"], message: "Notice must be due on or before expiry." });
  }
  if (value.respondBy && value.respondBy > (value.noticeBy ?? value.expiryOn)) {
    ctx.addIssue({ code: "custom", path: ["respondBy"], message: "Response must be due on or before the earliest provider deadline." });
  }
}

export const schedule = z.strictObject(scheduleFields).superRefine(validateSchedule);
export type ScheduleInput = z.infer<typeof schedule>;

const termsFields = {
  service: label(120),
  provider: label(120),
  payer: z.enum(["agency", "client"]),
  rebillable: z.boolean().default(false),
  autoRenew: z.boolean().default(false),
  currency,
  supplierCostMinor: amount.nullable().default(null),
  clientQuoteMinor: amount.nullable().default(null),
  term: label(160).nullable().default(null),
};

function validateTerms(value: { payer: string; rebillable: boolean }, ctx: z.RefinementCtx) {
  if (value.rebillable && value.payer !== "agency") {
    ctx.addIssue({ code: "custom", path: ["rebillable"], message: "Only agency-paid services can be rebillable." });
  }
}

export const createRenewal = z.strictObject({
  ...scheduleFields,
  ...termsFields,
  clientId: uuid,
  operatorId: userId,
  recurrence,
  mode: z.enum(["activate", "draft"]).default("activate"),
}).superRefine((value, ctx) => {
  validateSchedule(value, ctx);
  validateTerms(value, ctx);
});
export type CreateRenewal = z.infer<typeof createRenewal>;

export const editRenewal = z.strictObject({
  operatorId: userId.optional(),
  recurrence: recurrence.optional(),
  expectedVersion: version,
}).refine(({ operatorId, recurrence }) => operatorId !== undefined || recurrence !== undefined, "Include a change.");

export const editCycle = z.strictObject({
  ...scheduleFields,
  ...termsFields,
  expectedVersion: version,
  providerAgreement: notes.optional(),
}).superRefine((value, ctx) => {
  validateSchedule(value, ctx);
  validateTerms(value, ctx);
});

export const activateDraft = z.strictObject({ expectedVersion: version });
export const readyCycle = z.strictObject({ expectedVersion: version, action, reason: notes });
export const offlineDecision = z.strictObject({
  expectedVersion: version,
  action,
  source: label(120),
  instructedOn: dateOnly,
  reason: notes,
});
export const completeCycle = z.strictObject({
  expectedVersion: version,
  outcome: z.enum(["renewed", "cancelled"]),
  performedOn: dateOnly,
  providerReference: label(160).optional(),
  note: notes.optional(),
  next: schedule.optional(),
}).refine((value) => value.providerReference || value.note, "Provide a provider reference or explanatory note.");
export const withdrawCycle = z.strictObject({ expectedVersion: version, reason: notes });
export const setBlocker = z.strictObject({ expectedVersion: version, blocked: z.boolean(), reason: notes });
export const correctCycle = z.strictObject({ expectedVersion: version, correction: notes,
  successor: z.strictObject({ id: uuid, expectedVersion: version, dates: schedule, confirm: z.literal(true), providerAgreement: notes.optional() }).optional(),
});
export const archiveItem = z.strictObject({ expectedVersion: version, abandonReason: notes.optional() });
export const setBilling = z.strictObject({
  expectedVersion: version,
  status: z.enum(["not_applicable", "to_invoice", "invoiced"]),
  invoiceReference: label(160).optional(),
}).refine((value) => value.invoiceReference === undefined || value.status === "invoiced", "An invoice reference requires invoiced status.");

const limit = z.string().regex(/^(100|[1-9][0-9]?)$/).transform(Number).default(25);
export const cycleFilter = z.strictObject({
  status: renewalState.optional(),
  bucket: z.enum(["waiting_on_client", "ready_for_operator", "due_soon", "overdue", "blocked", "delivery_failed"]).optional(),
  clientId: uuid.optional(),
  itemId: uuid.optional(),
  operatorId: userId.optional(),
  provider: label(120).optional(),
  from: dateOnly.optional(),
  through: dateOnly.optional(),
  billingStatus: z.enum(["not_applicable", "to_invoice", "invoiced"]).optional(),
  after: z.string().max(256).optional(),
  limit,
}).refine((value) => !value.from || !value.through || value.from <= value.through, "Dates must be in order.");

export const commitImport = z.strictObject({
  expectedVersion: version,
  confirmPossibleDuplicates: z.boolean().default(false),
});

export const removal = z.strictObject({ replacementUserId: userId });
