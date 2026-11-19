import type { Metadata } from "next";
import { TrackingPreview } from "../../../components/tracking/tracking-preview";
import "../../../../../packages/ui/dashboard/dashboard.css";
import "../../../../../packages/ui/clients/client-management.css";
import "../../../../../packages/ui/renewals/follow-through.css";
import "../../../../../packages/ui/tracking/tracking.css";
export const metadata: Metadata = { title: "Delivery tracking — RenewRelay UI preview", robots: { index: false, follow: false } };
export default function Page() { return <TrackingPreview mode="deliveries" />; }
