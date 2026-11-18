/** Public, synthetic illustrations only. Never populated from a private workspace. */
export const hostingExample = {
  client: "Northline Studio",
  service: "Website hosting",
  teammate: "Riya",
  expiry: "12 Dec 2026",
  providerNotice: "7 Dec 2026",
  respondBy: "5 Dec 2026",
  quote: "₹2,400",
  term: "12 months",
  performedOn: "6 Dec 2026",
  reference: "EXAMPLE-1042",
} as const;

export const sampleRenewals = [
  { service: hostingExample.service, client: hostingExample.client, nextAction: "3 Dec 2026", owner: hostingExample.teammate, status: "Waiting on client", tone: "waiting" },
  { service: "Domain renewal", client: "Oak & Field", nextAction: "4 Dec 2026", owner: "Arjun", status: "Ready for operator", tone: "ready" },
  { service: "Website maintenance", client: "Lumen Works", nextAction: "8 Dec 2026", owner: "Riya", status: "Blocked", tone: "blocked" },
] as const;
