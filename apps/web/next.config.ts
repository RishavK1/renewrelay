import type { NextConfig } from "next";

const config: NextConfig = {
  agentRules: false,
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  devIndicators: false,
  logging: { incomingRequests: { ignore: [/\/api\/auth\//, /\/d(?:\/|$)/] } },
  serverExternalPackages: ["nodemailer", "pg", "@prisma/client", "@prisma/adapter-pg"],
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Cache-Control", value: "no-store" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'" },
      ],
    }];
  },
};

export default config;
