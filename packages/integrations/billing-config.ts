import { RazorpayProvider } from "./razorpay";
import { DomainError } from "../domain/errors";

export function billingProvider() {
  if (process.env.RAZORPAY_BILLING_ENABLED !== "true") {
    throw new DomainError(503, "billing_disabled", "Subscription checkout is currently unavailable.");
  }
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_PLAN_ID } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET || !RAZORPAY_PLAN_ID) {
    throw new DomainError(503, "billing_unconfigured", "Subscription checkout is currently unavailable.");
  }
  const amountMinor = Number(process.env.RAZORPAY_PLAN_AMOUNT_MINOR ?? "149900");
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error("Invalid billing plan amount.");
  return new RazorpayProvider({
    keyId: RAZORPAY_KEY_ID, secret: RAZORPAY_KEY_SECRET, planId: RAZORPAY_PLAN_ID, amountMinor,
    testApiUrl: process.env.RAZORPAY_TEST_API_URL,
  });
}
