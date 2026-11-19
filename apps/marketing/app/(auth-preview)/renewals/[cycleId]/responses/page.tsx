import type { Metadata } from "next";
import { StaffDecisionPreview } from "../../../../../components/decisions/decision-previews";
import "../../../../../../../packages/ui/dashboard/dashboard.css";
import "../../../../../../../packages/ui/clients/client-management.css";
import "../../../../../../../packages/ui/renewals/renewal-records.css";
import "../../../../../../../packages/ui/decisions/decisions.css";

export const metadata: Metadata = { title: "Client responses — RenewRelay UI preview", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;
  return <StaffDecisionPreview cycleId={cycleId} view="responses" />;
}
