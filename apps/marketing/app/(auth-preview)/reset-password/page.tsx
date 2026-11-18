import type { Metadata } from "next";
import { AuthPreview } from "../../../components/auth/auth-preview";

export const metadata: Metadata = { title: "Reset password — RenewRelay UI preview", robots: { index: false, follow: false } };

export default function Page() {
  return <AuthPreview screen="reset-password" />;
}
