import type { Metadata } from "next";
import { RenewalRecordsPreview } from "../../../components/renewals/renewal-records-preview";
import "../../../../../packages/ui/dashboard/dashboard.css";
import "../../../../../packages/ui/clients/client-management.css";
import "../../../../../packages/ui/renewals/renewal-records.css";

export const metadata: Metadata = { title: "Renewals — RenewRelay UI preview", robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ client?: string | string[] }> }) {
  const { client } = await searchParams;
  return <RenewalRecordsPreview clientId={typeof client === "string" ? client : undefined} />;
}
