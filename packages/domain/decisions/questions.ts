import type { PrismaClient } from "../../db/generated/client";
import type { Transaction } from "../../db/database";
import { allStaff, audit, checkVersion, once, withWorkspace, type Command } from "../context";
import { conflict, notFound } from "../errors";
import { findCycle } from "../renewals/records";

export async function requireResolvedQuestions(tx: Transaction, workspaceId: string, cycleId: string) {
  const [result] = await tx.$queryRaw<{ unresolved: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM decision_responses response
      JOIN decision_requests request ON request.id = response."requestId" AND request."workspaceId" = response."workspaceId"
      WHERE response."workspaceId" = ${workspaceId}::uuid AND request."cycleId" = ${cycleId}::uuid
        AND response.choice = 'question'
        AND NOT EXISTS (
          SELECT 1 FROM audit_events event
          WHERE event."workspaceId" = ${workspaceId}::uuid AND event."entityId" = ${cycleId}
            AND event.event = 'decision.question_resolved' AND event.details->>'responseId' = response.id::text
        )
    ) AS unresolved
  `;
  if (result?.unresolved) conflict("unresolved_questions", "Record a resolution for client questions before issuing revised terms.");
}

export function resolveQuestion(db: PrismaClient, cmd: Command, workspaceId: string, cycleId: string,
  responseId: string, input: { expectedVersion: number; note: string }) {
  return withWorkspace(db, cmd.actor, workspaceId, allStaff, true, ({ tx }) => once(tx, cmd, workspaceId, async () => {
    const { cycle } = await findCycle(tx, workspaceId, cycleId);
    const response = await tx.decisionResponse.findFirst({
      where: { workspaceId, id: responseId, choice: "question", request: { cycleId } },
    });
    if (!response) notFound();
    checkVersion(cycle.version, input.expectedVersion);
    const previous = await tx.auditEvent.findFirst({ where: {
      workspaceId, entityId: cycleId, event: "decision.question_resolved",
      details: { path: ["responseId"], equals: responseId },
    } });
    if (previous) conflict("question_resolved", "This question already has a recorded resolution.");
    const updated = await tx.renewalCycle.update({
      where: { workspaceId_id: { workspaceId, id: cycleId } }, data: { version: { increment: 1 } },
    });
    await audit(tx, cmd, workspaceId, "decision.question_resolved", cycleId, {
      responseId, requestId: response.requestId, note: input.note,
    });
    return { responseId, resolved: true, version: updated.version };
  }));
}
