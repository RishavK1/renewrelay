import type { Metadata } from "next";
import { WorkspaceDirectoryPreview } from "../../../components/workspace/workspace-directory-preview";
import "../../../../../packages/ui/dashboard/dashboard.css";
import "../../../../../packages/ui/clients/client-management.css";
import "../../../../../packages/ui/renewals/follow-through.css";
import "../../../../../packages/ui/workspace/workspace-directory.css";
export const metadata:Metadata={title:"Your workspaces — RenewRelay UI preview",robots:{index:false,follow:false}};
export default function Page(){return <WorkspaceDirectoryPreview/>;}
