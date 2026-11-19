import type { CreateRenewal } from "../../../../packages/contracts/renewals";
import type { ImportIssue } from "../../../../packages/ui/imports/contracts";
import type { ParsedImportRow } from "./parse-preview-csv";
export function duplicateImportLines(records: ParsedImportRow[], existing: Pick<CreateRenewal, "clientId" | "provider" | "service">[]) {
  const key = (row: Pick<CreateRenewal, "clientId" | "provider" | "service">) => JSON.stringify([row.clientId, ...[row.provider, row.service].map(value => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase())]);
  const totals = new Map<string, number>(); for (const row of records) totals.set(key(row.input), (totals.get(key(row.input)) ?? 0) + 1);
  const keys = new Set(existing.map(key));
  return records.filter(row => keys.has(key(row.input)) || (totals.get(key(row.input)) ?? 0) > 1).map(row => row.line);
}
export function inspectImportRows(records: ParsedImportRow[], clientIds: Set<string>, operatorIds: Set<string>, existing: Pick<CreateRenewal, "clientId" | "provider" | "service">[], today: string) {
  const errors: ImportIssue[] = [], warnings: ImportIssue[] = [], warnedLines = duplicateImportLines(records, existing);
  for (const { line, input, modeConfirmed } of records) {
    if (!clientIds.has(input.clientId)) errors.push({ line, field: "clientId", message: "Choose an active workspace client." });
    if (!operatorIds.has(input.operatorId)) errors.push({ line, field: "operatorId", message: "Choose an active workspace member." });
    if (warnedLines.includes(line)) warnings.push({ line, field: "service", message: "Possible duplicate within this client. No records will be merged." });
    if ((input.respondBy ?? input.noticeBy ?? input.expiryOn) < today) {
      if (!modeConfirmed) errors.push({ line, field: "mode", message: "Choose draft or activate explicitly for an overdue row." });
      warnings.push({ line, field: "expiryOn", message: input.mode === "activate" ? "Overdue. Activation will add an owner alert." : "Overdue. Saved as a draft until explicitly activated." });
    }
  }
  return { errors, warnings, warnedLines };
}
