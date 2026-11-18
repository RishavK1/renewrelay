# RenewRelay UI review log

No frontend screens have been rendered or reviewed yet. Installing skills and
creating a design contract does not pass any UI or accessibility check.

For each material UI change, add a scoped record using this structure. Link actual
artifacts or measurements, not an unexecuted test plan.

| Screen/route/component | Commit/design version | Viewport + state | UI IDs reviewed | Result | Evidence | Remaining issue/owner |
|---|---|---|---|---|---|---|
| No screens reviewed yet | Skill setup only | Not applicable | None | NOT REVIEWED | docs/FRONTEND_UI_QUALITY_CHECKLIST.md | Frontend design and implementation pending |

Allowed results: PASS, FAIL, NOT REVIEWED, or NOT APPLICABLE with a reason. Review
affected controls on small changes and all 20 at frontend milestones. Keep prior
records rather than retroactively declaring old versions verified.

## 18 November 2026 — navbar and hero implementation

| Screen/route/component | Commit/design version | Viewport + state | UI IDs reviewed | Result | Evidence | Remaining issue/owner |
|---|---|---|---|---|---|---|
| Marketing `/`, navbar and hero | Local uncommitted implementation | No browser viewports inspected | UI-01–UI-20 pending | NOT REVIEWED | apps/marketing; docs/design/FRONTEND_SOURCES.md | User explicitly requested no tests/browser checks; user will inspect locally |

Local development server started on 127.0.0.1:3001. This startup message is not
page render or functionality evidence. No automated tests, lint, typecheck,
production build, HTTP checks or browser inspection were run. Other sections,
signup/login and pricing are outside scope; their controls remain inactive.
No push or deployment was performed.

## 18 November 2026 — user-directed visual refinement

User supplied desktop screenshots and a Mobbin MD; feedback: faint background,
navbar inconsistency, trailing glyph alignment, heading sizing and absent pointer
feedback. Revised source implements stronger cube shading/masking, uniform quiet
navigation, interspersed cycling glyphs with pause/reduced-motion handling, revised
heading metrics and pill/pointer/hover controls. This is implementation evidence,
not a rendered verification result. UI-01–UI-20 remain NOT REVIEWED for this revision;
no tests or browser checks were run under the user's existing instruction. Local
changes only; no commit, push or deployment was performed.

## 18 November 2026 — navbar alignment and login hover correction

User screenshot showed a circular login hover fill and a low wordmark relative
to navigation labels. Login now uses text-only hover feedback; logo/navigation
share a baseline-aligned group, without the wordmark's asymmetric line-box effect.
Login uses the same 44px/24px target/text geometry as navigation labels. Mobile
retains centered controls. Source change only; UI-08/UI-09/UI-13 remain NOT REVIEWED
until user inspection. No tests, browser checks, commit or push were performed.

## 18 November 2026 — product preview and workflow implementation

Implemented sections 2–3 from docs/design/SECTIONS_02_03_PLAN.md. Tabs switch local
read-only illustrations with semantic/manual keyboard handling; workflow uses
sample records and a decorative reading-progress rail. Mobile/table reflow,
reduced-motion styles and anchors are implemented. Private data/API/provider
behavior is not connected. Product and How it works now have real anchors.

UI-01–UI-20 remain NOT REVIEWED for this revision. The user continues to own local
testing: no automated tests, lint, typecheck, build, HTTP probes or browser
inspection were run. No screenshot or performance PASS is claimed. No commit,
push, deployment or live provider action was performed.

## 18 November 2026 — sections 4–5 implementation

Added context comparison and agency-control sections from the agreed plan.
Implemented native range/keyboard interaction, full-view controls, mobile stacked
scenes, reduced-motion transitions, responsive bento grouping and an anchor to
#agency-control. All scenarios are synthetic. Illustration content and prose keep
client decision, provider action and invoice states distinct.

No tests, lint/type/build checks, HTTP probes or browser review were run because
the user's local-testing instruction remains in force. UI-01–UI-20 are NOT REVIEWED
for this revision; no responsive, accessibility or performance signoff is claimed.
No packages, external images/fonts, API calls or analytics were added. No commit,
push, deployment, real email or payment/provider action was performed.

## 18 November 2026 — sticky header implementation

Implemented sticky top positioning, a desktop trial action revealed after the
hero CTA passes the header, reverse transition on return, mobile menu overflow
containment, reduced-motion handling and anchor offsets. Initial CTA below the
viewport does not count as passed. Header/CTA geometry is observed for resize.
No tests, browser checks or HTTP probes were run under the user's existing local-
testing instruction. UI-09/UI-12/UI-13/UI-14/UI-18/UI-19 remain NOT REVIEWED for
this change. Pricing plan only: no pricing code, provider action, commit or push.

## 18 November 2026 — pricing and sticky-navigation refinement

Added the single Team plan and trial summary from the agreed design. Public
price is ₹1,499/workspace/month; limits reflect the existing billing policy. Tax
and provider amount matching remain manual release gates. Pricing links in the
navbar/hero now target #pricing; signup/login remain inactive previews.

Sticky header has an early scroll divider, hero-relative CTA visibility and
an intermediate-mobile layout that replaces login with the CTA after scrolling.
No tests, lint/type/build checks, HTTP probes or browser review were performed
under the user's standing instruction. UI controls remain NOT REVIEWED for this
revision. No purchase, provider setup, commit, push or deployment occurred.

Development-server output during hot reload also relayed a React instrumentation
error whose stack points into the browser's React DevTools Chrome extension.
The server subsequently reported compilation and a GET / 200. This was not
investigated with browser tooling under the user's testing boundary, and neither
message is treated as a visual or runtime signoff.

## 18 November 2026 — compact scrolled navbar

Implemented user feedback about excessive sticky-header height: 96→64px desktop,
72→56px mobile; 220ms transition and separate compact/restore thresholds.
Updated anchor/workflow clearance and expanded mobile-menu viewport limit.
Source implementation only, NOT REVIEWED visually or through interaction tests;
no tests, browser checks, commit or push performed.

## 18 November 2026 — FAQ implementation

Added independent question/answer controls, first answer open, Ink accent/pale Sky
expanded surfaces, Plus/Minus transitions and responsive stacked layout. Answers
cover manual provider work, private verified client decisions, trial read/export,
supported CSV import and cancellation at paid-term end. No backend/provider calls.
UI controls remain NOT REVIEWED for this revision: no tests, type/build checks,
HTTP probes or browser review run under the user's local-testing instruction.
No new package, external asset, commit, push or deployment performed.

Server output also relayed a hydration warning showing extra `monica-id` and
`monica-version` attributes on body, consistent with a browser extension modifying
HTML. No hydration-suppression workaround was added. This was not investigated
with browser tools, and the subsequent compile/GET messages are not UI signoff.

## 18 November 2026 — closing CTA and footer

Implemented planned closing CTA plus the user's requested Mobbin-inspired footer.
Large lower RenewRelay text is decorative; functional/footer text stays readable.
Link columns contain only existing anchors and the confirmed agency URL. Legal,
contact and social destinations remain absent until confirmed, not dummy links.

Responsive layout and reduced-motion/one-time connector animation are implemented
but NOT REVIEWED. No tests, lint/type/build checks, HTTP probes or browser review
were run under the user's standing instruction. No new packages, real signup,
payment, external message, commit, push or deployment occurred.

## 18 November 2026 — closing CTA simplification

User rejected the closing icon row. Removed its labels, icons, connector and
animation; balanced panel padding and removed the now-unnecessary client boundary.
Local source change only. No tests/browser checks, commit or push performed.


## 18 November 2026 — authentication UI previews

Screens/version: initial local /login, /signup, /check-email, /verify-email,
/forgot-password, /reset-password, /two-factor, /setup-authenticator and
/auth-complete. UI-01–UI-20: NOT REVIEWED at screen level. Viewports/states have
not been rendered; no screenshot, interaction, zoom, keyboard, contrast or
screen-reader evidence is claimed. User will review locally.

Source review: shared Ink & Sky tokens/local font, responsive split/single column,
semantic fields and errors, pending/abort handling, full code paste, no provider
or session side effects, development-only route guard and synthetic material.
Local preview tools expose invalid credentials/code, connection failure, sample
rate limit, email-unverified, MFA-required, expired and reauthentication scenarios.
A real code is not verified; scenario transitions are explicit previews.

Applicable production gates remain pending: connected session/MFA/callback flows,
real email delivery, legal destinations, browser checks and end-to-end integration.
No tests, type/lint/build checks, browser/HTTP checks, commit, push or deployment.


## Authentication refinement — user screenshot feedback

Evidence received: user-supplied signup screenshot showing offset double focus
borders and brand panel extending below the viewport. Changed auth.css and
 auth-shell.tsx: continuous inset focus edge; viewport-height desktop aside;
flow-positioned full wordmark; shorter-window rules; realistic synthetic renewal
cards with readable separation and restrained rotation. Focus/viewport/card
controls UI-03–UI-06, UI-09–UI-10 and related responsive/accessibility criteria
remain NOT REVIEWED for the revised version. No new rendered evidence or tests
were produced under the standing user instruction. No backend/provider/push work.


## Login-only polish — local source change

Changed login spacing, visible password toggle label, recovery-link placement
and password-manager autocomplete. Responsive rules remain naturally scrolling
with 16px inputs and 44px toggle/recovery targets. Source inspection only;
rendered mobile, keyboard and password-manager behavior NOT REVIEWED. No tests,
build/type checks, browser checks, backend wiring or push performed.


## Authentication — complete shared refinement pass

Scope: all nine existing auth preview routes and enrollment/recovery substates.
Source review covers shared spacing and Show/Hide controls, recipient confirmation,
long-address wrapping, rate-limit/pending states, stale-error clearing, four-step
setup progress, clipboard/download fallbacks, failure-result rendering and focus
on new headings. Revised mobile code spacing, flexible action widths and natural
scrolling preserve the existing desktop aside and single-column mobile shell.

UI-01–UI-20 remain NOT REVIEWED for rendered outcomes: no browser screenshots,
interaction/keyboard, assistive-technology, zoom or viewport checks were run under
the user's standing instruction. No tests/type/lint/build checks were run. Source
inspection is not runtime verification. No backend changes, real auth requests,
mail, session/storage writes, push or deployment. User requested this pass across
all screens rather than repeated screen-by-screen polish tasks.
