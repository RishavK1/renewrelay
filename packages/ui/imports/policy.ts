import type { ImportAccess, StagedImport } from "./contracts";
export function canReadImportTemplate(access: ImportAccess) { return access.role !== "member" && !access.deleting; }
export function canPreviewImport(access: ImportAccess) { return canReadImportTemplate(access) && access.writable; }
export function importExpired(batch: StagedImport, now = Date.now()) { return !Number.isFinite(Date.parse(batch.expiresAt)) || Date.parse(batch.expiresAt) <= now; }
export function canCommitImport(access: ImportAccess, batch: StagedImport, now = Date.now()) { return canPreviewImport(access) && !importExpired(batch, now) && batch.rows <= batch.remainingSlots; }
export const needsImportPreview = (code: string) => ["import_expired", "import_changed", "stale_version", "duplicates_require_confirmation", "not_found"].includes(code);
