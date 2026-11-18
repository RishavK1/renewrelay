import { recordIdentityEvent } from "../../../packages/domain/identity-audit";
import { twoFactor } from "better-auth/plugins/two-factor";
import { hashPassword, verifyPassword } from "../../../packages/domain/passwords";
import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { webConfig } from "../../../packages/contracts/environment";
import { openDatabase } from "../../../packages/db/database";
import { InviteCredentials } from "../../../packages/domain/invite-credentials";
import { createMailer } from "../../../packages/integrations/smtp";

function createRuntime() {
  const config = webConfig();
  const url = new URL(config.BETTER_AUTH_URL);
  const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((!localHttp && url.protocol !== "https:") || url.href !== `${url.origin}/`) {
    throw new Error("BETTER_AUTH_URL must be an HTTPS origin or a local HTTP origin.");
  }

  const db = openDatabase(config.DATABASE_URL);
  const authDb = openDatabase(config.AUTH_DATABASE_URL, 4);
  const sendMail = createMailer({ smtpUrl: config.SMTP_URL, from: config.MAIL_FROM });
  const auth = betterAuth({
    baseURL: url.origin,
    secret: config.BETTER_AUTH_SECRET,
    database: prismaAdapter(authDb, { provider: "postgresql", transaction: true }),
    trustedOrigins: [url.origin],
    logger: { level: "error", log: level => console.error("RenewRelay identity library event", { level }) },
    appName: "RenewRelay",
    plugins: [twoFactor({ issuer: "RenewRelay" })],
    session: { additionalFields: { mfaVerifiedAt: { type: "date", required: false, input: false } }, freshAge: 600, expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
    advanced: {
      useSecureCookies: !localHttp,
      ipAddress: { ipAddressHeaders: config.TRUSTED_CLIENT_IP_HEADER ? [config.TRUSTED_CLIENT_IP_HEADER] : [] },
    },
    rateLimit: { enabled: true, storage: "database" },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      password: { hash: hashPassword, verify: verifyPassword },
      revokeSessionsOnPasswordReset: true,
      onPasswordReset: async ({ user }) => { await recordIdentityEvent(authDb, user.id, "password.reset"); },
      async sendResetPassword({ user, url }) {
        await sendMail({ to: user.email, subject: "Reset your RenewRelay password", text: url });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      async sendVerificationEmail({ user, url }) {
        await sendMail({ to: user.email, subject: "Verify your RenewRelay email", text: url });
      },
    },
    onAPIError: {
      onError(error) {
        console.error("RenewRelay identity request failed", error instanceof Error ? error.name : "UnknownError");
      },
    },
  });

  return { db, authDb, auth, sendMail, trustedIpHeader: config.TRUSTED_CLIENT_IP_HEADER, decisionSecret: config.BETTER_AUTH_SECRET, origin: url.origin, credentials: new InviteCredentials(Buffer.from(config.INVITE_ENCRYPTION_KEY, "base64url")) };
}

const cache = globalThis as typeof globalThis & { renewRelayRuntime?: ReturnType<typeof createRuntime> };

export function runtime() {
  return cache.renewRelayRuntime ??= createRuntime();
}
