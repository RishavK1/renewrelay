"use client";
import { AuthShell } from "../../../../packages/ui/auth/auth-shell";
import { CredentialsForm, TwoFactorForm } from "../../../../packages/ui/auth/auth-forms";
import type { AuthScreen } from "../../../../packages/ui/auth/contracts";
import { loginAction } from "./login-action";

function navigate(next: AuthScreen) {
  // Full navigation discards stale client-router identity payloads on sign-in.
  window.location.assign(next === "two-factor" ? "/two-factor" : "/auth-complete");
}
export function LoginScreen() {
  return <AuthShell screen="login"><CredentialsForm mode="login" action={loginAction} onNavigate={navigate} /></AuthShell>;
}
export function ChallengeScreen() {
  return <AuthShell screen="two-factor"><TwoFactorForm action={loginAction} onNavigate={navigate} /></AuthShell>;
}
