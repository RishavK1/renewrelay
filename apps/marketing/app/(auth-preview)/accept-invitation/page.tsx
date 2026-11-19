import type { Metadata } from "next";
import { InvitationAcceptancePreview } from "../../../components/team/team-preview";
import "../../../../../packages/ui/dashboard/dashboard.css";
import "../../../../../packages/ui/clients/client-management.css";
import "../../../../../packages/ui/team/team.css";
export const metadata: Metadata = { title: "Accept invitation — RenewRelay UI preview", robots: { index: false, follow: false } };
export default function Page() { return <InvitationAcceptancePreview />; }
