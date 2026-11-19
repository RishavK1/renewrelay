import { redirect } from "next/navigation";
import { AuthShell } from "../../../../packages/ui/auth/auth-shell";
import { EnrollmentScreen } from "../../components/auth/enrollment-screen";
import { currentAuthSession, sessionDestination } from "../../server/auth-session";
export const metadata = { title: "Set up authenticator" };
export default async function Page() {
  const session = await currentAuthSession();
  const destination = sessionDestination(session);
  if (!session || destination !== "/auth-complete") redirect(destination);
  if (session.user.twoFactorEnabled) redirect("/auth-complete");
  if (Date.now() - session.session.createdAt.getTime() > 600_000) redirect("/login?reauth=1");
  return <AuthShell screen="setup-authenticator"><EnrollmentScreen identity={{ id: session.user.id, email: session.user.email }} /></AuthShell>;
}
