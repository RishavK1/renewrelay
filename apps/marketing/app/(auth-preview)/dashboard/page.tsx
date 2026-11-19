import type { Metadata } from "next";
import { DashboardPreview } from "../../../components/dashboard/dashboard-preview";
import "../../../../../packages/ui/dashboard/dashboard.css";
import "../../../../../packages/ui/clients/clients.css";
import "../../../../../packages/ui/renewals/renewal-records.css";
import "../../../../../packages/ui/clients/client-management.css";

export const metadata: Metadata = { title: "Renewals — RenewRelay UI preview", robots: { index: false, follow: false } };

export default function Page() { return <DashboardPreview />; }
