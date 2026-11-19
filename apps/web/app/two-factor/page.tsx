import { redirect } from "next/navigation";
import { ChallengeScreen } from "../../components/auth/login-screen";
import { currentAuthSession, sessionDestination } from "../../server/auth-session";
export const metadata = { title: "Verify it’s you" };
export default async function Page() {
  const session = await currentAuthSession();
  if (session && sessionDestination(session) !== "/two-factor") redirect(sessionDestination(session));
  // With no session, Better Auth's HttpOnly challenge cookie is checked by the
  // verification API. Rendering this form grants no identity or application access.
  return <ChallengeScreen />;
}
