import { z } from "zod";
import type { BillingProvider, PaidPeriod, SubscriptionSnapshot } from "../domain/billing/provider";

const identifier = z.string().regex(/^[a-z]+_[A-Za-z0-9]+$/);
const subscription = z.object({
  id: identifier, plan_id: identifier, status: z.string(),
  quantity: z.number().int(), notes: z.object({ intentId: z.uuid(), workspaceId: z.uuid() }),
  short_url: z.url().nullable(),
});
const invoice = z.object({
  id: identifier, subscription_id: identifier, status: z.string(), payment_id: identifier.nullable(),
  amount: z.number().int(), amount_paid: z.number().int(), amount_due: z.number().int(), currency: z.string(),
  billing_start: z.number().int().nullable(), billing_end: z.number().int().nullable(),
});
const payment = z.object({
  id: identifier, invoice_id: identifier.nullable(), status: z.string(),
  amount: z.number().int(), currency: z.string(), amount_refunded: z.number().int(),
});

export class RazorpayProvider implements BillingProvider {
  readonly environment: "test" | "live";

  constructor(private readonly config: { keyId: string; secret: string; planId: string; amountMinor: number; testApiUrl?: string }) {
    if (!/^rzp_(test|live)_/.test(config.keyId)) throw new Error("Use a Razorpay test or live key.");
    if (config.testApiUrl) {
      const url = new URL(config.testApiUrl);
      if (!config.keyId.startsWith("rzp_test_") || url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.pathname !== "/v1/") {
        throw new Error("The test provider URL must use a loopback HTTP server and test keys.");
      }
    }
    this.environment = config.keyId.startsWith("rzp_live_") ? "live" : "test";
  }

  private async request(path: string, body?: unknown) {
    const response = await fetch((this.config.testApiUrl ?? "https://api.razorpay.com/v1/") + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: "Basic " + Buffer.from(this.config.keyId + ":" + this.config.secret).toString("base64"),
        "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Razorpay request failed with status " + response.status);
    return response.json() as Promise<unknown>;
  }

  private async page(path: string) {
    const all: unknown[] = [];
    for (let skip = 0; skip < 1000; skip += 100) {
      const separator = path.includes("?") ? "&" : "?";
      const response = z.object({ items: z.array(z.unknown()) }).parse(await this.request(path + separator + "count=100&skip=" + skip));
      all.push(...response.items);
      if (response.items.length < 100) return all;
    }
    throw new Error("Provider reconciliation exceeded the pagination bound.");
  }

  private async snapshot(raw: unknown): Promise<SubscriptionSnapshot> {
    const item = subscription.parse(raw);
    if (item.plan_id !== this.config.planId || item.quantity !== 1) throw new Error("Unexpected subscription plan.");
    if (item.short_url) {
      const url = new URL(item.short_url);
      if (url.protocol !== "https:" || !["rzp.io", "rzp.in"].includes(url.hostname)) throw new Error("Unexpected hosted checkout URL.");
    }
    const periods: PaidPeriod[] = [];
    for (const value of await this.page("invoices?subscription_id=" + encodeURIComponent(item.id))) {
      const bill = invoice.parse(value);
      if (bill.subscription_id !== item.id || bill.status !== "paid" || !bill.payment_id ||
        bill.amount_due !== 0 || bill.amount_paid !== bill.amount || bill.currency !== "INR" ||
        bill.amount !== this.config.amountMinor || !bill.billing_start || !bill.billing_end) continue;
      const paid = payment.parse(await this.request("payments/" + encodeURIComponent(bill.payment_id)));
      if (paid.id !== bill.payment_id || paid.invoice_id !== bill.id || paid.status !== "captured" ||
        paid.amount !== bill.amount || paid.currency !== bill.currency || paid.amount_refunded !== 0 ||
        bill.billing_end <= bill.billing_start) continue;
      periods.push({ paymentId: paid.id, invoiceId: bill.id, amountMinor: paid.amount, currency: paid.currency,
        start: new Date(bill.billing_start * 1000), end: new Date(bill.billing_end * 1000) });
    }
    return { id: item.id, intentId: item.notes.intentId, workspaceId: item.notes.workspaceId,
      status: item.status, checkoutUrl: item.short_url, periods };
  }

  async create(intentId: string, workspaceId: string) {
    const plan = z.object({ period: z.literal("monthly"), interval: z.literal(1),
      item: z.object({ amount: z.number(), currency: z.literal("INR") }) }).parse(
      await this.request("plans/" + encodeURIComponent(this.config.planId)),
    );
    if (plan.item.amount !== this.config.amountMinor) throw new Error("The configured plan amount does not match.");
    return this.snapshot(await this.request("subscriptions", {
      plan_id: this.config.planId, total_count: 120, quantity: 1, customer_notify: false,
      notes: { intentId, workspaceId },
    }));
  }

  async fetch(id: string) {
    identifier.parse(id);
    return this.snapshot(await this.request("subscriptions/" + encodeURIComponent(id)));
  }

  async find(intentId: string) {
    const matches = (await this.page("subscriptions")).filter(raw => {
      const result = subscription.safeParse(raw);
      return result.success && result.data.notes.intentId === intentId;
    });
    if (matches.length > 1) throw new Error("Duplicate provider subscriptions require reconciliation.");
    return matches[0] ? this.snapshot(matches[0]) : null;
  }

  async cancel(id: string, atTerm: boolean) {
    identifier.parse(id);
    await this.request("subscriptions/" + encodeURIComponent(id) + "/cancel", { cancel_at_cycle_end: atTerm });
  }
}
