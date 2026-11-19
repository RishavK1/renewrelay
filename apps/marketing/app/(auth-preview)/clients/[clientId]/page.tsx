import { ClientManagementPreview } from "../../../../components/clients/client-management-preview";
import "../../../../../../packages/ui/dashboard/dashboard.css";
import "../../../../../../packages/ui/clients/clients.css";
import "../../../../../../packages/ui/clients/client-management.css";

export default async function Page({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <ClientManagementPreview key={clientId} clientId={clientId} />;
}
