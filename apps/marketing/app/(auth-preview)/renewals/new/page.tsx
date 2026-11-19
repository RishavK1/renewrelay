import type { Metadata } from "next";
import { RenewalPreview } from "../../../../components/renewals/renewal-preview";
import "../../../../../../packages/ui/dashboard/dashboard.css";
import "../../../../../../packages/ui/clients/client-management.css";
import "../../../../../../packages/ui/renewals/renewals.css";

export const metadata: Metadata = { title: "Add renewal — RenewRelay UI preview", robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ client?: string | string[] }> }) {
  const { client } = await searchParams;
  return <RenewalPreview initialClientId={typeof client === "string" ? client : undefined} />;
}
