import type { Billing, SettingsAccess } from "./contracts";
export function canManageSettings(access: SettingsAccess) { return access.role === "owner"; }
export function canChangeTimezone(access: SettingsAccess) { return canManageSettings(access) && access.writable && !access.deleting && access.recentAuth; }
export function canExportSettings(access: SettingsAccess, kind: "csv" | "data") { return !access.deleting && access.role !== "member" && (kind === "csv" || access.role === "owner" && access.recentAuth); }
export function canStartCheckout(billing: Billing) {
  const existing = ["creating", "ready", "processing", "uncertain"].includes(billing.checkoutState ?? "") && !["cancelled", "completed", "expired"].includes(billing.providerStatus ?? "");
  return billing.mode !== "deleting" && (existing || !billing.paidThrough || Date.parse(billing.paidThrough) <= Date.now());
}
export function checkoutView(state: string | null, url: string | null) {
  if (state === "terminal") return "closed";
  if (state === "ready" && url) return "ready";
  if (["ready", "creating", "processing", "uncertain"].includes(state ?? "")) return "processing";
  return "unavailable";
}
export function settingsInstant(value: string | null) { if (!value) return "Not recorded"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date) + " UTC"; }
export const modeLabels: Record<Billing["mode"], string> = { paid: "Paid access", trial: "Trial access", grace: "Payment grace period", read_only: "Read-only access", deleting: "Deletion requested" };
