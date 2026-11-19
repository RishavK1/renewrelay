import type { Metadata } from "next";
import { OrganizationPreview } from "../../../../../components/renewals/organization-preview";
import "../../../../../../../packages/ui/dashboard/dashboard.css";
import "../../../../../../../packages/ui/clients/client-management.css";
import "../../../../../../../packages/ui/renewals/renewal-records.css";
import "../../../../../../../packages/ui/renewals/follow-through.css";
export const metadata: Metadata = { title: "Withdraw cycle — RenewRelay UI preview", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;
  return <OrganizationPreview key={cycleId} cycleId={cycleId} view="withdraw" />;
}
