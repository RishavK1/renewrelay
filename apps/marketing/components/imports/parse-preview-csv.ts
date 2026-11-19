import { parse } from "csv-parse/browser/esm/sync";
import { createRenewal, type CreateRenewal } from "../../../../packages/contracts/renewals";
import { importColumns, importMaxBytes, importMaxRows, type ImportIssue } from "../../../../packages/ui/imports/contracts";
export type ParsedImportRow = { line: number; input: CreateRenewal; modeConfirmed: boolean };
export class ImportCsvError extends Error { constructor(public code: string, message: string) { super(message); this.name = "ImportCsvError"; } }
/** Development-only CSV fixture adapter. Mirrors parseImport; never server validation. */
export function parsePreviewCsv(csv: string) {
  if (new TextEncoder().encode(csv).byteLength > importMaxBytes) throw new ImportCsvError("payload_too_large", "Choose a CSV file of at most 2 MiB.");
  let parsed: { record: string[]; info: { lines: number } }[];
  try { parsed = parse(csv, { info: true, bom: true, relax_column_count: true, max_record_size: 16384, to: importMaxRows + 2 }) as unknown as typeof parsed; }
  catch (error) { const line = error && typeof error === "object" && "lines" in error && typeof error.lines === "number" ? error.lines : undefined; throw new ImportCsvError("invalid_csv", line ? `Malformed CSV around line ${line}.` : "Malformed CSV."); }
  if (parsed.length < 2) throw new ImportCsvError("empty_import", "Include a header and at least one record.");
  if (parsed.length > importMaxRows + 1) throw new ImportCsvError("row_limit", "Import at most 2,000 records.");
  const header = parsed[0]?.record ?? [];
  if (header.length !== importColumns.length || !importColumns.every((column, index) => header[index] === column)) throw new ImportCsvError("invalid_csv_header", "Use the exact header from the CSV template.");
  const records: ParsedImportRow[] = [], errors: ImportIssue[] = [];
  const amount = (value: string | undefined) => value && /^\d{1,10}$/.test(value) ? Number(value) : value || null;
  const flag = (value: string | undefined) => value === "true" ? true : !value || value === "false" ? false : value;
  let line = (parsed[0]?.info.lines ?? 1) + 1;
  for (const row of parsed.slice(1)) {
    const rowLine = line; line = row.info.lines + 1;
    if (row.record.length !== header.length) { errors.push({ line: rowLine, field: "_row", message: "The row must have the same number of fields as the header." }); continue; }
    const values = Object.fromEntries(importColumns.map((key, index) => [key, row.record[index]?.trim() ?? ""]));
    const result = createRenewal.safeParse({ ...values, noticeBy: values.noticeBy || null, respondBy: values.respondBy || null, term: values.term || null, supplierCostMinor: amount(values.supplierCostMinor), clientQuoteMinor: amount(values.clientQuoteMinor), rebillable: flag(values.rebillable), autoRenew: flag(values.autoRenew), mode: values.mode || undefined });
    if (!result.success) { for (const issue of result.error.issues) errors.push({ line: rowLine, field: issue.path.join(".") || "_row", message: issue.message }); }
    else records.push({ line: rowLine, input: result.data, modeConfirmed: !!values.mode });
  }
  return { records, errors };
}
