import type { WorkspaceView } from "../workspace/contracts";

export type DashboardWorkspace = Pick<WorkspaceView, "id" | "name" | "timezone" | "role">;

/** State is resolved by the future app-origin adapter, not inferred from a
 * filtered queue, first page totals, trial dates or client-side role guesses.
 */
export type DashboardState =
  | { kind: "loading" }
  | { kind: "new-workspace"; canCreateClient: boolean }
  | { kind: "existing-clients" }
  | { kind: "read-only" }
  | { kind: "unavailable" }
  | { kind: "deleting" }
  | { kind: "error" }
  | { kind: "auth-required"; reason: "session" | "email" | "mfa"; recoveryHref: "/login" | "/check-email" | "/two-factor" | "/setup-authenticator" };
