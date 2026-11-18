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

# Frontend visual quality

For frontend planning, implementation and material UI changes, use
`docs/FRONTEND_UI_QUALITY_CHECKLIST.md` (UI-01–UI-20). Preserve a coherent shared
design system; review actual screens, viewports and interaction states before
marking a check PASS. Record evidence and unresolved issues. The research checklist
alone does not certify a screen, accessibility compliance or frontend completion.

For every RenewRelay frontend design, implementation or material UI review, read
`.agents/skills/renewrelay-ui/SKILL.md` and its pinned sibling
`.agents/skills/frontend-design/SKILL.md`. This includes single-page and component
work. Use `docs/DESIGN_SYSTEM.md` as the shared visual contract and record real
screen evidence in `docs/UI_REVIEW_LOG.md`. Apply the user's current choices over
upstream aesthetic defaults; do not independently redesign each screen. These
skills guide the work and do not run as background processes or certify quality.

# GitHub pushes

Do not push to GitHub without the user's explicit permission for that push.
Previous pushes or earlier broad authorization are not standing permission.
