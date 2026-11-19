import { redirect } from "next/navigation";
import { AuthShell } from "../../../../packages/ui/auth/auth-shell";
import { SessionScreen } from "../../components/auth/session-screen";
import { currentAuthSession, sessionDestination } from "../../server/auth-session";
export const metadata = { title: "Signed in" };
export default async function Page() {
  const session = await currentAuthSession();
  const destination = sessionDestination(session);
  if (!session || destination !== "/auth-complete") redirect(destination);
  return <AuthShell screen="auth-complete"><SessionScreen identity={{ id: session.user.id, email: session.user.email, mfaVerified: !!session.user.twoFactorEnabled && !!session.session.mfaVerifiedAt }} /></AuthShell>;
}
