"use client";
import {FallbackScreen} from "../components/common/fallback-screen";
export default function ErrorPage({reset}:{error:Error & {digest?:string};reset:()=>void}){return <FallbackScreen onRetry={reset}/>;}
