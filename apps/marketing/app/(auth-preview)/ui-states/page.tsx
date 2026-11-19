"use client";
import {useState} from "react";
import {FallbackScreen} from "../../../components/common/fallback-screen";
export default function Page(){const [kind,setKind]=useState<"error"|"not-found"|"loading"|"access">("error");return <><FallbackScreen kind={kind} onRetry={kind==="error"?()=>setKind("loading"):undefined}/><details className="rr-auth__review"><summary>Local preview tools</summary><label htmlFor="fallback-kind">Screen state<select id="fallback-kind" value={kind} onChange={e=>setKind(e.target.value as typeof kind)}>{["error","not-found","loading","access"].map(value=><option key={value}>{value}</option>)}</select></label></details></>;}
