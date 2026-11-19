"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "../../../../packages/ui/dashboard/dashboard-shell";
import { WorkspaceDirectory,workspaceListInput,type WorkspaceDirectoryAction,type WorkspacePage } from "../../../../packages/ui/workspace/workspace-directory";
import { useWorkspaceDirectory } from "./workspace-directory-store";
import type { WorkspaceView } from "../../../../packages/ui/workspace/contracts";
const scenarios=["normal","single","empty","loading","load-error","read-error","open-error","removed","deleting","session","email","mfa","no-mfa","member-only","lookahead-mfa","rate","long-name"] as const;
type Scenario=typeof scenarios[number];
function pageOf(rows:WorkspaceView[],after?:string,limit=2):WorkspacePage{const rest=rows.filter(row=>!after||row.id>after).sort((a,b)=>a.id.localeCompare(b.id));return {items:rest.slice(0,limit),nextCursor:rest.length>limit?rest[limit-1]!.id:null};}
export function WorkspaceDirectoryPreview(){
 const store=useWorkspaceDirectory(),router=useRouter();const [scenario,setScenario]=useState<Scenario>("normal");
 const rows=scenario==="empty"?[]:scenario==="single"?store.workspaces.slice(0,1):scenario==="member-only"?store.workspaces.filter(row=>row.role==="member"):scenario==="long-name"?store.workspaces.map(row=>({...row,name:"A long agency workspace name with a continuous reference_"+"studio_".repeat(14)})):store.workspaces;
 const denied=["session","email","mfa","no-mfa","lookahead-mfa"].includes(scenario);
 const recovery=scenario==="session"?"/login":scenario==="email"?"/check-email":scenario==="no-mfa"?"/setup-authenticator":"/two-factor";
 const action:WorkspaceDirectoryAction=async(command,signal)=>{
  await new Promise<void>(resolve=>{const timer=setTimeout(resolve,350);signal.addEventListener("abort",()=>{clearTimeout(timer);resolve();},{once:true});});
  if(scenario==="rate")return {status:"error",code:"rate_limited",message:"Wait before reading workspaces again.",retryAfterSeconds:3};
  if(command.operation==="list"){
   if(scenario==="read-error")return {status:"error",code:"temporarily_unavailable",message:"The directory couldn’t refresh. The previous page remains visible and may have changed."};
   const parsed=workspaceListInput.safeParse({after:command.after,limit:String(command.limit)});if(!parsed.success)return {status:"error",code:"invalid_request",message:"Check pagination parameters."};
   return {status:"success",operation:"list",page:pageOf(rows,parsed.data.after,parsed.data.limit)};
  }
  if(scenario==="open-error")throw Error("Synthetic failed workspace read");
  if(scenario==="removed")return {status:"error",code:"not_found",message:"This membership is no longer available. Refresh the directory or ask its owner about access."};
  if(scenario==="deleting")return {status:"error",code:"workspace_deleting",message:"This workspace is scheduled for deletion. Its operational screens cannot open."};
  const workspace=store.workspaces.find(row=>row.id===command.workspaceId);
  return workspace?{status:"success",operation:"open",workspace}:{status:"error",code:"not_found",message:"This workspace is no longer available."};
 };
 return <><DashboardShell workspace={store.selected} activeSection="Workspaces" preview clientsHref="/clients">
  {denied||scenario==="loading"||scenario==="load-error"?<section className="rr-follow__status" aria-busy={scenario==="loading"}><h1>{denied?"Restore account access":scenario==="loading"?"Loading your workspaces…":"Workspaces couldn’t load"}</h1><p>{scenario==="lookahead-mfa"?"An owner or admin membership in the requested page window requires verified MFA. The entire page is unavailable until verification.":denied?"Restore your sign-in, verified email or authenticator before listing workspaces.":scenario==="loading"?"Waiting for your membership directory.":"Check your connection and try again."}</p><div className="rr-follow__actions">{denied?<Link className="rr-dashboard__primary" href={recovery}>Continue</Link>:scenario==="load-error"&&<button className="rr-dashboard__primary" onClick={()=>setScenario("normal")}>Try again</button>}</div></section>:<WorkspaceDirectory key={scenario+JSON.stringify(store.workspaces)} initialPage={pageOf(rows)} currentId={store.selected.id} action={action} pageSize={2} onOpened={workspace=>{store.select(workspace);router.push("/dashboard");}}/>}
 </DashboardShell><details className="rr-auth__review"><summary>Local preview tools</summary><p>Synthetic membership directory only. Switching resets local workspace records and form state; it does not change a real membership, session or stored workspace. Creation adds only a temporary sample workspace.</p><div className="rr-auth__review-controls"><label htmlFor="directory-scenario">Screen state<select id="directory-scenario" value={scenario} onChange={e=>setScenario(e.target.value as Scenario)}>{scenarios.map(value=><option key={value}>{value}</option>)}</select></label></div></details></>;
}
