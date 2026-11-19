import type { Metadata } from "next";
import { ClientManagementPreview } from "../../../components/clients/client-management-preview";
import "../../../../../packages/ui/dashboard/dashboard.css";
import "../../../../../packages/ui/clients/clients.css";
import "../../../../../packages/ui/clients/client-management.css";

export const metadata: Metadata = { title: "Clients — RenewRelay UI preview", robots: { index: false, follow: false } };
export default function Page() { return <ClientManagementPreview />; }
