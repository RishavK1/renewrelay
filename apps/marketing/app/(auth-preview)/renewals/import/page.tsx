import type { Metadata } from "next";
import { ImportPreview } from "../../../../components/imports/import-preview";
import "../../../../../../packages/ui/dashboard/dashboard.css";
import "../../../../../../packages/ui/clients/client-management.css";
import "../../../../../../packages/ui/renewals/follow-through.css";
import "../../../../../../packages/ui/imports/imports.css";
export const metadata: Metadata = { title: "Import renewals — RenewRelay UI preview", robots: { index: false, follow: false } };
export default function Page() { return <ImportPreview />; }
