import type { Metadata } from "next";
import { TeamPreview } from "../../../../components/team/team-preview";
export const metadata: Metadata = { title: "Transfer ownership — RenewRelay UI preview", robots: { index: false, follow: false } };
export default function Page() { return <TeamPreview view="transfer" />; }
