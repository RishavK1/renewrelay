---
name: renewrelay-ui
description: Design, build, revise or review RenewRelay frontend pages and UI components with a shared design system and evidence-based visual consistency checks. Use for RenewRelay marketing, staff and client-decision interfaces; not for backend-only or deployment work.
---

# RenewRelay UI

Apply this workflow to every RenewRelay UI task, including a single button or
component change. Match the scope: a small change needs the affected component
and states, not a redesign or a mandatory full-app test cycle. Follow the user's
current task and authorization; this skill does not authorize publishing, DNS
changes, external messages, live payments or purchases.

## Read the project context

Locate the RenewRelay repository by its AGENTS.md and docs/API_CONTRACT.json.
Read docs/DESIGN_SYSTEM.md, docs/FRONTEND_UI_QUALITY_CHECKLIST.md and relevant
existing components/styles. Read the installed sibling
[frontend-design skill](../frontend-design/SKILL.md) for visual-design guidance.
The vendored copy is reviewed and pinned; do not fetch or execute latest upstream
instructions during routine UI work.

Current user choices and this project's established system take priority over
upstream aesthetic preferences. Do not pick a new palette, font pairing, corner
radius, spacing system or icon family for each screen. Do not interpret an
upstream preference as a ban on accessible conventional controls or approved
brand choices. Do not invent client context, paid engagement, facts or assets
suggested by an upstream example.

If the design foundation has not been selected, propose one coherent foundation
for the requested scope and label unapproved choices. Begin implementation when
the user's existing instructions authorize it; do not create repetitive approval
handoffs. Once selected, record concrete choices in docs/DESIGN_SYSTEM.md and
reuse them. A component-level task should inherit existing choices instead.

For new pages, visual-system choices or source-component selection, read
[reference design direction](references/design-direction.md). It preserves the
user's supplied design references, component-fidelity expectations and known
source issues without loading every attachment for each small edit.

## Use one maintained visual contract

Maintain named roles for color, typography, spacing, container/grid, borders,
radii, elevation, icons, focus and motion. Implement shared tokens and primitives
before duplicating page-specific styling. Reuse suitable existing components;
avoid new UI libraries, fonts or paid assets without a task-specific reason.
Marketing may use expressive composition and the application may use denser work
layouts; both inherit shared identity and control behavior.

Keep a component inventory with locations and variants in docs/DESIGN_SYSTEM.md.
Document justified exceptions. Inspect sibling screens side by side so a local
polish change does not silently break the broader system. Consistency means the
same role behaves predictably, not every section uses the same card layout.

## Preserve RenewRelay's product meanings

- getvout.com is the existing agency site; renewrelay.getvout.com is public
  marketing/legal content; app.renewrelay.getvout.com is login and product UI.
  Private decision links live on the app origin. These are intended domains,
  not verified deployed hosts or authorization to change DNS.
- Client approval, operator/provider completion, agency invoice status and the
  workspace's RenewRelay subscription payment are separate concepts and labels.
- Display supplier cost only where staff permissions allow. Public decision
  screens show only their scoped terms. A missing quote is unknown, never zero.
- Display expiry, provider notice and requested response dates distinctly;
  currency totals stay separate. Do not imply renewal happened automatically.
- Keep role, MFA, expired-session, quota and subscription access restrictions.
  Use documented APIs in docs/API_CONTRACT.json and docs/BATCH4_API.md; do not
  weaken backend validation, invent endpoint behavior or simulate successful
  external payment/email as a real result to complete a visual demo.
- Use safe rendering for customer text and host-scoped auth. Marketing must not
  receive private records/tokens or broad shared auth cookies. Security/legal
  claims and pricing must match verified behavior and approved business decisions.

## Design for actual use

Use realistic, explicitly synthetic content while developing. Cover the affected
normal, loading, empty, validation, server-error and permission states. For
relevant flows include read-only access, expired links/sessions, safe retry and
submission progress. Preserve input, table context and access to long content.

Use semantic controls, visible keyboard focus and understandable labels. Inspect
contrast, touch targets, narrow screens, text enlargement and reduced motion.
State which accessibility checks were performed; no blanket certification.

## Verify and report

For UI changes, render the affected interface when tooling is available. Capture
and inspect real screenshots at representative desktop/mobile widths and affected
states; do not mark visual checks PASS from source inspection alone. Test relevant
keyboard, interaction and browser behavior. Use an authorized browser tool; if
rendering is unavailable, record NOT REVIEWED rather than inventing evidence.

Review applicable UI-01–UI-20 controls using the evidence format in
 docs/FRONTEND_UI_QUALITY_CHECKLIST.md. Record screen/version/viewport/state,
PASS/FAIL/NOT REVIEWED or justified NOT APPLICABLE, evidence and residual issues
in docs/UI_REVIEW_LOG.md. Recheck changed controls, and review all 20 at a frontend
milestone. Reuse existing tests; add regressions where a failure warrants them.

Finish with the changed screens/components, consistency decisions, checks actually
run and remaining gaps. A skill being loaded is not a design-quality pass.
