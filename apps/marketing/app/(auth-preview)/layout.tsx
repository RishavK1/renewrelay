import { notFound } from "next/navigation";
import "../../../../packages/ui/auth/auth.css";

export default function AuthPreviewLayout({ children }: { children: React.ReactNode }) {
  // The marketing origin must never become a deployed authentication host.
  if (process.env.NODE_ENV !== "development") notFound();
  return children;
}
