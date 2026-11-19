import { redirect } from "next/navigation";
import { currentAuthSession, sessionDestination } from "../server/auth-session";
export default async function Page() {
  const session = await currentAuthSession();
  redirect(session ? sessionDestination(session) : "/signup");
}
