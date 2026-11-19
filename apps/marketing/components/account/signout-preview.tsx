"use client";
import {DashboardShell} from "../../../../packages/ui/dashboard/dashboard-shell";
import {SignoutScreen} from "../../../../packages/ui/account/signout-screen";
import {useAccountPreview} from "./account-preview-store";
export function SignoutPreview(){const store=useAccountPreview();return <DashboardShell workspace={null} personal={{name:"Your account",email:"",section:"Overview"}} preview><SignoutScreen preview action={async()=>({status:"success"})} onEnded={()=>store.endIdentity("signed-out")} onUnconfirmed={()=>store.endIdentity("revocation-unconfirmed")}/></DashboardShell>;}
