# RenewRelay frontend UI quality checklist

Research date: 18 November 2026. Scope: public marketing website, authenticated
staff application and private client-decision screens. No frontend implementation
or screen-level compliance is certified by this document.

## Purpose and evidence boundary

Avoid an arbitrary, generic or unfinished interface. No visual trait proves that
AI authored a page. The controls below combine established usability/accessibility
guidance with RenewRelay-specific editorial choices. Emojis, gradients, cards,
serif fonts and animation are not universally bad. For this product, use each
choice deliberately and consistently; do not substitute decoration for useful
content. Design-system examples inform behavior, not a requirement to copy their
visual identity. Accessibility checks here are a subset, not full WCAG certification.

All controls begin NOT REVIEWED. A checkbox is completed only for a named screen,
version and state with evidence. A checklist cannot substitute for visual judgment
or representative-user testing. Backend test results do not verify the frontend.

## The 20 controls

### UI-01 — Generic template composition and unsupported claims

- [ ] Reviewed: the page explains RenewRelay's actual job rather than a generic SaaS promise.

Avoid interchangeable hero slogans, unrelated stock/AI imagery, fake dashboards,
customer logos/testimonials, inflated usage counters and unverified uptime/security
claims. Use the real sequence: client decision → provider action → invoice status.
Marketing should establish audience, purpose, product evidence and next step in a
coherent reading order. Review: can someone explain the product after seeing the
opening section? Check every public claim against released behavior. This product
rule applies the signal/noise principle in [S2]; it is not a claimed scientific
"AI detector."

### UI-02 — Decorative emoji clutter

- [ ] Reviewed: headings, navigation and operational statuses contain no arbitrary emoji decoration.

For RenewRelay, do not use rockets, sparkles, money bags or emoji bullets as a
substitute for product meaning. Emoji appearance can vary by platform. Preserve
emoji inside legitimate user-entered content when appropriate. Review navigation,
headings, badges and empty states; replace unnecessary symbols with clear text or
a deliberate icon. This is our brand/editorial rule, informed by [S2, S3].

### UI-03 — Mixed or ambiguous icons

- [ ] Reviewed: interface icons share a family, sizing/stroke convention and stable meaning.

Avoid mixing filled, outline, multicolor and illustration-style icons arbitrarily.
Give unfamiliar actions visible text; compact familiar icon-only controls still
need accessible names and a usable target. A tooltip cannot be the only way to
understand a critical action. Review a sheet of all icons and test interpretation
in context, not merely recognition of the drawing. [S3]

### UI-04 — Random font choices and weights

- [ ] Reviewed: font families, weights and text roles follow the approved type system.

Proposed project constraint: one interface family, with an optional deliberate
marketing display family. This is not a WCAG rule or a universal two-font limit.
Avoid per-section fonts, arbitrary bolding, decorative body text and inconsistent
line-height. Check real Indian currency amounts, dates, long names, fallback fonts
and missing weights. Select actual fonts during design, not in this research step.
[S1, S4]

### UI-05 — Weak information hierarchy

- [ ] Reviewed: title, purpose, primary task and supporting detail are visually distinguishable.

Avoid equally prominent headings, giant metric numerals with no meaning, tiny
important dates and paragraphs styled like headings. Use semantic heading levels
and deliberate size/weight/spacing roles. Review without reading every word:
can the viewer identify the page's purpose and where to act? The operational queue
should prioritize work, not decorative statistics. [S1]

### UI-06 — Arbitrary color and status meanings

- [ ] Reviewed: brand, neutral, success, warning, danger and focus colors have stable roles.

Avoid unrelated accent colors for every section, rainbow badges and using the same
color for conflicting outcomes. Pair status colors with explicit labels. Approved,
renewed, invoiced and paid must remain distinct business meanings. Define semantic
color tokens and inspect all status variants together. Color alone must not carry
meaning. [S4, S5]

### UI-07 — Faint text and unreadable surfaces

- [ ] Reviewed: relevant text and controls meet applicable contrast requirements.

Avoid pale-gray text, low-opacity labels and text over uncontrolled imagery or
transparency. Check actual rendered foreground/background pairs, not just palette
swatches: normal text at least 4.5:1; WCAG large text at least 3:1, subject to the
criterion's exceptions. Large means at least 18pt, or 14pt bold—not simply a heading
tag. Check meaningful UI indicators against non-text contrast requirements too.
Do not rely on disabled-control exceptions to hide necessary instructions. [S5]

### UI-08 — Inconsistent spacing and grouping

- [ ] Reviewed: padding, gaps and section spacing use the approved token scale.

Avoid improvised margins, cramped labels, oversized unexplained gaps and identical
distance between related and unrelated items. Proposed token starting point:
4/8/12/16/24/32/48/64 CSS px, with responsive adjustments and documented optical
exceptions. This is a project convention, not an accessibility standard. Compare
repeated forms, rows and page sections; related elements should read as groups.
[S1, S6]

### UI-09 — Drifting alignment and page geometry

- [ ] Reviewed: headers, content, toolbars and repeated columns align to a shared grid.

Avoid arbitrary centering, competing container widths, uneven gutters and action
bars that shift between screens. Public pages and dense app screens may use
different grids, while retaining shared brand tokens. Check screenshots at the
same viewport side by side, including optical alignment of icons and text. [S1]

### UI-10 — A card around everything

- [ ] Reviewed: surfaces and containers communicate useful grouping or interaction.

Avoid nested card-on-card panels, a separate box for every sentence, and repetitive
feature tiles unrelated to the story. Use tables for comparisons, lists for
sequential work and plain sections when a boundary adds nothing. A card is allowed
when it groups a meaningful entity or task. Review whether removing a border or
panel makes the structure clearer. [S2; project application]

### UI-11 — Unmotivated effects and visual noise

- [ ] Reviewed: shadows, radii, borders, gradients and illustrations have documented roles.

Avoid applying glass effects, glow, blur, oversized rounding and heavy shadows to
every surface. Use a small elevation/radius system; keep body content readable.
A deliberate gradient is allowed. An effect fails review when it competes with
information, obscures controls or makes unrelated elements look interactive.
Evaluate decoration against the task, not against a ban on particular colors.
[S2, S4; project application]

### UI-12 — Distracting or obstructive animation

- [ ] Reviewed: motion supports feedback/orientation and nonessential motion can be reduced.

Avoid scroll hijacking, endless pulsing CTAs, animated cursors, parallax in work
queues and repeated entrance effects that delay reading. Honor reduced-motion
preferences and leave content available when animation is off. Inspect menus,
dialogs, loading and transitions. Disabling interaction-triggered nonessential
motion is our chosen policy, aligned with WCAG 2.3.3 (AAA); do not mislabel it an
AA requirement. [S7]

### UI-13 — Inconsistent buttons and competing actions

- [ ] Reviewed: buttons follow shared variants, dimensions, placement and state behavior.

Avoid three equally dominant CTAs in one task group, different radii per page,
vague "Submit" labels and destructive actions styled like routine saving. Prefer
one visually dominant action per task region; independent regions may each have
one. Use precise verbs such as "Send decision request" and "Record renewal".
Check default, hover, focus, pressed, submitting and disabled states. [S8]

### UI-14 — Unpredictable navigation and vocabulary

- [ ] Reviewed: navigation, active location and product terminology stay consistent.

Avoid moving core navigation, unlabeled icon menus and alternating "client,"
"customer" and "account" for the same entity. Clearly indicate workspace context,
location and return paths. Login links go to the app; public legal/pricing links
stay available in the marketing site. Test direct links, browser back, refresh
and workspace switching. Familiarity should not require guessing. [S4; project rule]

### UI-15 — Forms that look finished but are hard to complete

- [ ] Reviewed: forms have persistent labels, helpful constraints and actionable errors.

Avoid placeholder-only labels, unexplained required fields, cryptic validation,
errors shown only in a disappearing toast and clearing valid input after failure.
Associate errors with fields; use a linked summary for longer forms and preserve
entered data. Confirm destructive consequences. For RenewRelay, label service
expiry, provider notice and response dates separately; unknown quote is not zero.
Test keyboard submission, invalid values, expired auth and server rejection.
[S9, S10; RenewRelay semantics]

### UI-16 — Missing loading, empty, error and recovery states

- [ ] Reviewed: the screen is designed beyond the successful populated state.

Avoid blank panels, permanent spinners, misleading zero counts during loading,
silent failures, fake success and dead-end "Something went wrong" messages.
Distinguish first use, no search matches, unavailable data and denied access.
Provide an appropriate next step; preserve filters/input and prevent duplicate
submission while explaining progress. Check slow responses, retry, session expiry,
read-only subscription, expired links and partial delivery failures. Skeletons
should reflect the expected layout, rather than becoming decoration. [S11, S12]

### UI-17 — Tables and metrics that distort business meaning

- [ ] Reviewed: operational data is readable, comparable and correctly labeled.

Avoid tiny dense rows, unexplained numbers, random decimals, misaligned money,
missing units and charts with no decision to support. Use clear headers, stable
row heights, aligned numeric columns, discoverable sorting/filter state and an
appropriate detail view. Show currency and unambiguous date formatting; group totals
by currency. Separate SaaS payment, client approval, provider completion and agency
invoice state. Unknown quote must remain visibly unknown. [S13; RenewRelay rules]

### UI-18 — Desktop-only layouts and brittle content sizing

- [ ] Reviewed: layouts survive narrow screens, text enlargement and long content.

Avoid fixed-width forms, clipped controls, overlapping sticky bars and forcing the
entire page to scroll sideways. Check at 320, 375, 768, 1024 and 1440 CSS px as a
project sample—not proof of every device. Test 200% text enlargement and reflow
at 320 CSS px equivalent (for example 400% zoom from 1280). Wide tables may need
a contained two-dimensional view where the WCAG exception applies; retain all
essential data/actions and keep surrounding content usable. [S14]

### UI-19 — Mouse-only controls and inaccessible compactness

- [ ] Reviewed: keyboard access, focus, accessible names and targets are usable.

Avoid removing outlines, hover-only actions, clickable divs without semantics,
focus traps and controls hidden under sticky UI. Tab through in a logical order;
check Enter/Space/Escape as appropriate, dialog focus/return, and screen-reader
names/status feedback. WCAG AA target size is 24×24 CSS px or qualifying spacing/
exceptions. Prefer approximately 44×44 for primary touch controls as a project
comfort target, not a universal AA minimum. Test visible focus separately. [S15, S16]

### UI-20 — Finishing only the perfect demo

- [ ] Reviewed: real content and repeated components survive a final consistency review.

Avoid beautiful mockups that break with long names, mixed currencies, missing
values, one record or hundreds of records. No lorem ipsum, dummy links, invented
statistics or placeholder illustrations should ship as real product evidence.
Check strings, truncation with access to full content, currency/date conventions,
icon centering, baseline alignment and all repeated components across routes.
Use a realistic synthetic agency dataset and screenshots; verify each visible
action has the promised behavior. This is an engineering/design review rule,
applying [S1, S11, S13], not a claimed external certification.

## How to use this checklist every time

Before implementation, approve a small design foundation: typography roles, color
roles, spacing/grid, icon family, buttons/forms, surfaces and motion. Do not pick a
new visual system independently on each page. Marketing and operational density
can differ intentionally. This checklist is not that visual-design approval.

For each screen or material change, record:

| Screen/route | Commit/design version | Viewport + state | UI IDs | Result | Evidence | Remaining issue/owner |
|---|---|---|---|---|---|---|
| No screens reviewed yet | Research only | Not applicable | UI-01–UI-20 | NOT REVIEWED | This document | Frontend implementation pending |

Allowed results: NOT REVIEWED, PASS, FAIL, or NOT APPLICABLE with explanation.
A PASS needs a named screenshot/measurement/interaction result. Mark only reviewed
items complete in that screen's record; do not turn this master into an evergreen
all-green claim. Compare sibling screens side by side. Recheck affected IDs after
changes; do the full 20-point review at a frontend milestone. Record justified
exceptions rather than silently inventing new styling rules.

Minimum evidence: visual screenshots at desktop/mobile, token/component inspection,
contrast measurements, keyboard/focus review, reduced-motion test and real-content/
failure-state walkthrough. Automated accessibility tools assist; they cannot judge
visual hierarchy or replace manual keyboard, screen-reader and user testing.

Unresolved access, readability, misleading business states, broken actions and
critical recovery failures block screen signoff. Fix arbitrary visual inconsistencies
before approving the design. Do not weaken authentication or hide required
information merely to produce a cleaner screenshot.

## Research sources

Sources were accessed on 18 November 2026. Research principles are paraphrased;
RenewRelay examples and proposed conventions are our application of that guidance.

- S1: [NN/g — Good Visual Design, Explained](https://www.nngroup.com/articles/good-visual-design/),
  [visual design principles](https://www.nngroup.com/articles/principles-visual-design/).
- S2: [NN/g — Aesthetic and Minimalist Design](https://www.nngroup.com/articles/aesthetic-minimalist-design/).
- S3: [NN/g — Icon Usability](https://www.nngroup.com/articles/icon-usability/).
- S4: [GOV.UK — Styles](https://design-system.service.gov.uk/styles/).
- S5: [W3C — Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html),
  [Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html),
  [Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).
- S6: [GOV.UK — Spacing](https://design-system.service.gov.uk/styles/spacing/).
- S7: [W3C — Animation from Interactions, AAA](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html).
- S8: [GOV.UK — Buttons](https://design-system.service.gov.uk/components/button/).
- S9: [GOV.UK — Text input](https://design-system.service.gov.uk/components/text-input/).
- S10: [GOV.UK — Error summary](https://design-system.service.gov.uk/components/error-summary/).
- S11: [Carbon — Empty states](https://www.carbondesignsystem.com/building-blocks/core/patterns/empty-states).
- S12: [Carbon — Loading](https://www.carbondesignsystem.com/building-blocks/core/components/loading/guidelines).
- S13: [Carbon — Data table guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines).
- S14: [W3C — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html),
  [Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html).
- S15: [W3C — Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html).
- S16: [W3C — Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
