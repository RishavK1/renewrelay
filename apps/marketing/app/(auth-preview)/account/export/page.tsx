import type { Metadata } from "next";
import { AccountPreview } from "../../../../components/account/account-preview";
export const metadata: Metadata = { title: "Your account — RenewRelay UI preview", robots: { index: false, follow: false } };
export default function Page() { return <AccountPreview view="export" />; }
