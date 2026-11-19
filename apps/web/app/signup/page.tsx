import { SignupScreen } from "../../components/auth/signup-screen";
import { redirect } from "next/navigation";
import { currentAuthSession, sessionDestination } from "../../server/auth-session";
export const metadata = { title: "Create account" };
export default async function Page() {
  const session = await currentAuthSession();
  if (session) redirect(sessionDestination(session));
  return <SignupScreen />;
}
