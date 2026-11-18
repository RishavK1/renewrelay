# RenewRelay shared design system

Status: design foundation not selected. This document establishes the maintained
source of truth; it does not claim that typography, palette or UI components have
already been designed or approved. Research is in FRONTEND_UI_QUALITY_CHECKLIST.md.

## Established product constraints

- Agency website: getvout.com. Public product content: renewrelay.getvout.com.
  Login and product: app.renewrelay.getvout.com. Private decision links use the
  application origin. Deployment/DNS has not been configured by this decision.
- Public marketing and authenticated operational screens are different surfaces
  with shared brand identity; their layout and information density may differ.
- Preserve the distinctions between decision, execution, invoicing and SaaS payment.
- No arbitrary emoji decoration, fabricated social proof or misleading business states.
- Authentication is Better Auth; PostgreSQL is the data store; Resend and Razorpay
  are selected integrations with live acceptance still pending.

## Decisions to establish in the first design task

Select named tokens for brand/neutral/semantic colors, typography roles, spacing,
responsive containers/grid, border/radius/elevation, icon family, focus and motion.
Record actual values and decisions here when selected. Initial constraints from
the research checklist are proposed conventions, not an approved visual theme.
Existing chosen tokens then carry forward; a new screen is not a new brand brief.

## Component inventory

No frontend component library has been implemented or adopted yet. As shared
primitives are added, record their actual source paths, supported variants and
interaction/state rules here. Do not record planned components as implemented.

## Consistency and review

Use .agents/skills/renewrelay-ui/SKILL.md for every UI task. Read the pinned
frontend-design reference through that skill. Review against UI-01–UI-20 and
record rendered evidence in UI_REVIEW_LOG.md. Document deliberate token/component
exceptions and affected screens rather than quietly introducing one-off values.

## Reference preparation — 18 November 2026

The [frontend preparation plan](FRONTEND_PREPARATION_PLAN.md) and
[reference analysis](design/REFERENCE_ANALYSIS.md) document the user-supplied
Calendly, Mobbin, Quantalog, Aceternity and Instagram material.

Four [rendered palette studies](design/palettes/renewrelay-four-palettes.png)
are available; [proposed tokens and contrast pairs](design/palettes/palettes.json)
are machine-readable. Ink & Sky is recommended; selection remains pending.
The studies do not establish a final typography choice or completed screen UI.
Proposed spacing, shape, control and motion roles are in the preparation plan;
record selected values here before adopting them across screens.

shadcn, Aceternity, 21st, Motion and Lucide have proposed roles, not implemented
component inventory entries. Tool setup status is recorded in the preparation
plan. Do not infer that 21st authentication or frontend installation is complete.
