import Link from "next/link";
import type { AccountProfile } from "./contracts";
import type { DecisionFailure } from "../decisions/contracts";
import { AuthNotice } from "../auth/auth-fields";
import { mfaRecovery } from "./policy";
export function AccountHeading({ title, description }: { title: string; description: string }) { return <><Link className="rr-clients__back" href="/account">Back to account</Link><div className="rr-dashboard__page-heading"><h1>{title}</h1><p>{description}</p></div></>; }
export function AccountFailure({ failure, profile }: { failure: DecisionFailure | null; profile: AccountProfile }) { return failure ? <AuthNotice error>{failure.message}{["unauthenticated", "reauthentication_required"].includes(failure.code) && <Link className="rr-auth__notice-link" href="/login">Sign in again</Link>}{failure.code === "email_unverified" && <Link className="rr-auth__notice-link" href="/check-email">Verify email</Link>}{failure.code === "mfa_required" && <Link className="rr-auth__notice-link" href={mfaRecovery(profile)}>{profile.twoFactorEnabled ? "Verify authenticator" : "Set up authenticator"}</Link>}</AuthNotice> : null; }
export function downloadAccountPage(data: unknown, filename: string) { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
