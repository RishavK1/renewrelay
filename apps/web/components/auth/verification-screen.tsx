"use client";

import { useEffect, useRef, useState } from "react";
import { AuthShell } from "../../../../packages/ui/auth/auth-shell";
import { AuthHeading, AuthNotice, AuthSuccessMark } from "../../../../packages/ui/auth/auth-fields";
import type { AuthResult } from "../../../../packages/ui/auth/contracts";
import { verifyEmail } from "./signup-action";

export function VerificationScreen() {
  const verification = useRef<Promise<AuthResult> | null>(null);
  const revision = useRef(0);
  const [result, setResult] = useState<AuthResult | null>(null);
  useEffect(() => {
    // Fragments are not sent in page requests/referrers. Erase before verification.
    // Retain one promise across Strict Mode effect replay, never a token in storage.
    function readLink(): Promise<AuthResult> {
      const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
      window.history.replaceState(window.history.state, "", "/verify-email");
      return token && token.length <= 4096
        ? verifyEmail(token).catch(() => ({ status: "error", message: "We couldn’t connect to verify this link. Reopen the link from your email to try again." }))
        : Promise.resolve({ status: "error", code: "invalid_verification", message: "Open the complete verification link from your email, or request another link." });
    }
    let active = true;
    function show(promise: Promise<AuthResult>) {
      const current = ++revision.current;
      setResult(null);
      void promise.then(value => { if (active && current === revision.current) setResult(value); });
    }
    if (!verification.current) verification.current = readLink();
    show(verification.current);
    // Opening another email link in this tab may change only the fragment. Never
    // leave the previous link's success visible or let an older request win.
    const onLink = () => { verification.current = readLink(); show(verification.current); };
    window.addEventListener("hashchange", onLink);
    return () => { active = false; window.removeEventListener("hashchange", onLink); };
  }, []);
  return <AuthShell screen="verify-email">
    {!result ? <><AuthHeading title="Verifying your email">Please wait while we check your verification link.</AuthHeading><p className="rr-auth__hint" role="status">Verification in progress…</p></>
      : result.status === "success" ? <><AuthSuccessMark /><AuthHeading title="Email verified">Your email is verified. You can now log in.</AuthHeading><a className="rr-auth__submit" href="/login">Continue to log in</a></>
      : <><AuthHeading title="Verification isn’t complete">We couldn’t verify your email with this link.</AuthHeading><AuthNotice error>{result.message}</AuthNotice><a className="rr-auth__submit" href="/check-email">Request another link</a><a className="rr-auth__text-button" href="/login">Back to log in</a></>}
  </AuthShell>;
}
