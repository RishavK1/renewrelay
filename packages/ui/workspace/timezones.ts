import { timezone } from "../../contracts/api";

const fallback = ["UTC", "Africa/Johannesburg", "America/Chicago", "America/Los_Angeles", "America/New_York", "America/Sao_Paulo", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney", "Europe/Berlin", "Europe/London", "Pacific/Auckland"];

export function workspaceTimezones(detected?: string): string[] {
  let zones = fallback;
  try { if (typeof Intl.supportedValuesOf === "function") zones = Intl.supportedValuesOf("timeZone"); }
  catch { /* Older browsers retain validated regional choices. */ }
  return [...new Set(["UTC", ...(detected ? [detected] : []), ...zones])]
    .filter(value => timezone.safeParse(value).success).sort();
}

export function timezoneDescription(zone: string): string {
  if (!zone) return "Select the timezone your team works in.";
  try {
    const offset = new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: "longOffset" })
      .formatToParts(new Date()).find(part => part.type === "timeZoneName")?.value;
    return offset ? `${zone} · ${offset.replace("GMT", "UTC")} today` : zone;
  } catch { return "Select a valid timezone."; }
}
