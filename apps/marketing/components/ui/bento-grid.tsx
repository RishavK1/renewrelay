// Adapted from Aceternity Bento Grid. Local visual contract replaces demo styles.
// Source: https://ui.aceternity.com/registry/bento-grid.json
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function BentoGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("agency-bento", className)}>{children}</div>;
}

export function BentoGridItem({ title, description, icon, children, className }: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("agency-bento__item", className)}>
      <div className="agency-bento__heading"><span className="record-icon" aria-hidden="true">{icon}</span><h3>{title}</h3></div>
      <p className="agency-bento__description">{description}</p>
      <div className="agency-bento__visual">{children}</div>
    </article>
  );
}
