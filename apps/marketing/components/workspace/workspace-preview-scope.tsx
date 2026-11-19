"use client";
import { useEffect, type ReactNode } from "react";
import { ClientPreviewProvider } from "../clients/client-preview-store";
import { TeamPreviewProvider, useTeamPreview } from "../team/team-preview-store";
import { SettingsPreviewProvider } from "../settings/settings-preview-store";
import { WorkspaceDirectoryProvider,useWorkspaceDirectory } from "./workspace-directory-store";
function Sync(){const directory=useWorkspaceDirectory(),team=useTeamPreview();const actor=team.members.find(row=>row.userId==="preview-owner");const {id,name,timezone,version}=team.workspace,role=actor?.role??team.workspace.role;const sync=directory.sync;useEffect(()=>{sync({id,name,timezone,version,role});},[id,name,timezone,version,role,sync]);return null;}
function Scope({children}:{children:ReactNode}){const {selected}=useWorkspaceDirectory();return <ClientPreviewProvider key={selected.id}><TeamPreviewProvider><SettingsPreviewProvider><Sync/>{children}</SettingsPreviewProvider></TeamPreviewProvider></ClientPreviewProvider>;}
export function WorkspacePreviewScope({children}:{children:ReactNode}){return <WorkspaceDirectoryProvider><Scope>{children}</Scope></WorkspaceDirectoryProvider>;}
