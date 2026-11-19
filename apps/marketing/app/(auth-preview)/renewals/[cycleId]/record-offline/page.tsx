import type { Metadata } from "next";
import { RenewalEditPreview } from "../../../../../components/renewals/renewal-edit-preview";
import "../../../../../../../packages/ui/dashboard/dashboard.css";
import "../../../../../../../packages/ui/clients/client-management.css";
import "../../../../../../../packages/ui/renewals/renewal-records.css";
import "../../../../../../../packages/ui/renewals/follow-through.css";
import "../../../../../../../packages/ui/renewals/renewal-edit.css";
export const metadata: Metadata = { title: "Offline instruction — RenewRelay UI preview", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;
  return <RenewalEditPreview key={cycleId} cycleId={cycleId} mode="record-offline" />;
}
