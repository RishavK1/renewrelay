"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Building2, CalendarRange, Menu, UsersRound, Users, Settings, UserRound, Monitor, ShieldCheck, Download, Trash2, Bell, Mail, ChevronsUpDown, X } from "lucide-react";
import Link from "next/link";
import type { DashboardWorkspace } from "./contracts";

type Personal = { name: string; email: string; section: "Recovery codes" | "Overview" | "Sessions" | "Security activity" | "Data export" | "Deletion" };
type Props = { personal?: Personal; children: ReactNode; workspace: DashboardWorkspace | null; preview?: boolean; clientsHref?: string; activeSection?: "Renewals" | "Clients" | "Team" | "Settings" | "Account" | "Alerts" | "Deliveries" | "Workspaces" };

function Navigation({ preview, clientsHref, activeSection = "Renewals", canViewTeam = false, canViewAlerts = false, onNavigate, personal }: Pick<Props, "preview" | "clientsHref" | "activeSection"> & { canViewTeam?: boolean; canViewAlerts?: boolean; onNavigate?: () => void; personal?: Personal }) {
  if (personal) return <nav className="rr-dashboard__navigation" aria-label="Account navigation">{([{ href: "/account", label: "Overview", Icon: UserRound }, { href: "/account/sessions", label: "Sessions", Icon: Monitor }, { href: "/account/recovery-codes", label: "Recovery codes", Icon: ShieldCheck }, { href: "/account/security", label: "Security activity", Icon: ShieldCheck }, { href: "/account/export", label: "Data export", Icon: Download }, { href: "/account/delete", label: "Deletion", Icon: Trash2 }] as const).map(({ href, label, Icon }) => <Link key={href} href={href} aria-current={personal.section === label ? "page" : undefined} onClick={onNavigate}><Icon size={19} aria-hidden="true" />{label}</Link>)}</nav>;
  return <nav className="rr-dashboard__navigation" aria-label="Workspace navigation">
    <Link href="/dashboard" aria-current={activeSection === "Renewals" ? "page" : undefined} onClick={onNavigate}><CalendarRange size={19} aria-hidden="true" />Renewals</Link>
    {clientsHref ? <Link href={clientsHref} aria-current={activeSection === "Clients" ? "page" : undefined} onClick={onNavigate}><UsersRound size={19} aria-hidden="true" />Clients</Link> : preview && <span aria-disabled="true" title="Client screen is the next UI step"><UsersRound size={19} aria-hidden="true" />Clients</span>}
    {canViewAlerts && <Link href="/alerts" aria-current={activeSection === "Alerts" ? "page" : undefined} onClick={onNavigate}><Bell size={19} aria-hidden="true" />Alerts</Link>}
    <Link href="/deliveries" aria-current={activeSection === "Deliveries" ? "page" : undefined} onClick={onNavigate}><Mail size={19} aria-hidden="true" />Deliveries</Link>
    {canViewTeam && <Link href="/team" aria-current={activeSection === "Team" ? "page" : undefined} onClick={onNavigate}><Users size={19} aria-hidden="true" />Team</Link>}
    {canViewTeam && <Link href="/settings" aria-current={activeSection === "Settings" ? "page" : undefined} onClick={onNavigate}><Settings size={19} aria-hidden="true" />Settings</Link>}
    <Link href="/account" aria-current={activeSection === "Account" ? "page" : undefined} onClick={onNavigate}><UserRound size={19} aria-hidden="true" />Account</Link>
  </nav>;
}

function WorkspaceIdentity({ workspace }: { workspace: DashboardWorkspace | null }) {
  return <Link href="/workspaces" className="rr-dashboard__workspace rr-dashboard__workspace-switch" aria-label={workspace ? `Switch workspace: ${workspace.name}` : "Choose workspace"}>
    <span className="rr-dashboard__workspace-icon" aria-hidden="true"><Building2 size={19} strokeWidth={1.6} /></span>
    <div><span className="rr-dashboard__workspace-name" title={workspace?.name}>{workspace?.name ?? "Your workspace"}</span><span className="rr-dashboard__workspace-role">{workspace ? `${workspace.role[0]!.toUpperCase()}${workspace.role.slice(1)}` : "Workspace access"}</span></div><ChevronsUpDown size={16} className="rr-dashboard__switch-icon" aria-hidden="true"/>
  </Link>;
}

function PersonalIdentity({ personal }: { personal: Personal }) { return <div className="rr-dashboard__workspace"><span className="rr-dashboard__workspace-icon" aria-hidden="true"><UserRound size={19} /></span><div><span className="rr-dashboard__workspace-name">{personal.name || "Your account"}</span>{personal.email && <span className="rr-dashboard__workspace-role" title={personal.email} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{personal.email}</span>}</div></div>; }

export function DashboardShell({ children, workspace, preview = false, clientsHref, activeSection = "Renewals", personal }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 960px)");
    const closeOnDesktop = () => { if (desktop.matches) dialog.current?.close(); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  function close() { dialog.current?.close(); }
  return <div className="rr-dashboard">
    <aside className="rr-dashboard__sidebar" aria-label={personal ? "Account sidebar" : "Workspace sidebar"}>
      <Link className="rr-dashboard__brand" href="/dashboard">RenewRelay</Link>
      {personal ? <PersonalIdentity personal={personal} /> : <WorkspaceIdentity workspace={workspace} />}
      <Navigation preview={preview} clientsHref={clientsHref} activeSection={activeSection} personal={personal} canViewTeam={!!workspace && workspace.role !== "member"} canViewAlerts={workspace?.role === "owner"} />
      <p className="rr-dashboard__sidebar-note">{personal ? <Link href="/workspaces">Choose workspace</Link> : <>Client renewals,<br />clearly under control.</>}</p>
    </aside>
    <div className="rr-dashboard__body">
      <header className="rr-dashboard__topbar">
        <div className="rr-dashboard__mobile-context">
          <button ref={opener} type="button" className="rr-dashboard__icon-button" aria-label={personal ? "Open account navigation" : "Open workspace navigation"} aria-controls="dashboard-navigation" aria-expanded={open} aria-haspopup="dialog" onClick={() => {
            if (!dialog.current || dialog.current.open) return;
            dialog.current.showModal(); setOpen(true); closeButton.current?.focus();
          }}><Menu size={21} aria-hidden="true" /></button>
          <span className="rr-dashboard__mobile-workspace" title={workspace?.name}>{personal ? "Your account" : workspace?.name ?? "Your workspace"}</span>
        </div>
        <span className="rr-dashboard__desktop-context">{personal ? "Account" : "Workspace"} <span aria-hidden="true">/</span> <strong>{personal?.section ?? activeSection}</strong></span>
        {preview && <span className="rr-dashboard__preview-badge">UI preview</span>}
      </header>
      <main id="main-content" className="rr-dashboard__main">
        {children}
        {preview && <p className="rr-dashboard__preview-note">{personal ? "Sample account. No real identity or session data is connected." : "Sample workspace. No account, client or renewal data is connected."}</p>}
      </main>
    </div>
    <dialog ref={dialog} id="dashboard-navigation" className="rr-dashboard__drawer" aria-labelledby="dashboard-navigation-title" onClose={() => {
      setOpen(false);
      if (!window.matchMedia("(min-width: 960px)").matches) opener.current?.focus();
    }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    }}>
      <div className="rr-dashboard__drawer-heading"><h2 id="dashboard-navigation-title">{personal ? "Account navigation" : "Workspace navigation"}</h2><button ref={closeButton} type="button" className="rr-dashboard__icon-button" aria-label={personal ? "Close account navigation" : "Close workspace navigation"} onClick={close}><X size={21} aria-hidden="true" /></button></div>
      <Link className="rr-dashboard__brand" href="/dashboard" onClick={close}>RenewRelay</Link>
      {personal ? <PersonalIdentity personal={personal} /> : <WorkspaceIdentity workspace={workspace} />}
      <Navigation preview={preview} clientsHref={clientsHref} activeSection={activeSection} personal={personal} canViewTeam={!!workspace && workspace.role !== "member"} canViewAlerts={workspace?.role === "owner"} onNavigate={close} />
    </dialog>
  </div>;
}
