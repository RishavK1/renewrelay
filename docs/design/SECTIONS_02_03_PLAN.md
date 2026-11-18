# RenewRelay — next two homepage sections

Prepared 18 November 2026. Scope: design and content decisions only. No app code,
packages, tests, browser sessions, commits, pushes or deployment in this task.
The current navbar and hero remain the implementation baseline. These are sections
2 and 3, immediately after the hero. The earlier problem-only section 3 proposal
is replaced by a practical workflow story; do not add an extra section for it.

## The reading sequence

Hero: understand the promise → Section 2: inspect the product → Section 3:
understand the workflow → a contextual trial action.

This is a conversion hypothesis, not evidence of measured conversion uplift.
Make the product understandable before asking visitors to pay. These two sections
will not contain pricing cards, invented savings, logos or testimonials.

## Reference decisions and evidence

Revisited the supplied Mobbin and Calendly design MDs and their current public
page content. MDs are computed-style snapshots, not full source designs. User
screenshots provide visual direction; no new live browser inspection was performed.

- [Mobbin](https://mobbin.com/): product example follows the hero; later content
  frames the research problem with recognizable examples. Transfer demonstration
  and clear hierarchy, with quiet borders and controlled corner radii.
- [Calendly](https://calendly.com/): product explanations pair benefits with
  concrete visuals; its lifecycle content explains stages and follow-through.
  Transfer the connection between a benefit, visible evidence and the next action.
- [Aceternity Animated Tabs](https://ui.aceternity.com/components/tabs) is selected
  as the source foundation for section 2. Its
  [registry source](https://ui.aceternity.com/registry/tabs.json) was inspected.
  Keep its animated active pill and selected panel composition. Adapt raw source:
  strict ReactNode types, keyboard/ARIA tab semantics, scoped motion IDs, inactive
  content hidden from focus/accessibility, stable panel height, reduced-motion
  behavior and readable transitions. Replace the demo's bouncy 40px panel movement
  and large hover fan-out with restrained movement; record source deviations.
- [Aceternity Timeline](https://ui.aceternity.com/components/timeline) is selected
  for section 3. Its [registry source](https://ui.aceternity.com/registry/timeline.json)
  was inspected. Preserve the spine, milestone labels and desktop sticky behavior.
  Replace changelog copy and purple/blue beam with RenewRelay content/tokens;
  compress its very large row gaps. Add responsive height remeasurement, semantic
  ordered content and a static reduced-motion rail. These are adaptations, not
  claims that the untouched source already meets our requirements.

Other evaluated candidates:

| Candidate | Decision | Reason |
|---|---|---|
| [Container Scroll Animation](https://ui.aceternity.com/components/container-scroll-animation) | Not selected here | 3D rotation/scale makes dense preview content harder to read during the first scroll; the hero already has signature motion |
| [Sticky Scroll Reveal](https://ui.aceternity.com/components/sticky-scroll-reveal) | Reserve for another use | Competes with the chosen timeline; a second changing preview could repeat section 2 and risk nested scrolling |
| Bento grids, hover lifts, infinite carousels | Not needed in these sections | A single coherent preview and chronological story communicate more clearly than many equally prominent cards |

Use actual selected library source when coding, with provenance/license/version
recorded. No component has been installed for this plan. Verify source terms at
import; do not copy reference media, proprietary fonts, changelog assets or paid
blocks without entitlement. Keep local Manrope and Lucide; no new font/icon family.

## Shared geometry and first-scroll transition

- 1200px maximum content container; align its edges with the hero content grid.
  Header's narrower internal container remains an intentional distinct role.
- Existing snow #FCFBF8, ink #071A31, sky #C3DFFE, muted #526171 and border
  #D8DFE5. White is the product/card surface. No new accent palette.
- H2: Manrope 44px/1.12, weight 650, tracking -0.025em; 30px/1.2 mobile.
  Section lead: 18px/1.55 desktop, 16px/1.6 mobile. Preview text: 14px minimum;
  essential labels never tiny or low-opacity.
- Spacing roles: 8/12/16/24/32/48/64/80/112px. Showcase radius 28px desktop,
  20px mobile; product frame 16px; inner entity cards 12px; action/tab pills.
- Once these sections are implemented, reduce hero bottom padding to 64px and
  section 2 top padding to 64px (48px + 48px mobile), avoiding a double blank
  viewport. Preserve normal page flow; no scroll snapping or forced jump.
- Fade the cubes into snow over the hero's last ~96px. Do not repeat moving cubes
  behind the product preview or workflow. No horizontal overflow on the page.

## Section 2 — inspect the product

### Exact copy and placement

Centered H2:

> One workspace for every client renewal.

Centered lead, maximum 640px, 20px below heading:

> See what needs attention, what your clients have decided, and what your team
> needs to do next.

The main showcase begins 40px below the lead. It contains three manually selected
tabs above a single product preview. Tab order is stable; default is Renewal
 overview. Tab labels are **Renewal overview**, **Client view**, **Team follow-through**.
Tab strip height at least 44px. Active fill sky/ink; inactive text ink on snow,
with a quiet hover tint. No hover-triggered tab switching or auto-rotation.

Illustrative layout:

```text
              One workspace for every client renewal.
               Short explanation, maximum two/three lines

          [Renewal overview] [Client view] [Team follow-through]
  ┌────────────────────────────────────────────────────────────────────┐
  │ Sample workspace                                  Example preview │
  │                                                                    │
  │    ONE LEGIBLE PRODUCT SURFACE; CONTENT CHANGES WITH THE TAB          │
  │    Real fields, realistic sample records, no fabricated metrics      │
  │                                                                    │
  └────────────────────────────────────────────────────────────────────┘
                        See how a renewal moves forward ↓
```

The small visible caption is **Illustrative product preview · Sample data**.
Do not present this as a screenshot of a completed staff frontend. Use a curated
HTML product illustration matching real backend fields, not a decorative image
of a dashboard we cannot read. Sample records are bundled locally; no public
marketing fetches to authenticated APIs, real clients or decision links.

### The three panels

| Tab | Main visual | Specific information | One-line caption |
|---|---|---|---|
| Renewal overview | Readable agency work queue: three rows; a highlighted hosting record with a compact detail area | Service/client, next action date, assigned teammate and waiting/ready/blocked context. Detail explicitly separates expiry, provider notice and client response dates. No chart or unlabeled KPI counters. | “Dates, responsibility and outstanding work, together.” |
| Client view | Focused private decision-screen illustration, centered within the same showcase | Client/service, visible quote and currency, term, response date, verification context and decision choices. No supplier cost, workspace sidebar or unrelated records. Choice labels shown as read-only illustration text, not fake active form buttons. | “Give clients the details they need to make a decision.” |
| Team follow-through | The same hosting record after client response, with assigned operator and separate outcome/invoice fields | Client approved; staff still needs to act. Show performed date/provider reference only in the completed sample. Invoice state is “To invoice” or “Invoiced”, never an invented payment receipt. | “A client response is the start of the next action.” |

Default overview sample set: website hosting for Northline Studio, domain renewal
for Oak & Field, maintenance for Lumen Works. Names and dates are explicitly
synthetic. Highlight Northline throughout the two sections to avoid making the
visitor relearn a new example. Illustrative scenario snapshot: 1 December 2026;
hosting expiry 12 December, provider notice 7 December, response requested by
5 December, assigned teammate Riya. If a quote is shown, use **₹2,400 for 12 months**
and identify it as the sample client's service quote, never RenewRelay's SaaS
subscription price. Unknown quotes remain unknown in other examples.

Use only supported meanings: waiting_on_client, ready_for_operator and blocked
are query contexts, not a replacement for the underlying renewal states.
Source grounding: packages/domain/renewals/queries.ts, packages/db/prisma/schema.prisma,
packages/contracts/decisions.ts. Decision choices map to approve/cancel/question;
real private flows require their verification/access checks. The illustration
can show a verified view but must say “After verification” rather than imply the
public link bypasses it. Do not imply agency staff have only these three views.

### Surface, motion and hover

- A single rounded presentation well with a restrained fixed gradient
  **#F3F7FA → #E5F0FA**, white product surface and one fine border. Gradient is a
  proposed tonal extension of Ink & Sky, not a new brand color or animated wash.
- Showcase padding 32px desktop / 16px mobile. One subtle showcase shadow:
  ink at ~6%, 0 20px 60px -28px. No shadow on every row or sentence.
- Tabs: active-pill movement ~200ms ease-out; panel crossfade 180ms, at most
  4px vertical travel. No spring overshoot, 3D rotation or card fan on hover.
- User changes tabs; pointer hover only changes the tab's surface. Demo rows are
  not fake clickable controls. No shimmer, scanning beam or pulsing badge.
- Preserve the selected tab while scrolling. Reserve sufficient panel space so
  the CTA and next heading do not jump on tab selection; calculate responsive
  min-height from actual content, not a clipped hard-coded height.
- Reduced motion: instant panel swap and static selected indicator. Inactive
  panels are hidden from focus/assistive technology. Arrow keys, Home/End and
  visible focus follow the tab pattern; use controlled/manual activation.

### Mobile and action

Below 768px remove decorative application sidebar. Overview rows become complete
stacked records, not a shrunken desktop screenshot. Client panel becomes a readable
single-column view; quote/dates and verification note remain. Tabs use wrapping
rows in fixed order; no clipped labels, hidden horizontal scrollbar or swipe-only
access. Do not show the three tabs simultaneously in a fake screen collage.

After the panel and caption, a quiet text link **See how a renewal moves forward**
scrolls to section 3 (#how-it-works). It is an anchor, not a button opening an
unbuilt tour or video. Motion respects reduced-motion preference. This is a
comprehension step, so no second large trial CTA is needed here.

## Section 3 — understand the actual workflow

### Exact opening copy

Left-aligned H2:

> From a due date to a clear outcome.

Lead:

> Prepare the details, collect a decision, and record what your team does next.

Use a white section surface, 112px top/bottom desktop and 64px mobile. Within
1200px, the heading/lead occupy up to 680px. Timeline starts 48px below the lead.
The contrast with section 2 comes from composition and surface, not another effect.

### Three milestones, one continuous example

| Milestone | Exact title and body | Supporting visual |
|---|---|---|
| 1 — Prepare | **Put the renewal in place.** “Add the service, dates and assigned teammate. Prepare the client quote and terms before asking for a decision.” | Hosting record: Northline Studio, Riya, distinct expiry/notice/response dates; sample quote and 12-month term |
| 2 — Decide | **Give the client a clear choice.** “Send a private decision request. Clients can approve, decline or ask a question after verification.” | Compact decision-summary card. Worked example shows approval received; a separate short note states questions stay visible for staff follow-up |
| 3 — Follow through | **Finish the work. Keep the record.** “Your team reviews the decision, handles the provider action, and records the outcome. Track invoicing separately where needed.” | One outcome card: renewal recorded, performed date and reference; distinct “Invoice: To invoice” row. Small note: “Client approval does not renew the service automatically.” |

Step 2's visible sample is an approval, not an endlessly auto-playing approve/
cancel loop. The milestone number describes the story order, not automatic backend
transition or a claim that every renewal has identical operations. Do not put
supplier cost in a client-facing illustration, or show cancellation as already
performed simply because a client declined. Clarify what the agency does manually.

```text
  From a due date to a clear outcome.
  Prepare the details, collect a decision…

  ●  1  Put the renewal in place.       [Dates + owner + terms]
  │     Concise explanatory paragraph
  │
  ●  2  Give the client a clear choice. [Client decision summary]
  │     Concise explanatory paragraph
  │
  ●  3  Finish the work.               [Recorded outcome]
        Keep the record.              [Invoice state — separate]

                [Start your free trial]
             14-day trial · 10 renewal items · 3 team seats
```

### Timeline geometry, cards and behavior

- Desktop: approximately 40% text / 60% record illustration; 48px gutter. The
  timeline spine sits at the left, with one small milestone marker per step.
  Each milestone has one useful record grouping, not nested generic card grids.
- Three rows, approximately 280–340px each depending on content, with ~56px
  separation; no giant blank spacer or fixed multi-viewport scroll duration.
- Adapt Aceternity's timeline to keep the current milestone label sticky only
  within its own row on roomy desktop screens. Essential text stays fully opaque.
  No entire-page pinning, independent scroll container or hidden previous steps.
- Rail: border-colored base, restrained sky-to-ink progress fill following normal
  page scroll. It communicates reading position only, not workflow completion.
  Never auto-change example business status based on scroll position.
- Cards: white, fine border, 16px corners; 24px padding desktop, 20px mobile;
  no tilt, hover elevation or cursor pointer on noninteractive summaries.
- No simultaneous entrance effects on every card. The rail provides the motion;
  content is immediately readable. Resize/font loading must not mismeasure it.
- Mobile, short viewports and reduced motion: ordinary stacked ordered steps with
  a static rail. Disable sticky labels; show each record directly under its text.
  Keep full text and useful fields; no side-scrolling illustrations.
- Lucide: CalendarDays, MessageSquare and CircleCheck only where they clarify the
  stages. Ink/sky for identity; meaningful status also has plain text. No emoji,
  third-party app logos or icons implying integrations we do not offer.

### CTA and intended destination

After the last milestone, allow 48px then one centered primary pill:
**Start your free trial**. Same dimensions, wording and hover/focus as the hero.
Under it: **14-day trial · 10 renewal items · 3 team seats**.

Once authentication screens exist, the CTA goes to the app signup route. While
this remains a local marketing-only preview, retain explicit inactive-preview
behavior rather than sending visitors to a missing page. “How it works” in the
navbar can become a real #how-it-works anchor when section 3 is implemented.
Pricing/login remain outside this batch; do not enable them as dead links.

## Evaluation and later implementation gates

| Criterion | Decision | Evidence boundary |
|---|---|---|
| First-scroll relevance | Product demonstration immediately follows the promise | Planned, not user-tested |
| Distinct section roles | Section 2 = inspect; section 3 = understand sequence | Proposed story structure |
| Reference fidelity | Real Aceternity source foundations; Mobbin demonstration hierarchy; Calendly lifecycle clarity | Official docs/source inspected; no rendered comparison |
| Conversion | Exploration anchor, then one contextual trial CTA | Hypothesis; no claimed uplift |
| Performance | Existing Motion; no new WebGL, video, remote fonts or heavy images in these sections | Implementation/measurement pending |
| Mobile/accessibility | Readable records, keyboard tabs, static reduced-motion, no nested scroll | Requirements, not passes |
| Truthful product behavior | Source-grounded fields; verification; decision/execution/invoice distinction | Source inspection only; illustrative UI not yet built |

Later checks: compare real desktop/mobile views, long labels/200% text, all tab
states, keyboard/focus, short viewport/sticky behavior, reduced motion, anchor
landing and layout stability. Keep screen controls NOT REVIEWED until evidence
exists. The user's existing request to conduct local testing themselves remains
in force unless changed. This plan adds no code or runtime dependencies.

Future measurement, after privacy decisions: preview-tab exploration, arrival at
workflow, trial starts and eventual activation/paid conversion with clear counts.
Do not add analytics now, send sample/client contents in events or imply a scroll
percentage proves retention. First validate that a new visitor can explain the
product and what remains the agency's responsibility.
