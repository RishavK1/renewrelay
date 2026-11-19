"use client";
import { useEffect, useRef, useState } from "react";
import { AuthenticatorSetup } from "../../../../packages/ui/auth/auth-forms";
import { AuthHeading, AuthNotice } from "../../../../packages/ui/auth/auth-fields";
import type { AuthAction, AuthResult } from "../../../../packages/ui/auth/contracts";
import { enrollmentSession, startEnrollment } from "./enrollment-action";
import { loginAction } from "./login-action";

type Material = { setupKey: string; recoveryCodes: string[]; qrImage?: string };
const empty: Material = { setupKey: "", recoveryCodes: [] };
export function EnrollmentScreen({ identity }: { identity: { id: string; email: string } }) {
  const [material, setMaterial] = useState<Material>(empty);
  const [gate, setGate] = useState<"checking" | "ready" | "failed">("checking");
  const [message, setMessage] = useState("");
  const [finishing, setFinishing] = useState(false);
  const active = useRef(true);
  const verified = useRef(false);
  const hasMaterial = useRef(false);
  const request = useRef<AbortController | null>(null);
  const finishLock = useRef(false);
  const checkRevision = useRef(0);
  const operationBusy = useRef(false);
  const recheck = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    active.current = true;
    async function check() {
      if (operationBusy.current) return;
      const current = ++checkRevision.current;
      const controller = new AbortController();
      try {
        const result = await enrollmentSession(identity.id, AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]), verified.current);
        if (!active.current || current !== checkRevision.current) return;
        if (result.status === "error") { setMaterial(empty); hasMaterial.current = false; setMessage(result.message); setGate("failed"); }
        else setGate("ready");
      } catch {
        if (active.current && current === checkRevision.current) { setMessage("We couldn’t check your session. Reload this page to continue safely."); setGate("failed"); setMaterial(empty); hasMaterial.current = false; }
      }
    }
    recheck.current = check;
    const visibility = () => {
      if (document.visibilityState === "hidden") { ++checkRevision.current; setGate("checking"); }
      else void check();
    };
    const leave = () => { request.current?.abort(); setMaterial(empty); hasMaterial.current = false; setGate("checking"); };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    const warn = (event: BeforeUnloadEvent) => { if (hasMaterial.current && !finishLock.current) { event.preventDefault(); event.returnValue = ""; } };
    void check();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", restore);
    window.addEventListener("beforeunload", warn);
    return () => { active.current = false; request.current?.abort(); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", leave); window.removeEventListener("pageshow", restore); window.removeEventListener("beforeunload", warn); };
  }, [identity.id]);
  const action: AuthAction = async (command, abort) => {
    if (operationBusy.current) return { status: "error", message: "Wait for the current setup request to finish." };
    operationBusy.current = true; ++checkRevision.current;
    try {
    const controller = new AbortController(); request.current = controller;
    const signal = AbortSignal.any([abort, controller.signal, AbortSignal.timeout(20_000)]);
    const session = await enrollmentSession(identity.id, signal);
    if (session.status === "error") {
      if (session.code === "reauthentication_required") { setMaterial(empty); hasMaterial.current = false; setMessage(session.message); setGate("failed"); }
      return session;
    }
    if (command.operation === "enable-totp") {
      const started = await startEnrollment(command.password, identity.email, signal);
      if (started.result.status === "error" || !started.material) return started.result;
      let qrImage: string | undefined;
      try {
        const QRCode = await import("qrcode");
        qrImage = await QRCode.toDataURL(started.material.uri, { width: 232, margin: 4, errorCorrectionLevel: "M" });
      } catch { /* Manual key entry remains available when local QR rendering fails. */ }
      if (signal.aborted || !active.current) return { status: "error", message: "Setup was interrupted. Reload this page to start again." };
      const current = await enrollmentSession(identity.id, signal);
      if (current.status === "error") return current;
      hasMaterial.current = true;
      setMaterial({ setupKey: started.material.setupKey, recoveryCodes: started.material.recoveryCodes, qrImage });
      return { status: "success" };
    }
    if (command.operation === "verify-totp" && hasMaterial.current) {
      const result = await loginAction(command, signal);
      if (result.status === "error") return result;
      const current = await enrollmentSession(identity.id, signal, true);
      if (current.status === "error") return current;
      if (signal.aborted || !active.current) return { status: "error", message: "Verification was interrupted. Return to your account to check its status." };
      verified.current = true;
      // Discard provisioning key and QR immediately once the recovery step begins.
      setMaterial(previous => ({ setupKey: "", recoveryCodes: previous.recoveryCodes }));
      return { status: "success" };
    }
    return { status: "error", message: "Start authenticator setup again before continuing." };
    } finally {
      operationBusy.current = false;
      // A tab/app switch during session rotation must wait for the mutation to
      // settle before rechecking; an old-session read could erase valid new codes.
      if (active.current && document.visibilityState === "visible") void recheck.current();
    }
  };
  async function finish() {
    if (finishLock.current || !verified.current) return;
    finishLock.current = true; setFinishing(true); setMessage("");
    try {
      const result: AuthResult = await enrollmentSession(identity.id, AbortSignal.timeout(15_000), true);
      if (result.status === "error") { setMessage(result.message); return; }
      setMaterial(empty); hasMaterial.current = false;
      window.location.assign("/auth-complete");
    } catch { setMessage("We couldn’t confirm your session. Keep your saved codes safe and retry."); }
    finally { if (active.current) { setFinishing(false); finishLock.current = false; } }
  }
  return <>
    {gate === "checking" && <><AuthHeading title="Checking your session">Please wait before continuing authenticator setup.</AuthHeading><p role="status" className="rr-auth__hint">Please wait…</p></>}
    {gate === "failed" && <><AuthHeading title="Setup session needs checking">Your setup details have been cleared from this page.</AuthHeading><AuthNotice error>{message}</AuthNotice><a className="rr-auth__submit" href="/login?reauth=1">Log in again</a><a className="rr-auth__text-button" href="/auth-complete">Return to account</a></>}
    <div hidden={gate !== "ready"}>
      {gate === "ready" && message && <AuthNotice error>{message}</AuthNotice>}
      <fieldset className="rr-auth__enrollment-fieldset" disabled={finishing} aria-busy={finishing}>
        <AuthenticatorSetup action={action} onNavigate={() => { void finish(); }} {...material} accountEmail={identity.email} />
      </fieldset>
      {finishing && <p role="status" className="rr-auth__hint">Confirming your session…</p>}
    </div>
  </>;
}
