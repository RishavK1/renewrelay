import type { z } from "zod";
import type { createWorkspace } from "../../contracts/api";

export type WorkspaceDraft = z.infer<typeof createWorkspace>;
export type WorkspaceView = WorkspaceDraft & { id: string; version: number; role: "owner" | "admin" | "member" };
export type WorkspaceCreateResult =
  | { status: "success"; workspace: WorkspaceView }
  | { status: "error"; code: string; message: string; fieldErrors?: Record<string, string[]>; retryAfterSeconds?: number; recovery?: "login" | "check-email" | "setup-authenticator" | "two-factor" };
/** Adapter owns same-origin session/headers, idempotency and response envelopes.
 * Keep the key for retries of an unresolved attempt; return only confirmed data.
 */
export type WorkspaceCreateAction = (draft: WorkspaceDraft, signal: AbortSignal) => Promise<WorkspaceCreateResult>;
