export interface PaidPeriod {
  paymentId: string;
  invoiceId: string;
  amountMinor: number;
  currency: string;
  start: Date;
  end: Date;
}

export interface SubscriptionSnapshot {
  id: string;
  intentId: string;
  workspaceId: string;
  status: string;
  checkoutUrl: string | null;
  periods: PaidPeriod[];
}

export interface BillingProvider {
  environment: "test" | "live";
  create(intentId: string, workspaceId: string): Promise<SubscriptionSnapshot>;
  fetch(id: string): Promise<SubscriptionSnapshot>;
  find(intentId: string): Promise<SubscriptionSnapshot | null>;
  cancel(id: string, atTerm: boolean): Promise<void>;
}
