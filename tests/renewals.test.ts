import assert from "node:assert/strict";
import test from "node:test";
import { createRenewal } from "../packages/contracts/renewals";
import { addDays, localToday, sqlDate, suggestedSuccessor } from "../packages/domain/renewal-dates";
import { csvColumns, parseImport } from "../packages/domain/renewals/imports";

const date = (expiryOn: string, noticeBy?: string) => ({ expiryOn: sqlDate(expiryOn), noticeBy: noticeBy ? sqlDate(noticeBy) : null, respondBy: null });

test("monthly and annual suggestions preserve the original anchor", () => {
  const jan31 = sqlDate("2024-01-31");
  assert.deepEqual(suggestedSuccessor("monthly", jan31, date("2024-01-31", "2024-01-20")), {
    expiryOn: "2024-02-29", noticeBy: "2024-02-18", respondBy: null,
  });
  assert.equal(suggestedSuccessor("monthly", jan31, date("2024-02-29"))?.expiryOn, "2024-03-31");
  const leap = sqlDate("2024-02-29");
  assert.equal(suggestedSuccessor("yearly", leap, date("2024-02-29"))?.expiryOn, "2025-02-28");
  assert.equal(suggestedSuccessor("yearly", leap, date("2027-02-28"))?.expiryOn, "2028-02-29");
  assert.equal(suggestedSuccessor("once", leap, date("2024-02-29")), null);
});

test("business day follows the cycle timezone across a DST transition", () => {
  const utc = new Date("2026-03-08T04:59:59Z");
  assert.equal(localToday("America/New_York", utc), "2026-03-07");
  assert.equal(localToday("Asia/Kolkata", utc), "2026-03-08");
  assert.equal(addDays("2026-03-07", 2), "2026-03-09");
});

const valid = {
  clientId: "f23b68c6-0364-4c96-82da-e903dbb45af7",
  operatorId: "operator1",
  service: "Hosting",
  provider: "Example",
  expiryOn: "2027-06-30",
  noticeBy: "2027-06-24",
  respondBy: "2027-06-15",
  payer: "agency",
  currency: "INR",
  recurrence: "yearly",
};

test("renewal validation distinguishes unknown and zero and enforces deadline order", () => {
  assert.equal(createRenewal.parse(valid).clientQuoteMinor, null);
  assert.equal(createRenewal.parse({ ...valid, clientQuoteMinor: 0 }).clientQuoteMinor, 0);
  for (const change of [
    { respondBy: "2027-06-25" }, { expiryOn: "2027-02-29" }, { currency: "ZZZ" },
    { service: "x\0y" }, { payer: "client", rebillable: true }, { supplierCostMinor: -1 },
  ]) assert.equal(createRenewal.safeParse({ ...valid, ...change }).success, false);
});

const header = csvColumns.join(",");
const row = csvColumns.map((key) => key === "service" ? '"Domains, hosting"' : key in valid ? valid[key as keyof typeof valid] : "").join(",");

test("CSV preview handles BOM, quoted delimiters, row shape and bounded record count", () => {
  const { records, errors } = parseImport(`\uFEFF${header}\r\n${row}\r\nwrong,shape\r\n`);
  assert.equal(records[0]?.input.service, "Domains, hosting");
  assert.equal(records[0]?.line, 2);
  assert.equal(errors[0]?.line, 3);
  assert.throws(() => parseImport(`${header},mode\n${row}`), /exact header/);
  assert.throws(() => parseImport(`${header}\n"${row}`), /Malformed CSV/);
  assert.throws(() => parseImport(`${header}\n${Array(2001).fill(row).join("\n")}`), /2,000/);
});

test("export cells neutralize formula and full-width prefixes and escape cell boundaries", async () => {
  const { csvCell } = await import("../packages/domain/renewals/export");
  assert.equal(csvCell('=1+2,"x"'), '"\t=1+2,""x"""');
  assert.equal(csvCell("  ＠SUM(A1)"), '"\t  ＠SUM(A1)"');
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(0), '"0"');
});

test("local notification instants honor DST and inclusive response dates", async () => {
  const { localInstant, responseDeadline } = await import("../packages/domain/renewal-dates");
  assert.equal(localInstant("2026-03-07", "America/New_York", 9).toISOString(), "2026-03-07T14:00:00.000Z");
  assert.equal(localInstant("2026-03-08", "America/New_York", 9).toISOString(), "2026-03-08T13:00:00.000Z");
  assert.equal(responseDeadline("2026-03-08", "America/New_York").toISOString(), "2026-03-09T04:00:00.000Z");
  assert.equal(responseDeadline("2026-11-18", "Asia/Kolkata").toISOString(), "2026-11-18T18:30:00.000Z");
});


test("RR-07 skipped and repeated calendar boundaries use defined Temporal disambiguation", async () => {
  const { localInstant, responseDeadline } = await import("../packages/domain/renewal-dates");
  assert.equal(responseDeadline("2027-03-13", "America/Havana").toISOString(), "2027-03-14T05:00:00.000Z");
  assert.equal(responseDeadline("2018-11-03", "America/Sao_Paulo").toISOString(), "2018-11-04T03:00:00.000Z");
  assert.equal(responseDeadline("2027-11-06", "America/Havana").toISOString(), "2027-11-07T04:00:00.000Z");
  assert.equal(localInstant("2026-11-01", "America/New_York", 1).toISOString(), "2026-11-01T05:00:00.000Z");
  assert.equal(localInstant("2026-10-04", "Australia/Lord_Howe", 2).toISOString(), "2026-10-03T15:30:00.000Z");
  assert.equal(responseDeadline("2011-12-29", "Pacific/Apia").toISOString(), "2011-12-30T10:00:00.000Z");
  const original = localInstant("2026-03-08", "America/New_York", 9);
  original.setTime(0);
  assert.equal(localInstant("2026-03-08", "America/New_York", 9).toISOString(), "2026-03-08T13:00:00.000Z");
  assert.throws(() => localInstant("2026-01-01", "UTC", 24), RangeError);
});

test("inclusive deadlines cross into the next valid date across all runtime IANA zones", async () => {
  const { responseDeadline } = await import("../packages/domain/renewal-dates");
  for (const timezone of Intl.supportedValuesOf("timeZone")) {
    for (const day of ["2027-03-13", "2027-11-06"]) {
      const boundary = responseDeadline(day, timezone);
      assert.ok(localToday(timezone, new Date(boundary.getTime() - 1)) <= day, timezone);
      assert.ok(localToday(timezone, boundary) > day, timezone);
    }
  }
});
