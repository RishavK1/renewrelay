"use client";
import { useEffect, useRef, useState } from "react";
import { AuthHeading, AuthNotice, AuthSuccessMark } from "../../../../packages/ui/auth/auth-fields";
import { confirmSession, signOut } from "./login-action";

type Identity = { id: string; email: string; mfaVerified: boolean };
export function SessionScreen({ identity }: { identity: Identity }) {
  const [state, setState] = useState<"checking" | "ready" | "unknown" | "signing-out">("checking");
  const [message, setMessage] = useState("");
  const request = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const signingOut = useRef(false);
  useEffect(() => {
    let active = true;
    async function check() {
      request.current?.abort();
      const controller = new AbortController(); request.current = controller;
      const current = ++revision.current;
      setState("checking"); setMessage("");
      try {
        const valid = await confirmSession(identity.id, AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]));
        if (!active || controller.signal.aborted || current !== revision.current) return;
        if (!valid) { window.location.replace("/login"); return; }
        setState("ready");
      } catch {
        if (active && !controller.signal.aborted && current === revision.current) { setState("unknown"); setMessage("We couldn’t confirm your session. Check your connection and retry."); }
      }
    }
    const visible = () => { if (!signingOut.current && document.visibilityState === "visible") void check(); };
    const restored = (event: PageTransitionEvent) => { if (!signingOut.current && event.persisted) void check(); };
    void check();
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("pageshow", restored);
    return () => { active = false; request.current?.abort(); document.removeEventListener("visibilitychange", visible); window.removeEventListener("pageshow", restored); };
  }, [identity.id]);
  async function logout() {
    if (signingOut.current) return;
    signingOut.current = true;
    request.current?.abort(); ++revision.current;
    const controller = new AbortController(); request.current = controller;
    setState("signing-out"); setMessage("");
    try {
      const result = await signOut(AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]));
      if (controller.signal.aborted) return;
      if (result.status === "success") { window.location.replace("/login"); return; }
      setMessage(result.message); setState("unknown");
    } catch {
      if (!controller.signal.aborted) { setMessage("We couldn’t confirm sign-out. Check your connection and retry."); setState("unknown"); }
    } finally { signingOut.current = false; }
  }
  if (state === "checking" || state === "signing-out") return <><AuthHeading title={state === "checking" ? "Checking your session" : "Signing out"}>Please wait while we confirm your account’s session.</AuthHeading><p className="rr-auth__hint" role="status">Please wait…</p></>;
  if (state === "unknown") return <><AuthHeading title="Session check isn’t complete">Your account details stay hidden until we can confirm your session.</AuthHeading><AuthNotice error>{message}</AuthNotice><button className="rr-auth__submit" type="button" onClick={() => window.location.reload()}>Retry session check</button><button className="rr-auth__text-button" type="button" onClick={logout}>Try signing out</button></>;
  return <><AuthSuccessMark /><AuthHeading title="You’re signed in">Your account session has been confirmed.</AuthHeading><p className="rr-auth__recipient">{identity.email}</p><AuthNotice>{identity.mfaVerified ? "Authenticator verification is complete for this session." : "Add an authenticator to create a workspace or use owner and admin access."}</AuthNotice>{!identity.mfaVerified && <a className="rr-auth__submit rr-auth__after-form" href="/setup-authenticator">Set up authenticator</a>}<p className="rr-auth__hint rr-auth__after-form">Workspace screens are not connected in this batch.</p><button className={identity.mfaVerified ? "rr-auth__submit rr-auth__after-form" : "rr-auth__text-button"} type="button" onClick={logout}>Sign out</button></>;
}
