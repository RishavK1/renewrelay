"use client";
import { useSyncExternalStore } from "react";
const query="(prefers-reduced-motion: reduce)";
function subscribe(changed:()=>void){const media=window.matchMedia(query);media.addEventListener("change",changed);return()=>media.removeEventListener("change",changed);}
function snapshot(){return window.matchMedia(query).matches;}
// The server cannot know a client media preference. Start conservatively without
// motion on both server and hydration, then subscribe to the actual preference.
export function useSafeReducedMotion(){return useSyncExternalStore(subscribe,snapshot,()=>true);}
