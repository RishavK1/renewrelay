import { workspaceEntitlement } from "../billing/policy";
import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { Prisma, type PrismaClient } from "../../db/generated/client";
import type { Transaction } from "../../db/database";
import { createRenewal, type CreateRenewal } from "../../contracts/renewals";
import { audit, checkVersion, type Actor, type Command, managers, once, withWorkspace } from "../context";
import { DomainError, conflict, notFound } from "../errors";
import { actionDate, localToday } from "../renewal-dates";
import { checkCapacity, insertRenewals, referenceSets, workspaceTimezone } from "./records";

export const csvColumns = [
  "clientId", "operatorId", "service", "provider", "expiryOn", "noticeBy", "respondBy",
  "payer", "rebillable", "autoRenew", "currency", "supplierCostMinor", "clientQuoteMinor", "term", "recurrence", "mode",
] as const;
export const maxCsvBytes = 2 * 1024 * 1024;
const maxRows = 2000;

type Row = { line: number; input: CreateRenewal; modeConfirmed: boolean };
type RowIssue = { line: number; field: string; message: string };
type StagedRows = { records: Row[]; warnedLines: number[] };

export function parseImport(csv: string) {
  let parsed: { record: string[]; info: { lines: number } }[];
  try {
    // The library overload types array rows without accounting for the info wrapper.
    parsed = parse(csv, { info: true, bom: true, relax_column_count: true, max_record_size: 16_384, to: maxRows + 2 }) as unknown as typeof parsed;
  } catch (error) {
    const line = error && typeof error === "object" && "lines" in error && typeof error.lines === "number" ? error.lines : undefined;
    throw new DomainError(422, "invalid_csv", line ? `Malformed CSV around line ${line}.` : "Malformed CSV.");
  }
  if (parsed.length < 2) throw new DomainError(422, "empty_import", "Include a header and at least one record.");
  if (parsed.length > maxRows + 1) throw new DomainError(413, "row_limit", "Import at most 2,000 records.");
  const header = parsed[0]?.record ?? [];
  if (header.length !== csvColumns.length || !csvColumns.every((column, index) => header[index] === column)) {
    throw new DomainError(422, "invalid_csv_header", "Use the exact header from the CSV template.");
  }
  const errors: RowIssue[] = [];
  const records: Row[] = [];
  const amount = (value: string | undefined) => value && /^\d{1,10}$/.test(value) ? Number(value) : value || null;
  const flag = (value: string | undefined) => value === "true" ? true : !value || value === "false" ? false : value;
  let line = (parsed[0]?.info.lines ?? 1) + 1;
  for (const { record, info } of parsed.slice(1)) {
    const rowLine = line;
    line = info.lines + 1;
    if (record.length !== header.length) {
      errors.push({ line: rowLine, field: "_row", message: "The row must have the same number of fields as the header." });
      continue;
    }
    const values = Object.fromEntries(csvColumns.map((key, i) => [key, record[i]?.trim() ?? ""]));
    const result = createRenewal.safeParse({
      ...values,
      noticeBy: values.noticeBy || null, respondBy: values.respondBy || null, term: values.term || null,
      supplierCostMinor: amount(values.supplierCostMinor), clientQuoteMinor: amount(values.clientQuoteMinor),
      rebillable: flag(values.rebillable),
      autoRenew: flag(values.autoRenew),
      mode: values.mode || undefined,
    });
    if (!result.success) {
      for (const issue of result.error.issues) errors.push({
        line: rowLine, field: issue.path.join(".") || "_row", message: issue.message,
      });
      continue;
    }
    records.push({ line: rowLine, input: result.data, modeConfirmed: !!values.mode });
  }
  return { records, errors };
}

function duplicateKey(input: Pick<CreateRenewal, "clientId" | "service" | "provider">) {
  const normalize = (label: string) => label.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
  return JSON.stringify([input.clientId, normalize(input.provider), normalize(input.service)]);
}

async function duplicateLines(tx: Transaction, workspaceId: string, inputs: Row[]) {
  const totals = new Map<string, number>();
  for (const { input } of inputs) {
    const key = duplicateKey(input);
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }
  const existing = await tx.renewalItem.findMany({
    where: { workspaceId, archivedAt: null }, select: { clientId: true, service: true, provider: true },
  });
  const keys = new Set(existing.map(duplicateKey));
  return inputs.filter(({ input }) => {
    const key = duplicateKey(input);
    return keys.has(key) || (totals.get(key) ?? 0) > 1;
  }).map(({ line }) => line);
}

export function previewImport(db: PrismaClient, actor: Actor, workspaceId: string, csv: string) {
  return withWorkspace(db, actor, workspaceId, managers, true, async ({ tx }) => {
    const digest = createHash("sha256").update(csv).digest("hex");
    const key = { workspaceId, actorId: actor.id, digest };
    const previous = await tx.renewalImport.findUnique({ where: { workspaceId_actorId_digest: key } });
    if (previous?.committedAt) {
      return { importId: previous.id, version: previous.version, committed: true, result: previous.result };
    }
    const now = new Date();
    const { records, errors } = parseImport(csv);
    const references = await referenceSets(tx, workspaceId, records.map(({ input }) => input));
    const timezone = await workspaceTimezone(tx, workspaceId);
    const today = localToday(timezone, now);
    const duplicate = await duplicateLines(tx, workspaceId, records);
    const warnedLines = new Set(duplicate);
    const warnings: RowIssue[] = [];
    for (const { line, input, modeConfirmed } of records) {
      if (!references.clients.has(input.clientId)) errors.push({ line, field: "clientId", message: "Choose an active workspace client." });
      if (!references.operators.has(input.operatorId)) errors.push({ line, field: "operatorId", message: "Choose an active workspace member." });
      if (warnedLines.has(line)) warnings.push({ line, field: "service", message: "Possible duplicate within this client. No records will be merged." });
      if (actionDate(input, true) < today) {
        if (!modeConfirmed) {
          errors.push({ line, field: "mode", message: "Choose draft or activate explicitly for an overdue row." });
        }
        warnings.push({ line, field: "expiryOn", message: input.mode === "activate"
          ? "Overdue. Activation will add an owner alert." : "Overdue. Saved as a draft until explicitly activated." });
      }
    }
    if (errors.length) return {
      importId: null, version: null, committed: false, canCommit: false, errors: errors.slice(0, 200),
      totalErrors: errors.length, warnings,
    };

    if (!previous || previous.expiresAt <= now) {
      const staging = await tx.renewalImport.count({
        where: { workspaceId, actorId: actor.id, committedAt: null, expiresAt: { gt: now } },
      });
      if (staging >= 10) throw new DomainError(429, "preview_limit", "You already have ten active import previews.");
    }

    const staged = { records, warnedLines: duplicate } satisfies StagedRows;
    const previousWarnings = (previous?.rows as StagedRows | undefined)?.warnedLines;
    const changed = !!previous && (previous.expiresAt <= now || JSON.stringify(previousWarnings) !== JSON.stringify(duplicate));
    const expiresAt = previous && previous.expiresAt > now ? previous.expiresAt : new Date(now.getTime() + 24 * 60 * 60_000);
    const batch = await tx.renewalImport.upsert({
      where: { workspaceId_actorId_digest: key },
      create: { ...key, rows: staged as Prisma.InputJsonValue, expiresAt },
      update: { rows: staged as Prisma.InputJsonValue, expiresAt, version: changed ? { increment: 1 } : undefined },
    });
    const access = await workspaceEntitlement(tx, workspaceId);
    const used = await tx.renewalItem.count({ where: { workspaceId, archivedAt: null } });
    return {
      importId: batch.id, version: batch.version, committed: false, canCommit: true, expiresAt: expiresAt.toISOString(),
      remainingSlots: Math.max(0, access.limits.items - used),
      rows: records.length, errors: [], totalErrors: 0, warnings,
    };
  });
}

export function commitRenewalImport(db: PrismaClient, cmd: Command, workspaceId: string, id: string,
  input: { expectedVersion: number; confirmPossibleDuplicates: boolean }) {
  return withWorkspace(db, cmd.actor, workspaceId, managers, true, ({ tx }) => once(tx, cmd, workspaceId, async () => {
    const batch = await tx.renewalImport.findUnique({ where: { workspaceId_id: { workspaceId, id } } });
    if (!batch) notFound();
    checkVersion(batch.version, input.expectedVersion);
    if (batch.committedAt && batch.result !== null) return batch.result as Prisma.InputJsonValue;
    if (batch.expiresAt <= new Date() || !batch.rows) {
      throw new DomainError(410, "import_expired", "Run a new preview before committing.");
    }
    const { records, warnedLines } = batch.rows as unknown as StagedRows;
    const currentDuplicates = await duplicateLines(tx, workspaceId, records);
    if (currentDuplicates.some((line) => !warnedLines.includes(line))) {
      conflict("import_changed", "New possible duplicates were found. Refresh the preview.");
    }
    if (currentDuplicates.length && !input.confirmPossibleDuplicates) {
      conflict("duplicates_require_confirmation", "Confirm the possible duplicates shown in the preview.");
    }
    const inputs = records.map(({ input }) => input);
    const references = await referenceSets(tx, workspaceId, inputs);
    const timezone = await workspaceTimezone(tx, workspaceId);
    const today = localToday(timezone);
    for (const { line, input, modeConfirmed } of records) {
      if (!references.clients.has(input.clientId) || !references.operators.has(input.operatorId)) {
        conflict("import_changed", `Line ${line} has an inactive client or operator. Refresh the preview.`);
      }
      if (!modeConfirmed && actionDate(input, true) < today) {
        conflict("import_changed", `Line ${line} is now overdue. Choose an explicit import mode and preview again.`);
      }
    }
    await checkCapacity(tx, workspaceId, inputs.length);
    const recordsCreated = await insertRenewals(tx, cmd, workspaceId, timezone, inputs);
    const result = { importId: id, count: recordsCreated.length, records: recordsCreated };
    await tx.renewalImport.update({
      where: { workspaceId_id: { workspaceId, id } },
      data: { rows: Prisma.DbNull, committedAt: new Date(), result },
    });
    await audit(tx, cmd, workspaceId, "import.committed", id, { count: recordsCreated.length });
    return result;
  }));
}

export function importTemplate(db: PrismaClient, actor: Actor, workspaceId: string) {
  return withWorkspace(db, actor, workspaceId, managers, false, async () => csvColumns.join(",") + "\r\n");
}
