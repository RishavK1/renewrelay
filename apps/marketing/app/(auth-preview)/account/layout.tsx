import { AccountPreviewProvider } from "../../../components/account/account-preview-store";
import "../../../../../packages/ui/dashboard/dashboard.css";
import "../../../../../packages/ui/clients/client-management.css";
import "../../../../../packages/ui/renewals/follow-through.css";
import "../../../../../packages/ui/account/account.css";
export default function Layout({ children }: { children: React.ReactNode }) { return <AccountPreviewProvider>{children}</AccountPreviewProvider>; }
