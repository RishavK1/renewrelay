import { databaseQuery } from "../operations/telemetry";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "./generated/client";

export type Transaction = Prisma.TransactionClient;

export function openDatabase(connectionString: string, max = 8) {
  const adapter = new PrismaPg({ connectionString, max, connectionTimeoutMillis: 5000 });
  const client = new PrismaClient({ adapter, log: [{ emit: "event", level: "query" }], transactionOptions: { maxWait: 5000, timeout: 7000 } });
  client.$on("query", event => databaseQuery(event.duration));
  return client;
}

export async function setActor(tx: Transaction, actorId: string) {
  await tx.$queryRaw`SELECT set_config('renewrelay.actor_id', ${actorId}, true)`;
}

export async function setWorkspace(tx: Transaction, workspaceId: string) {
  await tx.$queryRaw`SELECT set_config('renewrelay.workspace_id', ${workspaceId}, true)`;
}

export async function setInviteDigest(tx: Transaction, digest: string) {
  await tx.$queryRaw`SELECT set_config('renewrelay.invite_digest', ${digest}, true)`;
}

export async function lockWorkspace(tx: Transaction, workspaceId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM workspaces WHERE id = ${workspaceId}::uuid FOR UPDATE
  `;
  return rows.length === 1;
}

export async function lockCommand(tx: Transaction, tuple: string[]) {
  // Transaction-level locks release automatically on rollback or commit.
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(tuple)}, 0))::text
  `;
}
