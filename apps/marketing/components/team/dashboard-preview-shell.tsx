"use client";

import Link from "next/link";
import { useSettingsPreview } from "../settings/settings-preview-store";
import type { ComponentProps } from "react";
import { DashboardShell } from "../../../../packages/ui/dashboard/dashboard-shell";
import { useTeamPreview } from "./team-preview-store";

/** Keeps the synthetic current actor's role consistent after a preview transfer.
 * Product components still take authorized workspace props from a future adapter. */
export function DashboardPreviewShell({ workspace, ...props }: ComponentProps<typeof DashboardShell>) {
  const team = useTeamPreview();
  const actor = team.members.find(row => row.userId === "preview-owner");
  const settings = useSettingsPreview();
  const deleting = settings.billing.mode === "deleting";
  return <DashboardShell {...props} workspace={workspace && workspace.id === team.workspace.id && actor ? { ...workspace, timezone: team.workspace.timezone, role: actor.role } : workspace}>{deleting ? <section className="rr-follow__status"><h1>Workspace deletion is requested</h1><p>Operational screens are stopped. The requesting owner can review recovery options before the deadline.</p><Link className="rr-dashboard__primary" href="/settings/deletion">View recovery options</Link></section> : <>{!settings.billing.writable && <p className="rr-clients__information">Read-only workspace. Existing records remain visible; subscription settings and permitted safety actions remain available.</p>}{props.children}</>}</DashboardShell>;
}

/** Complete synthetic directory. Preserve removed identities for history labels,
 * while forms filter removedAt just as they do with an authorized server directory. */
export function usePreviewOperators() {
  const team = useTeamPreview();
  const known = [
    { userId: "preview-owner", label: "Workspace owner (sample)" },
    { userId: "preview-admin", label: "Riya (sample)" },
    { userId: "preview-member", label: "Sam Lee (sample)" },
    ...team.members.filter(row => !["preview-owner", "preview-admin", "preview-member"].includes(row.userId)).map(row => ({ userId: row.userId, label: row.email })),
  ];
  return known.map(row => ({ ...row, removedAt: team.members.some(member => member.userId === row.userId) ? null : "2026-11-19T00:00:00Z" }));
}
