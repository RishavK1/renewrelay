import { setTimeout as wait } from "node:timers/promises";
import type { PrismaClient } from "../../packages/db/generated/client";
import type { InviteCredentials } from "../../packages/domain/invite-credentials";
import type { Mailer } from "../../packages/integrations/smtp";
import type { TransactionalMailer } from "../../packages/integrations/transactional-mail";
import { clearStaleMail, processMail } from "./mail-jobs";
import { clearStaleDecisionMail, processDecisionMail } from "./decision-mail";
import { clearStaleInternalMail, processInternalMail } from "./internal-mail";

// One limiter is shared by all mail lanes for the lifetime of a worker process.
export function createSendLimiter(perSecond: number) {
  if (!Number.isFinite(perSecond) || perSecond <= 0) throw new RangeError("Use a positive mail send rate.");
  let next = 0;
  let tail = Promise.resolve();
  return async function limited<T>(send: () => Promise<T>): Promise<T> {
    const slot = tail.then(async () => {
      while (Date.now() < next) await wait(next - Date.now());
      next = Date.now() + 1000 / perSecond;
    });
    tail = slot.catch(() => undefined);
    await slot;
    return send();
  };
}

async function dueWorkspaces(db: PrismaClient, after?: string) {
  return db.$queryRaw<{ id: string }[]>`
    SELECT id FROM (SELECT DISTINCT "workspaceId" AS id FROM (
      SELECT "workspaceId" FROM mail_jobs WHERE status = 'pending' AND "runAt" <= now() AND "expiresAt" > now()
      UNION ALL
      SELECT "workspaceId" FROM decision_deliveries WHERE status = 'pending' AND "runAt" <= now()
      UNION ALL
      SELECT "workspaceId" FROM internal_notifications WHERE status = 'pending' AND "runAt" <= now()
    ) due) tenants
    ORDER BY id > COALESCE(${after ?? null}::uuid, '00000000-0000-0000-0000-000000000000'::uuid) DESC, id
    LIMIT 100
  `;
}

export interface DispatchOptions {
  credentials: InviteCredentials;
  origin: string;
  deduplicated: boolean;
  sendInvitation: Mailer;
  sendTransactional: TransactionalMailer;
  maxJobs?: number;
  concurrency?: number;
  budgetMs?: number;
  after?: string;
  signal?: AbortSignal;
  onError?: (lane: string, error: unknown) => void;
}

export async function dispatchMailBatch(db: PrismaClient, options: DispatchOptions) {
  const { maxJobs = 200, concurrency = 4, budgetMs = 5000 } = options;
  if (!Number.isInteger(maxJobs) || maxJobs < 3 || maxJobs > 2000 ||
      !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16 || !Number.isFinite(budgetMs) || budgetMs < 1) {
    throw new RangeError("Invalid dispatch limits.");
  }
  await clearStaleMail(db);
  await clearStaleDecisionMail(db, options.deduplicated);
  await clearStaleInternalMail(db, new Date(), options.deduplicated);
  const workspaces = await dueWorkspaces(db, options.after);
  const lanes = [
    { name: "invitation", run: (id: string) => processMail(db, options.sendInvitation, options.credentials, id) },
    { name: "decision", run: (id: string) => processDecisionMail(db, options.sendTransactional, options.credentials,
      options.origin, options.deduplicated, new Date(), id, false) },
    { name: "internal", run: (id: string) => processInternalMail(db, options.sendTransactional, { workspaceId: id, maintenance: false, credentials: options.credentials, deduplicated: options.deduplicated }) },
  ];
  // One ticket per tenant/lane per round prevents a large tenant or lane monopolizing a batch.
  const tickets = workspaces.flatMap(({ id }) => lanes.map(lane => ({ id, lane })));
  const exhausted = new Set<number>();
  const active = new Set<number>();
  const deadline = performance.now() + budgetMs;
  let next = 0;
  let claimed = 0;
  let processed = 0;
  let after = options.after;
  async function run() {
    while (!options.signal?.aborted && claimed < maxJobs && performance.now() < deadline) {
      let index = -1;
      for (let checked = 0; checked < tickets.length; checked++) {
        const candidate = next++ % tickets.length;
        if (!exhausted.has(candidate) && !active.has(candidate)) { index = candidate; break; }
      }
      if (index < 0) return;
      const ticket = tickets[index]!;
      active.add(index);
      claimed++;
      after = ticket.id;
      try {
        if (await ticket.lane.run(ticket.id)) processed++;
        else exhausted.add(index);
      } catch (error) {
        exhausted.add(index);
        options.onError?.(ticket.lane.name, error);
      } finally {
        active.delete(index);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run));
  return { processed, after, pending: (await dueWorkspaces(db)).length > 0 };
}
