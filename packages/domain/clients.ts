import { revokeContactDecisions } from "./decisions/revocation";
import type { PrismaClient } from "../db/generated/client";
import type { Transaction } from "../db/database";
import { type Actor, type Command, allStaff, audit, checkVersion, once, withWorkspace } from "./context";
import { conflict, notFound } from "./errors";
import { type Page, pageResult } from "./pagination";

async function findClient(tx: Transaction, workspaceId: string, id: string) {
  const record = await tx.client.findUnique({ where: { workspaceId_id: { workspaceId, id } } });
  if (!record) notFound();
  return record;
}

async function findContact(tx: Transaction, workspaceId: string, clientId: string, id: string) {
  const record = await tx.contact.findFirst({ where: { workspaceId, clientId, id } });
  if (!record) notFound();
  return record;
}

function checkActive(record: { archivedAt: Date | null }) {
  if (record.archivedAt) conflict("archived", "This record is archived.");
}

function clientView(record: Awaited<ReturnType<typeof findClient>>) {
  const { id, name, version, archivedAt } = record;
  return { id, name, version, archivedAt: archivedAt?.toISOString() ?? null };
}

function contactView(record: Awaited<ReturnType<typeof findContact>>) {
  const { id, clientId, name, email, version, archivedAt } = record;
  return { id, clientId, name, email, version, archivedAt: archivedAt?.toISOString() ?? null };
}

export function listClients(db: PrismaClient, actor: Actor, workspaceId: string, page: Page) {
  const limit = page.limit ?? 25;
  return withWorkspace(db, actor, workspaceId, allStaff, false, async ({ tx }) => {
    const rows = await tx.client.findMany({
      where: { workspaceId, id: page.after ? { gt: page.after } : undefined },
      orderBy: { id: "asc" },
      take: limit + 1,
    });
    return pageResult(rows.map(clientView), limit);
  });
}

export function getClient(db: PrismaClient, actor: Actor, workspaceId: string, id: string) {
  return withWorkspace(db, actor, workspaceId, allStaff, false, async ({ tx }) =>
    clientView(await findClient(tx, workspaceId, id)),
  );
}

export function createClient(db: PrismaClient, cmd: Command, workspaceId: string, input: { name: string }) {
  return withWorkspace(db, cmd.actor, workspaceId, allStaff, true, ({ tx }) =>
    once(tx, cmd, workspaceId, async () => {
      const record = await tx.client.create({ data: { workspaceId, name: input.name } });
      await audit(tx, cmd, workspaceId, "client.created", record.id);
      return clientView(record);
    }),
  );
}

export function updateClient(db: PrismaClient, cmd: Command, workspaceId: string, id: string, input: { name: string; expectedVersion: number }) {
  return withWorkspace(db, cmd.actor, workspaceId, allStaff, true, ({ tx }) =>
    once(tx, cmd, workspaceId, async () => {
      const before = await findClient(tx, workspaceId, id);
      checkVersion(before.version, input.expectedVersion);
      checkActive(before);
      const record = await tx.client.update({
        where: { workspaceId_id: { workspaceId, id } },
        data: { name: input.name, version: { increment: 1 } },
      });
      await audit(tx, cmd, workspaceId, "client.updated", id, {
        changedFields: before.name === record.name ? [] : ["name"],
        fromVersion: before.version,
        toVersion: record.version,
      });
      return clientView(record);
    }),
  );
}

export function archiveClient(db: PrismaClient, cmd: Command, workspaceId: string, id: string, expectedVersion: number) {
  return withWorkspace(db, cmd.actor, workspaceId, allStaff, true, ({ tx }) =>
    once(tx, cmd, workspaceId, async () => {
      const before = await findClient(tx, workspaceId, id);
      checkVersion(before.version, expectedVersion);
      checkActive(before);
      const tracked = await tx.renewalItem.count({ where: { workspaceId, clientId: id, archivedAt: null } });
      if (tracked) conflict("client_has_renewals", "Archive this client's renewal items first.");
      const archivedAt = new Date();
      const record = await tx.client.update({
        where: { workspaceId_id: { workspaceId, id } },
        data: { archivedAt, version: { increment: 1 } },
      });
      const contacts = await tx.contact.updateMany({
        where: { workspaceId, clientId: id, archivedAt: null },
        data: { archivedAt, version: { increment: 1 } },
      });
      await audit(tx, cmd, workspaceId, "client.archived", id, { contactsArchived: contacts.count });
      return clientView(record);
    }),
  );
}

export function listContacts(db: PrismaClient, actor: Actor, workspaceId: string, clientId: string, page: Page) {
  const limit = page.limit ?? 25;
  return withWorkspace(db, actor, workspaceId, allStaff, false, async ({ tx }) => {
    await findClient(tx, workspaceId, clientId);
    const rows = await tx.contact.findMany({
      where: { workspaceId, clientId, id: page.after ? { gt: page.after } : undefined },
      orderBy: { id: "asc" },
      take: limit + 1,
    });
    return pageResult(rows.map(contactView), limit);
  });
}

export function getContact(db: PrismaClient, actor: Actor, workspaceId: string, clientId: string, id: string) {
  return withWorkspace(db, actor, workspaceId, allStaff, false, async ({ tx }) =>
    contactView(await findContact(tx, workspaceId, clientId, id)),
  );
}

export function createContact(db: PrismaClient, cmd: Command, workspaceId: string, clientId: string, input: { name: string; email: string }) {
  return withWorkspace(db, cmd.actor, workspaceId, allStaff, true, ({ tx }) =>
    once(tx, cmd, workspaceId, async () => {
      checkActive(await findClient(tx, workspaceId, clientId));
      const record = await tx.contact.create({ data: { workspaceId, clientId, ...input } });
      await audit(tx, cmd, workspaceId, "contact.created", record.id, { clientId });
      return contactView(record);
    }),
  );
}

export function updateContact(db: PrismaClient, cmd: Command, workspaceId: string, clientId: string, id: string, input: { name: string; email: string; expectedVersion: number }) {
  return withWorkspace(db, cmd.actor, workspaceId, allStaff, true, ({ tx }) =>
    once(tx, cmd, workspaceId, async () => {
      const before = await findContact(tx, workspaceId, clientId, id);
      checkVersion(before.version, input.expectedVersion);
      checkActive(before);
      if (before.email !== input.email) await revokeContactDecisions(tx, cmd, workspaceId, id);
      const record = await tx.contact.update({
        where: { workspaceId_id: { workspaceId, id } },
        data: { name: input.name, email: input.email, version: { increment: 1 } },
      });
      await audit(tx, cmd, workspaceId, "contact.updated", id, {
        clientId,
        changedFields: [
          ...(before.name === record.name ? [] : ["name"]),
          ...(before.email === record.email ? [] : ["email"]),
        ],
        fromVersion: before.version,
        toVersion: record.version,
      });
      return contactView(record);
    }),
  );
}

export function archiveContact(db: PrismaClient, cmd: Command, workspaceId: string, clientId: string, id: string, expectedVersion: number) {
  return withWorkspace(db, cmd.actor, workspaceId, allStaff, true, ({ tx }) =>
    once(tx, cmd, workspaceId, async () => {
      const before = await findContact(tx, workspaceId, clientId, id);
      checkVersion(before.version, expectedVersion);
      checkActive(before);
      await revokeContactDecisions(tx, cmd, workspaceId, id);
      const record = await tx.contact.update({
        where: { workspaceId_id: { workspaceId, id } },
        data: { archivedAt: new Date(), version: { increment: 1 } },
      });
      await audit(tx, cmd, workspaceId, "contact.archived", id, { clientId });
      return contactView(record);
    }),
  );
}
