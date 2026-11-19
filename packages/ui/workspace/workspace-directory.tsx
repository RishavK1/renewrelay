"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { page as pageInput } from "../../contracts/api";
import { AuthNotice } from "../auth/auth-fields";
import { useDecisionAction } from "../decisions/use-preview-action";
import type { DecisionFailure } from "../decisions/contracts";
import type { WorkspaceView } from "./contracts";
export { pageInput as workspaceListInput };
export type WorkspacePage={items:WorkspaceView[];nextCursor:string|null};
export type WorkspaceDirectoryCommand={operation:"list";after?:string;limit:number}|{operation:"open";workspaceId:string};
export type WorkspaceDirectoryResult=DecisionFailure|{status:"success";operation:"list";page:WorkspacePage}|{status:"success";operation:"open";workspace:WorkspaceView};
/** Open binds GET /workspaces/{wid}, not a switch mutation. Adapter owns live
 * auth/envelope/cursor/MFA, route context and tenant-keyed caches/aborting old work. */
export type WorkspaceDirectoryAction=(command:WorkspaceDirectoryCommand,signal:AbortSignal)=>Promise<WorkspaceDirectoryResult>;
export function WorkspaceDirectory({initialPage,currentId,action,onOpened,pageSize=25,mfaHref="/two-factor"}:{initialPage:WorkspacePage;currentId:string|null;action:WorkspaceDirectoryAction;onOpened:(workspace:WorkspaceView)=>void;pageSize?:number;mfaHref?:"/two-factor"|"/setup-authenticator"}){
 const [page,setPage]=useState(initialPage),[number,setNumber]=useState(1),[opening,setOpening]=useState<string|null>(null),[updated,setUpdated]=useState(false);
 const read=useDecisionAction(action,()=>false),heading=useRef<HTMLHeadingElement>(null);
 const failure=read.failure,hidden=!!failure&&["unauthenticated","email_unverified","mfa_required","forbidden"].includes(failure.code);
 async function load(next=false){setUpdated(false);const result=await read.run({operation:"list",limit:pageSize,...(next&&page.nextCursor?{after:page.nextCursor}:{})});if(result?.status==="success"&&result.operation==="list"){setPage(result.page);setNumber(n=>next?n+1:1);setUpdated(true);heading.current?.focus({preventScroll:true});}}
 async function open(id:string){setUpdated(false);setOpening(id);const result=await read.run({operation:"open",workspaceId:id});setOpening(null);if(result?.status==="success"&&result.operation==="open")onOpened(result.workspace);}
 return <div className="rr-workspaces" aria-busy={read.pending}>
  <div className="rr-clients__heading"><div className="rr-dashboard__page-heading"><h1>Your workspaces</h1><p>Choose the agency workspace you want to work in.</p></div><Link className="rr-dashboard__primary" href="/workspace-setup">Create workspace</Link></div>
  <section className="rr-workspaces__context"><h2>A separate home for each team</h2><p>Your role and business timezone belong to each workspace. Access is checked again when you open one. A listing does not confirm its subscription or deletion status.</p></section>
  <div className="rr-workspaces__toolbar"><button className="rr-clients__outline-action" disabled={read.pending||read.remaining>0} onClick={()=>load()}>Refresh workspaces</button><Link className="rr-clients__outline-action" href="/account">Personal account</Link></div>
  {failure&&<AuthNotice error>{failure.code==="connection_error"?"Workspaces couldn’t load. Check your connection and try again.":failure.message}{!hidden&&<p>Your selection has not changed. Refresh the directory if its records are out of date.</p>}{read.remaining>0&&<p role="status">Try again in {read.remaining} seconds.</p>}{["unauthenticated","email_unverified","mfa_required"].includes(failure.code)&&<Link className="rr-auth__notice-link" href={failure.code==="unauthenticated"?"/login":failure.code==="email_unverified"?"/check-email":mfaHref}>Restore account access</Link>}</AuthNotice>}
  {!hidden&&<section aria-labelledby="workspace-list-heading"><div className="rr-workspaces__list-heading"><h2 ref={heading} tabIndex={-1} id="workspace-list-heading">Available memberships</h2><p>Page {number} · {page.items.length} {page.items.length===1?"workspace":"workspaces"} returned</p></div>{page.items.length?<ul className="rr-workspaces__list">{page.items.map(row=><li key={row.id}><div className="rr-workspaces__identity"><span className="rr-workspaces__icon" aria-hidden="true"><Building2 size={22}/></span><div><h3>{row.name}</h3>{row.id===currentId&&<span className="rr-workspaces__current">Current workspace</span>}</div></div><dl><div><dt>Your role</dt><dd>{row.role[0]!.toUpperCase()+row.role.slice(1)}</dd></div><div><dt>Business timezone</dt><dd>{row.timezone}</dd></div></dl><button className={row.id===currentId?"rr-clients__outline-action":"rr-dashboard__primary"} disabled={read.pending||read.remaining>0} onClick={()=>open(row.id)} aria-label={`${row.id===currentId?"Continue in":"Open"} ${row.name}`}>{opening===row.id&&read.pending?"Checking access…":row.id===currentId?"Continue in workspace":"Open workspace"}</button></li>)}</ul>:<div className="rr-workspaces__empty"><h3>No workspace memberships returned</h3><p>Create a workspace, or ask the team owner to invite you. Memberships on another page, if any, are not included in this result.</p><Link className="rr-dashboard__primary" href="/workspace-setup">Create your workspace</Link></div>}<div className="rr-workspaces__toolbar rr-workspaces__pagination">{page.nextCursor&&<button className="rr-dashboard__primary" disabled={read.pending||read.remaining>0} onClick={()=>load(true)}>Load next page</button>}{number>1&&<button className="rr-clients__outline-action" disabled={read.pending||read.remaining>0} onClick={()=>load()}>Back to first page</button>}</div></section>}
  {updated&&<p className="rr-workspaces__feedback" role="status">Workspace directory updated.</p>}
 </div>;
}
