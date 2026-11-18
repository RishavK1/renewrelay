import nodemailer from "nodemailer";

export function createMailer(config: { smtpUrl: string; from: string }) {
  const server = new URL(config.smtpUrl);
  if (server.protocol !== "smtp:" && server.protocol !== "smtps:") throw new Error("Invalid SMTP protocol.");
  const secure = server.protocol === "smtps:";
  const local = ["localhost", "127.0.0.1", "[::1]", "mailpit"].includes(server.hostname);
  const transporter = nodemailer.createTransport({
    host: server.hostname,
    port: Number(server.port || (secure ? 465 : 587)),
    secure,
    requireTLS: !secure && !local,
    auth: server.username ? { user: decodeURIComponent(server.username), pass: decodeURIComponent(server.password) } : undefined,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 15_000,
  });

  return async function sendMail(message: { to: string; subject: string; text: string; messageId?: string }) {
    const result = await transporter.sendMail({ from: config.from, ...message });
    if (!result.accepted.length) throw new Error("SMTP did not accept the recipient.");
  };
}

export type Mailer = ReturnType<typeof createMailer>;
