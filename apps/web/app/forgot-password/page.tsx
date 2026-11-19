import { AuthShell } from "../../../../packages/ui/auth/auth-shell";
import { AuthBack, AuthHeading, AuthNotice } from "../../../../packages/ui/auth/auth-fields";
export const metadata = { title: "Password recovery" };
export default function Page() {
  return <AuthShell screen="forgot-password"><AuthBack /><AuthHeading title="Password recovery is next">The password reset flow will be connected in a separate authentication batch.</AuthHeading><AuthNotice>This local build cannot request a password reset through the UI yet. No reset email has been sent.</AuthNotice><a className="rr-auth__submit" href="/login">Back to log in</a></AuthShell>;
}
