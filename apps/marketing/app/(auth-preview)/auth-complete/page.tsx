import type { Metadata } from "next";
import { AuthPreview } from "../../../components/auth/auth-preview";

export const metadata: Metadata = { title: "Auth complete — RenewRelay UI preview", robots: { index: false, follow: false } };

export default function Page() {
  return <AuthPreview screen="auth-complete" />;
}
