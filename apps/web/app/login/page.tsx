import { redirect } from "next/navigation";
import { LoginScreen } from "../../components/auth/login-screen";
import { currentAuthSession, sessionDestination } from "../../server/auth-session";
export const metadata = { title: "Log in" };
export default async function Page({ searchParams }: { searchParams: Promise<{ reauth?: string }> }) {
  const session = await currentAuthSession();
  if (session && (await searchParams).reauth !== "1") redirect(sessionDestination(session));
  return <LoginScreen />;
}
