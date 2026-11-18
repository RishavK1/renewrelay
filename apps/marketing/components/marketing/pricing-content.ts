/** Public marketing offer, agreed 18 November 2026. Tax treatment remains open. */
export const teamOffer = {
  name: "Team",
  monthlyPriceMinor: 149900,
  currency: "INR",
  activeItems: 100,
  seats: 5,
  trial: { days: 14, activeItems: 10, seats: 3 },
} as const;

export const teamFeatures = [
  { title: "Client and service renewal records", detail: "Keep dates, terms and assigned teammates together." },
  { title: "Private client decisions", detail: "Collect approval, a decline or a question after verification." },
  { title: "Reminders and follow-up visibility", detail: "Keep outstanding requests and delivery issues in view." },
  { title: "Recorded outcomes and invoice tracking", detail: "Separate provider work from what still needs invoicing." },
  { title: "Import, export and decision history", detail: "Bring your records in and keep their context accessible." },
] as const;
