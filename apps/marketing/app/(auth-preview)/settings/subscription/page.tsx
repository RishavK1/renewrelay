import type { Metadata } from "next";
import { SettingsPreview } from "../../../../components/settings/settings-preview";
export const metadata: Metadata = { title: "Workspace settings — RenewRelay UI preview", robots: { index: false, follow: false } };
export default function Page() { return <SettingsPreview view="subscription" />; }
