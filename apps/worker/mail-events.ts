import type { PrismaClient } from "../../packages/db/generated/client";

export async function processMailEvents(db: PrismaClient) {
  const events = await db.mailProviderEvent.findMany({
    where: { processedAt: null }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 25,
  });
  for (const event of events) {
    await db.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM mail_provider_events WHERE id = ${event.id} AND "processedAt" IS NULL FOR UPDATE SKIP LOCKED`;
      if (!rows.length) return;
      const delivery = await tx.decisionDelivery.findUnique({ where: { id: event.deliveryId } });
      if (!delivery || !event.providerEmailId) {
        await tx.mailProviderEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
        return;
      }
      if (delivery.providerId && delivery.providerId !== event.providerEmailId) {
        await tx.mailProviderEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
        return;
      }
      const blocked = ["email.bounced", "email.complained"].includes(event.eventType);
      if (blocked) {
        await tx.suppressedRecipient.upsert({
          where: { email: delivery.recipient }, create: { email: delivery.recipient }, update: {},
        });
        await tx.decisionDelivery.updateMany({
          where: { recipient: delivery.recipient, status: { in: ["pending", "leased"] } },
          data: { status: "suppressed", ciphertext: null, messageCiphertext: null, leaseUntil: null, leaseToken: null },
        });
      }
      // Suppression and transport failure dominate late delivered/sent events.
      if (blocked || ["email.failed", "email.delivery_delayed"].includes(event.eventType)) {
        await tx.decisionDelivery.update({ where: { id: delivery.id }, data: {
          status: blocked ? "suppressed" : event.eventType === "email.delivery_delayed" ? "delayed" : "failed", providerId: event.providerEmailId,
          ciphertext: null, messageCiphertext: null, leaseUntil: null, leaseToken: null, lastError: event.eventType,
        } });
      } else if (!["suppressed", "failed", "canceled"].includes(delivery.status) &&
        !(delivery.status === "delivered" && event.eventType === "email.sent")) {
        await tx.decisionDelivery.update({ where: { id: delivery.id }, data: {
          status: event.eventType === "email.delivered" ? "delivered" : "sent", providerId: event.providerEmailId,
          ciphertext: null, messageCiphertext: null, leaseUntil: null, leaseToken: null,
        } });
      }
      await tx.mailProviderEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
    });
  }
}
