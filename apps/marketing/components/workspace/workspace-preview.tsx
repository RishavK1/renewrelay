"use client";

import { useRef, useState } from "react";
import { WorkspaceSetup } from "../../../../packages/ui/workspace/workspace-setup";
import type { WorkspaceCreateAction, WorkspaceView } from "../../../../packages/ui/workspace/contracts";

import { useRouter } from "next/navigation";
import { useWorkspaceDirectory } from "./workspace-directory-store";

type Scenario = "normal" | "mfa-setup" | "mfa-verify" | "signed-out" | "email-unverified" | "connection" | "rate-limit" | "validation" | "conflict";
const scenarios: { value: Scenario; label: string }[] = [
  { value: "normal", label: "Normal preview flow" }, { value: "mfa-setup", label: "Authenticator setup required" },
  { value: "mfa-verify", label: "Authenticator verification required" }, { value: "signed-out", label: "Expired session" },
  { value: "email-unverified", label: "Email verification required" }, { value: "connection", label: "Unconfirmed connection result" },
  { value: "rate-limit", label: "Rate limit (10-second sample)" }, { value: "validation", label: "Server field validation" },
  { value: "conflict", label: "Conflicting request" },
];

export function WorkspacePreview() {
  const directory = useWorkspaceDirectory(), router = useRouter();
  const receipt = useRef<{ input: string; workspace: WorkspaceView } | null>(null);
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [revision, setRevision] = useState(0);
  const action: WorkspaceCreateAction = async (draft, signal) => {
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) { reject(new Error("Cancelled")); return; }
      const abort = () => { window.clearTimeout(timer); reject(new Error("Cancelled")); };
      const timer = window.setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 650);
      signal.addEventListener("abort", abort, { once: true });
    });
    switch (scenario) {
      case "connection": throw new Error("Synthetic unconfirmed connection result");
      case "mfa-setup": return { status: "error", code: "mfa_required", message: "Set up and verify an authenticator before creating a workspace.", recovery: "setup-authenticator" };
      case "mfa-verify": return { status: "error", code: "mfa_required", message: "Verify your current sign-in with your authenticator to continue.", recovery: "two-factor" };
      case "signed-out": return { status: "error", code: "unauthenticated", message: "Your session has expired. Log in again to continue.", recovery: "login" };
      case "email-unverified": return { status: "error", code: "email_unverified", message: "Verify your email address before creating a workspace.", recovery: "check-email" };
      case "rate-limit": return { status: "error", code: "rate_limited", message: "Too many requests. Wait a moment before trying again.", retryAfterSeconds: 10 };
      case "validation": return { status: "error", code: "invalid_request", message: "Check the highlighted workspace details.", fieldErrors: { name: ["Check your workspace name and try again. (Sample server error)"] } };
      case "conflict": return { status: "error", code: "idempotency_conflict", message: "This request couldn’t be matched. Return to your account to check your workspaces before starting another request." };
      default: { const input = JSON.stringify(draft); const workspace = receipt.current?.input === input ? receipt.current.workspace : { ...draft, id: crypto.randomUUID(), version: 1, role: "owner" as const }; receipt.current = { input, workspace }; return { status: "success", workspace }; }
    }
  };
  return <>
    <WorkspaceSetup key={revision} action={action} preview onCreated={directory.add} onContinue={workspace => { directory.select(workspace); router.push("/dashboard"); }} />
    <details className="rr-auth__review"><summary>Local preview tools</summary>
      <p>Sample outcomes only. No workspace, session or trial is created. Switch the scenario to Normal to preview a successful retry.</p>
      <div className="rr-auth__review-controls"><label htmlFor="workspace-preview-scenario">Submission scenario<select id="workspace-preview-scenario" value={scenario} onChange={event => setScenario(event.target.value as Scenario)}>{scenarios.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><button className="rr-auth__text-button" type="button" onClick={() => { receipt.current = null; setRevision(previous => previous + 1); }}>Reset preview</button></div>
      <nav aria-label="Onboarding preview navigation"><a href="/login">Log in</a><a href="/setup-authenticator">Authenticator setup</a><a href="/auth-complete">Account preview</a></nav>
    </details>
  </>;
}
