"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { WorkspaceView } from "../../../../packages/ui/workspace/contracts";
export const initialWorkspaces: WorkspaceView[] = [
  {id:"00000000-0000-4000-8000-000000000001",name:"Northline Studio",timezone:"Asia/Kolkata",version:1,role:"owner"},
  {id:"00000000-0000-4000-8000-000000000011",name:"Harbor Collective",timezone:"Europe/London",version:1,role:"member"},
  {id:"00000000-0000-4000-8000-000000000021",name:"Atlas Digital",timezone:"America/New_York",version:1,role:"admin"},
];
type Store={selected:WorkspaceView;workspaces:WorkspaceView[];select:(workspace:WorkspaceView)=>void;sync:(workspace:WorkspaceView)=>void;add:(workspace:WorkspaceView)=>void};
const Context=createContext<Store|null>(null);
export function WorkspaceDirectoryProvider({children}:{children:ReactNode}){
 const [workspaces,setWorkspaces]=useState(initialWorkspaces),[selected,setSelected]=useState(initialWorkspaces[0]!);
 function merge(workspace:WorkspaceView){setWorkspaces(rows=>rows.some(row=>row.id===workspace.id)?rows.map(row=>row.id===workspace.id?workspace:row):[...rows,workspace]);}
 const sync=useCallback((workspace:WorkspaceView)=>{setWorkspaces(rows=>{const current=rows.find(row=>row.id===workspace.id);return current&&(current.name!==workspace.name||current.timezone!==workspace.timezone||current.role!==workspace.role||current.version!==workspace.version)?rows.map(row=>row.id===workspace.id?workspace:row):rows;});},[]);
 return <Context.Provider value={{selected,workspaces,select:workspace=>{merge(workspace);setSelected(workspace);},add:merge,sync}}>{children}</Context.Provider>;
}
export function useWorkspaceDirectory(){const store=useContext(Context);if(!store)throw Error("Workspace directory provider is required");return store;}
