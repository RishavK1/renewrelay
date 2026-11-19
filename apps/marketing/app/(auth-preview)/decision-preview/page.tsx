import type { Metadata } from "next";
import { PublicDecisionPreview } from "../../../components/decisions/decision-previews";
import "../../../../../packages/ui/decisions/decisions.css";

export const metadata: Metadata = { title: "Review your renewal — RenewRelay UI preview", robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ request?: string | string[] }> }) {
  const query = await searchParams;
  return <PublicDecisionPreview requestId={typeof query.request === "string" ? query.request : undefined} />;
}
