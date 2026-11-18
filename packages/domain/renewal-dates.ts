import { Temporal } from "@js-temporal/polyfill";
import type { ScheduleInput } from "../contracts/renewals";

export function sqlDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function dateText(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function localToday(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function addDays(value: string, days: number) {
  const result = sqlDate(value);
  result.setUTCDate(result.getUTCDate() + days);
  return dateText(result);
}

export function actionDate(schedule: ScheduleInput, needsDecision: boolean) {
  return (needsDecision ? schedule.respondBy : null) ?? schedule.noticeBy ?? schedule.expiryOn;
}

export function dateFields(schedule: ScheduleInput, needsDecision: boolean) {
  return {
    expiryOn: sqlDate(schedule.expiryOn),
    noticeBy: schedule.noticeBy ? sqlDate(schedule.noticeBy) : null,
    respondBy: schedule.respondBy ? sqlDate(schedule.respondBy) : null,
    nextActionOn: sqlDate(actionDate(schedule, needsDecision)),
  };
}

export function suggestedSuccessor(
  recurrence: "once" | "monthly" | "yearly",
  anchor: Date,
  current: { expiryOn: Date; noticeBy: Date | null; respondBy: Date | null },
): ScheduleInput | null {
  if (recurrence === "once") return null;
  const expiry = new Date(current.expiryOn);
  expiry.setUTCDate(1);
  if (recurrence === "monthly") expiry.setUTCMonth(expiry.getUTCMonth() + 1);
  else expiry.setUTCFullYear(expiry.getUTCFullYear() + 1, anchor.getUTCMonth());
  const last = new Date(expiry);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  expiry.setUTCDate(Math.min(anchor.getUTCDate(), last.getUTCDate()));
  if (expiry.getUTCFullYear() > 9999) return null;

  const shift = (deadline: Date | null) => {
    if (!deadline) return null;
    const suggested = new Date(expiry.getTime() + deadline.getTime() - current.expiryOn.getTime());
    return suggested.getUTCFullYear() >= 1 ? dateText(suggested) : null;
  };
  return { expiryOn: dateText(expiry), noticeBy: shift(current.noticeBy), respondBy: shift(current.respondBy) };
}

// Compatible disambiguation picks the earlier repeated time and moves gaps forward.
const instantCache = new Map<string, number>();
export function localInstant(day: string, timezone: string, hour: number) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new RangeError("Use a local hour from 0 to 23.");
  const key = JSON.stringify([day, timezone, hour]);
  let instant = instantCache.get(key);
  if (instant === undefined) {
    instant = Temporal.PlainDate.from(day).toPlainDateTime({ hour })
      .toZonedDateTime(timezone, { disambiguation: "compatible" }).epochMilliseconds;
    if (instantCache.size >= 512) instantCache.delete(instantCache.keys().next().value!);
    instantCache.set(key, instant);
  }
  return new Date(instant);
}

export function responseDeadline(day: string, timezone: string) {
  // Start-of-day finds the first valid instant, even when local midnight or a whole day is skipped.
  const nextDay = Temporal.PlainDate.from(day).add({ days: 1 });
  return new Date(nextDay.toZonedDateTime(timezone).epochMilliseconds);
}
