import type { Metadata } from "next";
import { TeamPreview } from "../../../../../../components/team/team-preview";
export const metadata: Metadata = { title: "Revoke invitation — RenewRelay UI preview", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ inviteId: string }> }) { const { inviteId } = await params; return <TeamPreview key={inviteId} targetId={inviteId} view="revoke" />; }
