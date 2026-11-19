import type { Metadata } from "next";
import { WorkspacePreview } from "../../../components/workspace/workspace-preview";
import "../../../../../packages/ui/workspace/workspace.css";

export const metadata: Metadata = { title: "Create workspace — RenewRelay UI preview", robots: { index: false, follow: false } };

export default function Page() { return <WorkspacePreview />; }
