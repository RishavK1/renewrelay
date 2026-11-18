import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

type PreviewActionProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "quiet";
  compact?: boolean;
  className?: string;
  href?: "/login" | "/signup";
};

/** Local UI previews only; deployed marketing remains inactive until wiring. */
export function PreviewAction({ children, variant = "primary", compact = false, className, href = "/signup" }: PreviewActionProps) {
  const classes = cn("button", `button--${variant}`, compact && "button--compact", className);
  if (process.env.NODE_ENV === "development") return <a href={href} title="Open authentication UI preview" className={classes}>{children}</a>;
  return (
    <button
      type="button"
      disabled
      title="Coming soon"
      className={classes}
    >
      {children}
    </button>
  );
}
