import { observeRoute } from "@renewrelay/operations/telemetry";
import { Resend } from "resend";
import { z } from "zod";
import { runtime } from "@server/runtime";
import { boundedText } from "@server/http";

const eventSchema = z.object({
  type: z.enum(["email.sent", "email.delivered", "email.bounced", "email.complained", "email.failed", "email.delivery_delayed"]),
  data: z.object({ email_id: z.string().max(128), tags: z.record(z.string(), z.string()).optional() }),
});

async function POSTHandler(request: Request) {
  if (!process.env.RESEND_WEBHOOK_SECRET) return new Response(null, { status: 503 });
  let verifiedSignature = false;
  try {
    const payload = await boundedText(request, 64 * 1024);
    const id = request.headers.get("svix-id");
    const timestamp = request.headers.get("svix-timestamp");
    const signature = request.headers.get("svix-signature");
    if (!id || id.length > 200 || !timestamp || !signature) return new Response(null, { status: 400 });
    const verified = new Resend(process.env.RESEND_API_KEY ?? "verification-only").webhooks.verify({
      payload, headers: { id, timestamp, signature }, webhookSecret: process.env.RESEND_WEBHOOK_SECRET,
    });
    verifiedSignature = true;
    const parsed = eventSchema.safeParse(verified);
    if (!parsed.success) return new Response(null, { status: 204 });
    const deliveryId = parsed.data.data.tags?.delivery_id;
    if (!deliveryId || !z.uuid().safeParse(deliveryId).success) return new Response(null, { status: 204 });
    await runtime().db.mailProviderEvent.createMany({ data: [{
      id, deliveryId, providerEmailId: parsed.data.data.email_id, eventType: parsed.data.type,
    }], skipDuplicates: true });
    return new Response(null, { status: 204 });
  } catch {
    // Failed durable writes must be retried by the provider.
    return new Response(null, { status: verifiedSignature ? 503 : 400 });
  }
}

export const POST = observeRoute("/api/v1/webhooks/mail", POSTHandler);
