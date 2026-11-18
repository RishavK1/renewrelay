import { z } from "zod";
const database = (role: string) => z.url().refine(value => {
  const url = new URL(value);
  return ["postgres:", "postgresql:"].includes(url.protocol) && decodeURIComponent(url.username) === role;
}, "Use the separately provisioned runtime role.");
const common = z.object({
  RENEWRELAY_ENV: z.enum(["local", "staging", "production"]).default("local"),
  BETTER_AUTH_URL: z.url().refine(value => { const url = new URL(value); return url.href === url.origin + "/" &&
    (url.protocol === "https:" || url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)); }),
  INVITE_ENCRYPTION_KEY: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  SMTP_URL: z.url().refine(value => ["smtp:", "smtps:"].includes(new URL(value).protocol)),
  MAIL_FROM: z.email(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_DEBUG: z.literal("false").optional(),
  TRUSTED_CLIENT_IP_HEADER: z.string().regex(/^[a-z0-9-]+$/).optional(),
  OUTBOUND_MAIL_ENABLED: z.enum(["true", "false"]).default("true"),
  WORKSPACE_PURGE_ENABLED: z.enum(["true", "false"]).default("false"),
  RAZORPAY_BILLING_ENABLED: z.enum(["true", "false"]).default("false"),
  RAZORPAY_KEY_ID: z.string().optional(), RAZORPAY_KEY_SECRET: z.string().optional(), RAZORPAY_PLAN_ID: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(), RAZORPAY_TEST_API_URL: z.url().optional(),
});
const web = common.extend({ DATABASE_URL: database("renewrelay_app"), AUTH_DATABASE_URL: database("renewrelay_auth"), BETTER_AUTH_SECRET: z.string().min(32) });
const worker = common.extend({
  WORKER_DATABASE_URL: database("renewrelay_worker"),
  WORKER_MAIL_RATE_PER_SECOND: z.coerce.number().positive().max(1000).default(2),
  WORKER_MAIL_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(4),
  WORKER_MAIL_BATCH_SIZE: z.coerce.number().int().min(3).max(2000).default(200),
  WORKER_POLL_MS: z.coerce.number().int().min(100).max(30_000).default(30_000),
});
function read<S extends z.ZodType>(schema: S, input: Record<string, string | undefined>): z.output<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid server configuration: " + parsed.error.issues.map(issue => issue.path.join(".")).join(", "));
  const config = parsed.data as z.infer<typeof common>;
  if (config.RAZORPAY_BILLING_ENABLED === "true" && (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET || !config.RAZORPAY_PLAN_ID || !config.RAZORPAY_WEBHOOK_SECRET)) {
    throw new Error("Enabled billing requires provider configuration and webhook verification.");
  }
  if (config.RENEWRELAY_ENV === "production" && (!config.BETTER_AUTH_URL.startsWith("https:") || !config.TRUSTED_CLIENT_IP_HEADER ||
    config.RAZORPAY_TEST_API_URL || config.RAZORPAY_BILLING_ENABLED === "true" && !config.RAZORPAY_KEY_ID?.startsWith("rzp_live_"))) {
    throw new Error("Production requires HTTPS, trusted proxy configuration and live-only billing settings.");
  }
  if (config.RENEWRELAY_ENV !== "local") {
    if (!config.BETTER_AUTH_URL.startsWith("https:")) throw new Error("Deployed environments require HTTPS.");
    for (const key of ["DATABASE_URL", "AUTH_DATABASE_URL", "WORKER_DATABASE_URL"]) {
      const value = input[key];
      if (value && new URL(value).searchParams.get("sslmode") !== "verify-full") throw new Error("Deployed database connections require verified TLS: " + key);
    }
  }
  return parsed.data;
}
export const webConfig = (input: Record<string, string | undefined> = process.env) => read(web, input);
export const workerConfig = (input: Record<string, string | undefined> = process.env) => read(worker, input);
