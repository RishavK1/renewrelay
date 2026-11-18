import { Resend } from "resend";
import { createMailer } from "./smtp";

export class MailFailure extends Error {
  constructor(readonly retryable: boolean, readonly ambiguous: boolean) {
    super("Mail provider request failed.");
  }
}

export function transactionalMailer(config: { smtpUrl: string; from: string; apiKey?: string; timeoutMs?: number }) {
  const smtp = createMailer(config);
  const resend = config.apiKey ? new Resend(config.apiKey, { baseUrl: "https://api.resend.com" }) : null;
  return async (message: { to: string; subject: string; text: string; id: string }) => {
    if (!resend) {
      try {
        await smtp({ ...message, messageId: `<${message.id}@renewrelay.invalid>` });
        return { id: null, deduplicated: false };
      } catch (error) {
        const detail = error as { responseCode?: number; command?: string };
        const rejected = !!detail?.responseCode && detail.responseCode >= 400;
        const early = ["CONN", "EHLO", "HELO", "STARTTLS", "AUTH", "MAIL FROM", "RCPT TO"].includes(detail?.command ?? "");
        throw new MailFailure((rejected || early) && (detail.responseCode ?? 400) < 500, !rejected && !early);
      }
    }
    try {
      const result = await resend.emails.send({
        from: config.from, to: message.to, subject: message.subject, text: message.text,
        tags: [{ name: "delivery_id", value: message.id }],
      }, { idempotencyKey: message.id, signal: AbortSignal.timeout(config.timeoutMs ?? 10_000) });
      if (result.error) {
        const transient = ["rate_limit_exceeded", "application_error", "internal_server_error"].includes(result.error.name);
        throw new MailFailure(transient, result.error.statusCode == null);
      }
      if (!result.data) throw new MailFailure(true, true);
      return { id: result.data.id, deduplicated: true };
    } catch (error) {
      if (error instanceof MailFailure) throw error;
      throw new MailFailure(true, true);
    }
  };
}
export type TransactionalMailer = ReturnType<typeof transactionalMailer>;
