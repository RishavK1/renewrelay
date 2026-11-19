import { RenewalRecordsPreview } from "../../../../components/renewals/renewal-records-preview";
import type { Metadata } from "next";
import "../../../../../../packages/ui/dashboard/dashboard.css";
import "../../../../../../packages/ui/clients/client-management.css";
import "../../../../../../packages/ui/renewals/renewal-records.css";

export const metadata: Metadata = { title: "Renewal details — RenewRelay UI preview", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;
  return <RenewalRecordsPreview key={cycleId} cycleId={cycleId} />;
}
