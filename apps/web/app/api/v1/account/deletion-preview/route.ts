import { read } from "@server/http";
import { runtime } from "@server/runtime";
import { setActor } from "@renewrelay/db/database";
export function GET(request: Request) {
  return read(request, async actor => {
    const retainedMemberships = await runtime().db.$transaction(async tx => {
      await setActor(tx, actor.id);
      return tx.membership.count({ where: { userId: actor.id } });
    });
    return { eligible: retainedMemberships === 0, retainedMemberships,
      requirement: "Leave active workspaces and resolve retained memberships under the approved workspace retention policy before deleting a shared identity.",
      scope: "Database identity, sessions, accounts, MFA credentials and identity verification records. Provider records and backups follow separately approved retention." };
  });
}
