import { notFound } from "next/navigation";
import "../../../../packages/ui/auth/auth.css";
import { WorkspacePreviewScope } from "../../components/workspace/workspace-preview-scope";

export default function AuthPreviewLayout({ children }: { children: React.ReactNode }) {
  // The marketing origin must never become a deployed authentication host.
  if (process.env.NODE_ENV !== "development") notFound();
  return <WorkspacePreviewScope>{children}</WorkspacePreviewScope>;
}
