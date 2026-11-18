import { observeRoute } from "@renewrelay/operations/telemetry";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { boundedText } from "@server/http";
import { runtime } from "@server/runtime";

const subscriptionId = z.string().regex(/^sub_[A-Za-z0-9]+$/);
const eventSchema = z.object({
  event: z.string().max(100),
  payload: z.object({
    subscription: z.object({ entity: z.object({ id: subscriptionId }) }).optional(),
    invoice: z.object({ entity: z.object({ subscription_id: subscriptionId }) }).optional(),
  }),
});

async function POSTHandler(request: Request) {
  const secrets = [process.env.RAZORPAY_WEBHOOK_SECRET, process.env.RAZORPAY_WEBHOOK_SECRET_PREVIOUS].filter((v): v is string => !!v);
  if (!secrets.length) return new Response(null, { status: 503 });
  let verified = false;
  try {
    const raw = await boundedText(request, 64 * 1024);
    const id = request.headers.get("x-razorpay-event-id");
    const signature = request.headers.get("x-razorpay-signature");
    if (!id || id.length > 200 || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return new Response(null, { status: 400 });
    verified = secrets.some(secret => timingSafeEqual(
      createHmac("sha256", secret).update(raw).digest(), Buffer.from(signature, "hex"),
    ));
    if (!verified) return new Response(null, { status: 400 });
    const event = eventSchema.safeParse(JSON.parse(raw));
    if (!event.success) return new Response(null, { status: 204 });
    const providerId = event.data.payload.subscription?.entity.id ?? event.data.payload.invoice?.entity.subscription_id;
    if (!providerId) return new Response(null, { status: 204 });
    const environment = process.env.RAZORPAY_KEY_ID?.startsWith("rzp_live_") ? "live" : "test";
    await runtime().db.billingEvent.createMany({ data: [{
      id: environment + ":" + id, environment, providerId, eventType: event.data.event,
    }], skipDuplicates: true });
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: verified ? 503 : 400 });
  }
}

export const POST = observeRoute("/api/v1/webhooks/billing", POSTHandler);
