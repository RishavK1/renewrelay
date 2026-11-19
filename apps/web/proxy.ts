import { NextRequest, NextResponse } from "next/server";

/** HTML needs framework scripts; API and decision endpoints retain deny-all CSP. */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const development = process.env.NODE_ENV === "development";
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // Next's development overlay uses inline styles; deployed pages require a nonce.
    `style-src 'self' ${development ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "font-src 'self'", "img-src 'self' data:",
    `connect-src 'self'${development ? " ws://127.0.0.1:* ws://localhost:*" : ""}`,
    "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'",
  ].join("; ");
  const headers = new Headers(request.headers);
  headers.set("Content-Security-Policy", policy);
  headers.set("x-nonce", nonce);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
export const config = { matcher: ["/", "/signup", "/check-email", "/verify-email", "/login", "/two-factor", "/auth-complete", "/forgot-password", "/setup-authenticator"] };
