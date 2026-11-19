"use client";

import { useRouter } from "next/navigation";
import { AuthShell } from "../../../../packages/ui/auth/auth-shell";
import { CredentialsForm, EmailForm } from "../../../../packages/ui/auth/auth-forms";
import { signupAction } from "./signup-action";

export function SignupScreen() {
  const router = useRouter();
  return <AuthShell screen="signup"><CredentialsForm mode="signup" action={signupAction} onNavigate={() => router.push("/check-email")} /></AuthShell>;
}
export function CheckEmailScreen() {
  return <AuthShell screen="check-email"><EmailForm kind="verification" action={signupAction} onNavigate={() => {}} /></AuthShell>;
}
