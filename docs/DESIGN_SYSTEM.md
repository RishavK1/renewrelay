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
