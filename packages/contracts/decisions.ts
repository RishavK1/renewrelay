import { z } from "zod";
import { uuid, version } from "./api";
export const issueDecision = z.strictObject({ contactId: uuid, expectedVersion: version, customerNote: z.string().trim().max(1000).optional() });
export const decisionAccess = z.strictObject({ token: z.string().regex(/^[\w-]{43}$/) });
export const verifyDecision = decisionAccess.extend({ code: z.string().regex(/^\d{6}$/) });
export const respondDecision = verifyDecision.extend({ expectedVersion: version, choice: z.enum(["approve", "cancel", "question"]), question: z.string().trim().min(1).max(1000).optional() }).refine(v => (v.choice === "question") === !!v.question, "Supply question text only for a question.");

export const resolveDecisionQuestion = z.strictObject({
  expectedVersion: version,
  note: z.string().trim().min(1).max(1000).refine(value => !/[\u0000-\u001f\u007f]/.test(value), "Use plain text without control characters."),
});
