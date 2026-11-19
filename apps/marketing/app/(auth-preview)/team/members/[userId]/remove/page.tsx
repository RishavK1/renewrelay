import type { Metadata } from "next";
import { TeamPreview } from "../../../../../../components/team/team-preview";
export const metadata: Metadata = { title: "Remove teammate — RenewRelay UI preview", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ userId: string }> }) { const { userId } = await params; return <TeamPreview key={userId} targetId={userId} view="remove" />; }
