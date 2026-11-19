import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "../../../packages/ui/auth/auth.css";

// Each HTML response receives a fresh CSP nonce; never prerender these pages.
export const dynamic = "force-dynamic";

const manrope = localFont({
  src: "../../marketing/public/fonts/manrope-latin-variable.woff2",
  variable: "--font-manrope", display: "swap", weight: "200 800", fallback: ["Arial", "sans-serif"],
});
export const metadata: Metadata = {
  title: { default: "RenewRelay", template: "%s — RenewRelay" },
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={manrope.variable}><body><a className="skip-link" href="#main-content">Skip to content</a>{children}</body></html>;
}
