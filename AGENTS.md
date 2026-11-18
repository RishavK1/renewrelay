# RenewRelay completion reviews

For material feature completion, security reviews and release milestones, use
the saas-production-audit skill installed at
/Users/rishav/.codex/skills/saas-production-audit/SKILL.md when available.

Use docs/PRODUCTION_CHECKLIST.md and docs/AUDIT_REPORT.md as the project's
control register and current findings. Review controls affected by a focused
change, and revisit the full register for a release milestone. Check completion
only with current evidence. Preserve unresolved findings and audit history.

Trace auth, tenant isolation, lifecycle state, idempotency, mail and billing
side effects through their API entry points. Run appropriate existing checks and
add targeted regressions for confirmed defects. Distinguish synthetic tests from
staging, live-provider and legal verification in the completion report.

Audit scope and application fixes follow the current user request. Production
mutation, real charges, credential rotation and external messaging require
specific authorization. Never print secret values in audit artifacts.
