/** A missing receipt must keep the original command available for reconciliation. */
export function isUnconfirmedResult(code: string) {
  return code === "temporarily_unavailable" || code === "connection_error";
}

/** Session/CSRF failures need a fresh link exchange, not another OTP attempt. */
export function requiresDecisionReopen(code: string) {
  return ["decision_unavailable", "already_decided", "stale_version", "idempotency_conflict",
    "decision_session_required", "decision_session_expired", "invalid_csrf"].includes(code);
}
