# RenewRelay shared design system

Status: Ink & Sky palette selected by the user on 18 November 2026. Navbar/hero
design specified for review; frontend implementation pending. This document establishes the maintained
source of truth; palette approval is recorded below. Typography and UI component
recommendations have not been implemented or visually verified. Research is in FRONTEND_UI_QUALITY_CHECKLIST.md.

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
are machine-readable. Ink & Sky is selected. The other three studies are retained as historical
alternatives, not active theme choices.
The studies do not establish a final typography choice or completed screen UI.
Proposed spacing, shape, control and motion roles are in the preparation plan;
record selected values here before adopting them across screens.

shadcn, Aceternity, 21st, Motion and Lucide have proposed roles, not implemented
component inventory entries. Tool setup status is recorded in the preparation
plan. Do not infer that 21st authentication or frontend installation is complete.

## Selected palette and current design scope

User-approved palette: Snow #FCFBF8, Ink #071A31, Sky #C3DFFE, with white
surfaces, muted #526171 and border #D8DFE5. Preserve these roles across pages.
See [navbar and hero design](design/NAVBAR_HERO_DESIGN.md) for the current
recommendation: centered typography, locally served Manrope, bundled Lucide,
and isometric Aceternity cubes. Those details are proposed for review; only the
palette has explicit user selection. Do not implement other sections from this
design task. Browser font requests must stay on our origin; no Google Fonts API
or CDN font loading. Retain font/icon licenses when actual assets are imported.

## Navbar and hero implementation — local review

The user approved implementation of the specified navbar and hero. They are now
implemented in apps/marketing as a separate public Next.js app; backend startup
checks and API security headers remain in apps/web. Do not add more sections
without the user's next instruction.

| Component/token source | Actual location | Notes |
|---|---|---|
| Tokens and responsive styles | apps/marketing/app/globals.css | Ink & Sky; 960px navigation collapse for intermediate widths |
| Local Manrope | apps/marketing/app/layout.tsx; public/fonts | Variable Latin WOFF2 and OFL notice; no font CDN |
| Preview action variants | apps/marketing/components/ui/preview-action.tsx | Primary/secondary/quiet, compact/header variants |
| Header | apps/marketing/components/marketing/site-header.tsx | Keyboard/Escape mobile menu; unavailable destinations inactive |
| Hero | apps/marketing/components/marketing/renewal-hero.tsx | Approved copy, Lucide glyphs and trial terms |
| Cubes source | apps/marketing/components/ui/background-cubes-grid.tsx | Supplied Aceternity source; provenance in design/FRONTEND_SOURCES.md |
| Decorative lifecycle | apps/marketing/components/marketing/hero-background.tsx | Lazy desktop rendering; static mobile/reduced-motion/error fallback |

The route is a design preview. Signup/login, pricing and subsequent sections
have not been built; their controls are explicitly inactive rather than linking
to missing pages. Product links to the existing opening section. Tests, type/build
checks and browser review were not run, as explicitly requested by the user.
Responsive behavior is implemented, not visually verified. Keep UI review checks
NOT REVIEWED pending the user's local inspection.

## Navbar/hero refinement from user review — 18 November 2026

User feedback requested stronger cubes, consistent Mobbin-inspired navigation,
inline changing glyphs, more precise heading size and pointer feedback on buttons.
Current implementation supersedes the first draft's three trailing glyphs:

- Headline glyphs sit after “Track”, “Get clear” and “Keep work”, cycling related
  Lucide symbols in fixed-size slots on desktop. Text does not change. Mobile and
  reduced-motion use static glyphs. A desktop pause control stops glyphs/cubes.
- Heading is 76px maximum, 680 weight, with less compressed tracking; mobile uses
  37px and 33px on the narrowest breakpoint.
- Header is 1088px maximum, 96px high on desktop, with uniform navigation text
  and a separated quiet login action. The repeated desktop trial button is removed;
  hero and expanded mobile navigation retain the trial action.
- Controls use pill corners, pointer cursors and hover color feedback, including
  inactive preview controls. Their planned destinations are still not connected;
  native disabled semantics remain rather than pretending the flows exist.
- Cubes use stronger blue side shading, 0.5 amplitude, 0.42 glow and a less opaque
  edge mask. The center remains protected for readable text.

These changes implement feedback from the user's screenshots. No browser,
responsive, animation or automated checks were run; user review remains pending.

## Next two sections — planning only

See [sections 2–3 plan](design/SECTIONS_02_03_PLAN.md): a tabbed illustrative product
preview followed by a three-stage renewal workflow. Aceternity Tabs and Timeline
are selected source foundations, not installed components. Palette/font/control
roles inherit the current site. This replaces the earlier problem-only section 3
proposal. No runtime changes or screen verification are part of this planning task.

## Sections 2 and 3 — local implementation

User authorized building the planned product preview and workflow. Both are now
implemented immediately after the hero, with the existing palette, Manrope,
Lucide, pill controls and shared container. New source locations:

| Component | Location | Behavior |
|---|---|---|
| Product evidence | apps/marketing/components/marketing/product-preview.tsx | Three local sample-data panels and anchor to workflow |
| Adapted Aceternity Tabs | apps/marketing/components/ui/tabs.tsx | Scoped active-pill motion, manual keyboard tabs, hidden/inert inactive panels and height-stable grid |
| Sample data and illustrations | apps/marketing/components/marketing/renewal-example.ts; renewal-illustrations.tsx | Shared synthetic hosting example; no API calls or real decisions |
| Workflow | apps/marketing/components/marketing/renewal-workflow.tsx | Three distinct preparation/decision/provider-outcome milestones |
| Adapted Aceternity Timeline | apps/marketing/components/ui/timeline.tsx | Reading-progress rail, resize measurement, semantic ordered steps, static mobile/reduced-motion rail |

Product navigation now targets the product-preview section; How it works links
to the new workflow. Hero uses its own unique id. Login, pricing and signup remain
inactive previews. All new responsive styles are in the existing globals.css.
No extra library, font, imagery, tracking, API integration or WebGL was added.
No tests/browser checks were run at the user's request; implementation does not
constitute verified accessibility, performance or complete frontend signoff.

## Sections 4–5 — research and planning

The [sections 4–5 plan](design/SECTIONS_04_05_PLAN.md) proposes an Ink-background
problem/context comparison followed by an asymmetric agency-control section.
Aceternity Compare and Bento Grid are proposed foundations, not installed
components. The palette, Manrope, Lucide and existing control styles remain.
This planning update does not authorize implementation, public claims of competitor
superiority, pricing, new integrations or changes to the existing app.

## Sections 4 and 5 — local implementation

The user authorized implementation of the comparison and agency-control plan.
The Ink comparison band is followed by Snow agency-control cards, preserving
local Manrope, Lucide, existing container roles and trial controls.

| Component | Location | Behavior |
|---|---|---|
| Context comparison | apps/marketing/components/marketing/context-comparison.tsx | Original DOM illustrations, three persistent problem/solution explanations and agency-control anchor |
| Adapted Aceternity Compare | apps/marketing/components/ui/compare.tsx | Layer reveal; native keyboard/range input; two full-view controls; static stacked mobile scenes |
| Agency controls | apps/marketing/components/marketing/agency-control.tsx | Synthetic owner/action, delivery, invoicing and revision scenarios |
| Adapted Aceternity Bento Grid | apps/marketing/components/ui/bento-grid.tsx | Asymmetric desktop grouping with tablet/mobile reflow; no decorative card hover movement |

The planned illustration assets are rendered as original responsive DOM content
instead of image/SVG exports, retaining crisp local type and avoiding media/font
requests. Source foundation/adaptations are documented in FRONTEND_SOURCES.md.
The optional history connector entrance was omitted; static revision content
keeps the user-controlled comparison as the only new moving feature.
No automated checks or browser review were run, respecting the user's testing
instruction. No push occurred. Sample scenes do not change actual business state.

## Sticky navigation and next pricing section

The user requested sticky navigation with a scrolling trial action. site-header.tsx
now observes the hero CTA: the desktop trial action appears only after it passes
above the header, and reverses on return. The header stays in normal flow with
position: sticky/top: 0; dimensions remain stable. Anchor offsets accommodate it.
Mobile retains its menu trial action without crowding the top row. Reduced motion
removes the entrance transition. Trial controls remain inactive previews.

The next recommended section is pricing; see
[section 6 plan](design/SECTION_06_PRICING_PLAN.md). Pricing is not implemented.
One Team plan plus a trial summary is proposed. ₹1,499/month remains an unapproved
pilot proposal; amount/tax/provider verification must precede public pricing.

## Pricing and sticky navbar refinement — local implementation

The user agreed to the plan and authorized implementation. The marketing price
is ₹1,499 per workspace/month. Tax treatment and actual Razorpay plan verification
remain unresolved and are release gates; no provider resource was created.

- Pricing: apps/marketing/components/marketing/pricing-section.tsx, with public
  offer/feature content in pricing-content.ts. One paid Team card plus a quieter
  trial summary. Shared Manrope, Ink & Sky, pill controls and Lucide are reused.
- Navbar Pricing and hero See plans now anchor to #pricing. Signup/login remain
  inactive native preview buttons. Anchors preserve sticky-header clearance.
- Sticky header now has a fine divider as soon as scrolling starts; the trial
  button still reveals only after the hero CTA passes above it. On 480–959px
  screens that button replaces login after scrolling; the narrowest top rows
  retain login/menu with the trial action inside the menu.
- Pricing references were reviewed: Calendly/Mobbin billing-unit and feature
  hierarchy, and Aceternity's pricing-section catalog/Minimal preview. Aceternity
  pricing blocks require All-Access. No paid source was copied or purchased.
  This section is original local composition using existing primitives.
- No extra font, package, tracking SDK or external assets were added. No tests,
  type/build checks, HTTP probes or browser review were run under the user's
  standing local-testing instruction. No push or deployment occurred.

## Compact sticky header — user refinement

The hero retains its 96px desktop / 72px mobile navbar. After scrolling past
64px, the bar compresses to 64px desktop / 56px mobile with a 220ms height
transition. Returning within 8px of the top restores the roomy state; separate
thresholds avoid toggling around a single threshold during height changes.
Touch controls retain their 44px target. Anchor and workflow sticky offsets
match the compact bar. Reduced-motion uses an immediate size change. Existing
hero-relative CTA reveal and login hover styling remain. No tests/browser checks
or push performed under the standing user instructions.

## FAQ section — local implementation

Added “Before your first renewal” after pricing. faq-section.tsx uses a two-column
editorial layout, a Sky clarity panel and independent accordion items; first
answer open by default. faq-content.ts keeps the five source-grounded answers
separate from UI. Native buttons expose expanded/control relationships; closed
regions are aria-hidden/inert. CSS grid animates height over 220ms and reduced
motion removes transitions. Mobile stacks introduction and questions. Existing
Manrope, Lucide, Ink & Sky and container spacing are reused; no new dependency.
No testing/browser review, commit or push performed. Final CTA/footer are not
implemented in this change.

## Closing CTA and footer — local implementation

Added closing-cta.tsx after FAQ and site-footer.tsx after main. The user authorized
the closing CTA and specifically requested the supplied Mobbin footer composition
and oversized name. The new Mobbin MD was read in full; the supplied screenshot
informs the dark footer, wide brand/three-column layout and large lower wordmark.
Ink & Sky, local Manrope and Lucide remain the shared identity.

Closing CTA: spacious Ink panel, Snow headline, Sky primary variant, trial terms
and three labeled stages. A decorative connector reveals once in 500ms using
existing Motion; labels are immediately visible and reduced motion is static.
The trial action remains the shared inactive preview until signup exists.

Footer: readable small RenewRelay brand, Product/Explore/Company groups, working
in-page anchors and the existing getvout.com link. Oversized lower SVG text uses
our local font and is decorative/aria-hidden; the readable footer brand remains
available to assistive technology. The faint decorative wordmark is not essential
content. Mobile stacks CTA stages and uses two link columns with brand above.

No unconfirmed contact, social, privacy or terms destinations were invented.
Legal documents/contact links remain a release gate. No packages/assets from
Mobbin were copied; original local composition uses its layout as reference.
No tests/browser checks, commit, push or deployment performed.

## Closing CTA simplification — user refinement

Removed the Dates/Decisions/Follow-through icon row and connector animation at the
user's request. ClosingCta is now a server component with no icon/Motion imports.
The panel finishes with the trial note and balanced vertical padding; existing
headline, Sky CTA, background and footer are preserved. Removed obsolete row CSS.

## Authentication — UI planning only

See [authentication UI plan](design/AUTHENTICATION_UI_PLAN.md) for the backend-
grounded screen inventory, Ink & Sky split shell, input/state rules, research
sources and future app-origin handoff. Presentation and synthetic local previews
are planned separately from backend integration. No auth UI component is yet
implemented; no provider calls, tests, browser checks or push were performed.


## Authentication UI — local implementation, 18 November 2026

Implemented the UI-only plan in design/AUTHENTICATION_UI_PLAN.md. Shared
presentation lives in packages/ui/auth: contracts.ts (typed operation/result
boundary), auth-shell.tsx, auth-fields.tsx, auth-forms.tsx and scoped auth.css.
The development-only host is apps/marketing/components/auth/auth-preview.tsx;
explicit preview routes live in apps/marketing/app/(auth-preview). A production
layout guard returns notFound; development homepage login/trial actions link to
/login and /signup. Production actions remain inactive pending app-origin wiring.

Login/signup, verification result/resend, forgot/reset password, authenticator
challenge/recovery, enrollment, manual key/QR, recovery-code save/copy/download,
and a clearly identified workspace-handoff preview are implemented. No workspace
is created. Fields use semantic labels, password visibility, password-manager
hints, full-code paste, error descriptions, pending guards and first-error focus.
An injected action boundary keeps UI free of server imports, cookies and tokens.
Recovery-code and QR material are explicitly synthetic. The future app-origin
adapter must supply actual enrollment material and render its QR locally.

Ink & Sky/local Manrope/Lucide are retained. Form 420px; desktop split 56/44;
mobile single column under 1024px, 20px narrow-screen gutters, 50px inputs,
52px primary pill, 12px input radius, restrained opacity/interaction motion.
Root homepage composition is unchanged. Static local QR generated with node-qrcode
1.5.4 CLI (temporary npm exec; no project runtime dependency added).

Source reviewed against auth runtime/allowlist and installed Better Auth defaults:
12–128 signup/reset password, required verification, TOTP challenge, one-use backup
codes, 10-minute recent-auth window and workspace-creation MFA/trial boundary.
No backend integration or claims of completed authentication. No tests, type/lint/
build checks, browser review or HTTP probes under the user's standing instruction.
No commit/push/deployment. Visual/keyboard/mobile states remain NOT REVIEWED.


## Authentication refinement — input focus and complete brand panel

User screenshot identified separated input border/outline and an oversized,
clipped desktop aside. packages/ui/auth/auth.css now uses a single continuous
Ink focus edge (inset stroke, no offset outline); forced-colors retains a system
focus outline. Inputs/labels, error semantics and keyboard focus remain present.
The desktop aside is sticky, sized to 100svh minus its outer gutters, and no
longer stretches to the form column. Typography/gaps respond to viewport height;
short landscape windows simplify decoration. The wordmark is now in normal flow
with space below rather than absolutely cropped beyond the panel edge. Mobile
retains its single-column naturally scrolling form.

Updated auth-shell.tsx cards replace the slogan and skeleton lines with a clearly
synthetic Northline Studio hosting record, expiry, approved client response and
next provider action. Approval is not represented as completed provider renewal.
Gentler rotations and readable card hierarchy retain the Ink & Sky identity.
Local source changes only; no backend changes, tests, build/type checks, browser
review, push or deployment. Responsive/visual behavior awaits user local review.


## Login-only polish

Login password toggle now includes visible Show/Hide text and aria-controls;
other screens keep their icon-only toggle. Login uses username/current-password
autocomplete, a separate right-aligned 44px recovery link beneath the password,
and scoped heading/form/mobile spacing. Shared colors, focus edge and sidebar
are retained; signup and other flows keep their existing spacing. No backend
wiring, tests, browser checks, commit or push.


## Authentication refinement pass — all existing screens

Completed a single shared UI refinement pass across login/signup, verification,
forgot/reset password, authenticator/recovery and enrollment. All password fields
now share labeled Show/Hide controls with adequate input padding. Heading/form
spacing and narrow-phone rules are shared instead of login-specific duplicates.
New screen/step headings receive programmatic focus without scrolling; visible
input focus remains a single continuous edge.

Email-link request confirmations now show the submitted address with safe wrapping,
neutral account-existence copy, an explicit preview notice and a request-another
path retaining that address only in component memory. MFA method changes and
field edits clear stale errors while retaining rate-limit cooldowns. Authenticator
setup shows four real stages, clears stale copy feedback between stages, and
recovery-code download has truthful requested/failure feedback and text fallback.
Failed verification preview scenarios now render failure rather than success.
No real identity/session/token/mail behavior is simulated as an actual operation.
Backend wiring, live delivery and integrated acceptance remain separate work.
No tests/type/build/browser checks, commit, push or deployment performed.
