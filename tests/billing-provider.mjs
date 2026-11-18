import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

export async function mockBillingProvider() {
  const subscriptions = new Map();
  const invoices = new Map();
  const payments = new Map();
  let created = 0;
  let loseCreateResponse = false;
  let beforeCancel;
  let beforeFetch;
  let rejectCancel = false;
  let loseCancelResponse = false;
  const cancellations = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const input = body ? JSON.parse(body) : {};
    const url = new URL(request.url, "http://127.0.0.1");
    const send = (data, status = 200) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(data));
    };
    if (url.pathname === "/v1/plans/plan_synthetic") return send({ period: "monthly", interval: 1, item: { amount: 149900, currency: "INR" } });
    if (url.pathname === "/v1/subscriptions" && request.method === "POST") {
      created++;
      const id = "sub_" + randomUUID().replaceAll("-", "");
      const row = { id, plan_id: input.plan_id, quantity: 1, status: "created",
        notes: input.notes, short_url: "https://rzp.io/i/synthetic" };
      subscriptions.set(id, row);
      if (loseCreateResponse) {
        loseCreateResponse = false;
        request.socket.destroy();
        return;
      }
      return send(row);
    }
    if (url.pathname === "/v1/subscriptions") {
      const all = [...subscriptions.values()];
      const skip = Number(url.searchParams.get("skip") ?? 0);
      return send({ items: all.slice(skip, skip + 100) });
    }
    if (url.pathname === "/v1/invoices") return send({ items: invoices.get(url.searchParams.get("subscription_id")) ?? [] });
    if (url.pathname.startsWith("/v1/payments/")) return send(payments.get(url.pathname.split("/").at(-1)), payments.has(url.pathname.split("/").at(-1)) ? 200 : 404);
    const id = url.pathname.split("/")[3];
    const subscription = subscriptions.get(id);
    if (!subscription) return send({}, 404);
    if (url.pathname.endsWith("/cancel")) {
      cancellations.push({ id, atTerm: !!input.cancel_at_cycle_end });
      const hook = beforeCancel;
      beforeCancel = undefined;
      if (hook) await hook(id, !!input.cancel_at_cycle_end);
      if (rejectCancel) {
        rejectCancel = false;
        return send({ error: "Synthetic provider outage" }, 503);
      }
      if (input.cancel_at_cycle_end) subscription.cancel_at_cycle_end = true;
      else subscription.status = "cancelled";
      if (loseCancelResponse) {
        loseCancelResponse = false;
        request.socket.destroy();
        return;
      }
    } else if (request.method === "GET") {
      const captured = structuredClone(subscription);
      const hook = beforeFetch;
      beforeFetch = undefined;
      if (hook) await hook(id);
      return send(captured);
    }
    return send(subscription);
  });
  await new Promise(resolve => server.listen(3549, "127.0.0.1", resolve));
  return {
    subscriptions, invoices, payments, cancellations,
    beforeNextCancel(hook) { beforeCancel = hook; },
    beforeNextFetch(hook) { beforeFetch = hook; },
    rejectNextCancel() { rejectCancel = true; },
    loseNextCancelResponse() { loseCancelResponse = true; },
    get created() { return created; },
    loseNextCreateResponse() { loseCreateResponse = true; },
    pay(id, start, end) {
      const paymentId = "pay_" + randomUUID().replaceAll("-", "");
      const invoiceId = "inv_" + randomUUID().replaceAll("-", "");
      const row = subscriptions.get(id);
      row.status = "active";
      const invoice = { id: invoiceId, subscription_id: id, status: "paid", payment_id: paymentId,
        amount: 149900, amount_paid: 149900, amount_due: 0, currency: "INR",
        billing_start: Math.floor(start.getTime() / 1000), billing_end: Math.floor(end.getTime() / 1000) };
      invoices.set(id, [...(invoices.get(id) ?? []), invoice]);
      payments.set(paymentId, { id: paymentId, invoice_id: invoiceId, status: "captured", amount: 149900, currency: "INR", amount_refunded: 0 });
      return invoice;
    },
    close: () => new Promise(resolve => server.close(resolve)),
  };
}
