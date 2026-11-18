# RenewRelay — sections 4 and 5

18 November 2026. Planning only. No application changes, package installation,
testing, commits, pushes or deployments. These sections follow the existing
hero, product preview and three-stage workflow. They are recommendations for
review, not rendered or user-tested designs.

“Talently” is interpreted as Calendly, consistent with the supplied reference MD.
The complete Calendly MD was previously reviewed; its spacing, color, typography,
surface and motion sections were revisited alongside Mobbin and the product spec.
These extracted MDs describe computed styles, not complete source architectures.
Current public page text and official component sources were researched as below;
no claim is made of a new live visual/browser inspection.

## Why these two next

The first three sections explain the promise, product and normal workflow. The
next two answer different purchase questions:

1. **Why change the current process?** Show the context that gets scattered across
   reminders, messages and spreadsheets, and how a shared renewal record connects it.
2. **Will this still help when work gets complicated?** Show outstanding decisions,
   blockers, delivery issues, revised terms and invoicing, with clear responsibility.

Conversion hypothesis: recognizable problems plus concrete evidence of control
will make a trial more meaningful than another generic feature list. Retention
hypothesis: a useful daily work queue and a trustworthy history support repeated
use after signup. These hypotheses need user/usage evidence; no lift is assumed.

## Primary-source research

Competitor descriptions below summarize their own published positioning, not
independent verification of products, customer counts or effectiveness. Current
research does not establish exclusive differentiation or absent competitor features.

| Source | How the page tells its story | What it informs here |
|---|---|---|
| [Duvento](https://duvento.com/) | Agency-specific expiry hero; named problems around many dates, forgetting and scattered information; deadline examples; setup stages; benefits and plans | Recognizable agency situations and a concrete visual record |
| [Dotify](https://getdotify.com/en/) | Names domains/hosting/maintenance; describes accumulating manual coordination work; connects reminders with financial visibility; setup, preview, plans and FAQ | Explain operational effort and the transition from renewal work to billing records |
| [renewalQ](https://www.renewalq.com/) | Strong missed-renewal risk framing; urgency dashboard and reminder-chain demonstrations; separate feature modules and later commercial content | Show the consequence and the tool together, with understandable exception examples |
| [domainnotifications agency page](https://domainnotifications.com/for-agencies) | Positions responsibility, ownership and renewal context around agency portfolios | Assigned responsibility belongs beside the date, not buried in supporting copy |
| [Calendly](https://calendly.com/) | Product demonstrations and lifecycle explanations, followed by capability detail, customer proof and closing actions | Benefit-led copy next to visual evidence; preserve progression and spacing |
| [Mobbin](https://mobbin.com/) | Product-centered opening, problem framing and recognizable example categories | Let visitors recognize their work; use strong type and quiet framing |

Our positioning inference: deadlines/reminders are recognizable category entry
points. RenewRelay can explain the value of linking current client decisions,
assigned provider work and invoice status. This is supported by our product
spec/schema and code, not a claim to be the only platform offering it.

Keep rival customer counts, uptime promises, savings, channels, AI/vault features,
white-label offers and pricing out of RenewRelay's claims. No competitor badges,
logos or named feature-comparison table is needed in these sections.

## Section 4 — the problem becomes visible

### Exact copy

Heading:

> The deadline is only part of the job.

Lead:

> The date is in a spreadsheet. The quote is in an email. The client’s reply is in
> another thread. Bring the details and the next action into one renewal record.

Persistent comparison labels:

- **Scattered context**
- **One renewal record**

Three supporting problem/solution pairs, readable without operating the visual:

| Recognizable problem | RenewRelay explanation |
|---|---|
| “Which quote did the client agree to?” | “Keep the response connected to the quoted terms.” |
| “Who is handling this renewal?” | “Keep an assigned teammate and the next action visible.” |
| “Did the work happen, or did someone just reply?” | “Record the provider outcome separately from the client’s decision.” |

Closing line: **A reply, a completed renewal and an invoice are different things.**
Quiet anchor: **See what needs attention** → #agency-control (section 5).

### Composition — the deliberate visual change

A full-width **Ink #071A31** band is the page's next expressive moment. Snow heading,
Sky accents and light supporting text retain the chosen brand. This is one
marketing composition, not a new dark theme across the app.

Within 1200px, place a left-aligned heading/lead above a 1088px-wide comparison
stage. Desktop section padding 96px top/bottom; heading maximum 700px. H2 48px/1.12,
650 weight, tracking -0.025em; body 18px/1.6, maximum 650px. Heading-to-stage gap
40px. Stage radius 24px; roughly 440px desktop height, adjusted to the actual
illustration's proportions. No stretched/cropped text.

```text
  The deadline is only part of the job.
  The date is in a spreadsheet. The quote is in an email…

  Scattered context                       One renewal record
  ┌─────────────────────────────────────────────────────────────┐
  │ spreadsheet fragment   │      Client / service               │
  │ quote message          ◇      Quoted terms + client decision │
  │ “please renew” reply   │      Assigned teammate + next action │
  └─────────────────────────────────────────────────────────────┘
                   Drag to compare · two full-view controls

  Which quote?              Who is handling it?      Reply or completed work?
  Response + terms          Owner + next action      Separate recorded outcome

                      See what needs attention ↓
```

The illustration uses the same Northline hosting service as a **separate sample
moment before provider action**. Quote is ₹2,400 for 12 months; response is recorded;
Riya still has a provider action to perform. Earlier completed examples represent
a later stage. Never imply that the comparison imports messages, reads inboxes,
contacts a provider or reconstructs context automatically.

Use three intentionally positioned fragments on the scattered side, each with a
clear title, and a coherent record on the organized side. At most ±2° static
rotation on desktop fragments; no continuously floating cards. No third-party
email/spreadsheet logos or copied interface screenshots. These are original,
locally generated illustrative assets, visibly labeled **Sample scenario**.

### Selected component and interaction

Use the actual [Aceternity Compare](https://ui.aceternity.com/components/compare)
source as the starting foundation; [registry source](https://ui.aceternity.com/registry/compare.json)
was inspected. Retain its two-layer reveal and divider. Use drag activation,
not its default hover-follow behavior. Add a labeled native range/keyboard control,
visible focus, pointer capture and a practical minimum 44px handle target. Provide
**View scattered context** and **View renewal record** controls to expose either
complete illustration. Essential explanation stays outside the clipped visual.

Explicit adaptations: no Sparkles, Tabler icon package, autoplay timer, luminous
indigo/cyan beam or generic image alt text. Reuse Motion/Lucide and use a quiet
Sky divider. Generate original local assets, retain their source, and preserve
aspect ratio. Illustrations are decorative supplements to the complete prose;
accessible labels explain the comparison rather than duplicating every fragment.
Record the imported source version/hash and adaptations during coding.

Initial state 50/50. Drag moves only the divider; no scroll capture. Clicking a
full-view control settles over ~180ms; direct dragging follows input without
lag. The stage does not react simply because the pointer crosses it. No auto-reveal
or content entrance needed; the user-controlled comparison is the signature motion.
Reduced motion makes full-view changes immediate.

Below 768px, show both complete illustrations in a labeled vertical arrangement
and remove drag controls. Text size remains legible; no requirement to drag or
pinch-zoom to read. Use 30px heading, 16px body, 48–64px vertical padding and 16–20px
gutters. At zoom/short viewports prefer this stacked layout when needed. Essential
context is always visible regardless of interaction support.

Color roles: Snow on Ink for heading; #D5E2EE on Ink for body; Sky divider; white
record surfaces with Ink text. Optional fixed **#102C48 → #071A31** backdrop adds
quiet depth. No photographic/noise texture, animated gradient or second 3D scene.
Text colors and states still need rendered contrast review before signoff.

## Section 5 — control beyond the happy path

### Exact copy

Heading:

> Know what needs you. Keep the work moving.

Lead:

> Unanswered requests, blocked renewals and work still to invoice deserve a clear
> next step—not another search through your inbox.

This section answers operational objections after the visual problem comparison.
It is not another full dashboard or repetition of the three-stage walkthrough.

### Four useful visual groups

Use a measured asymmetric [Aceternity Bento Grid](https://ui.aceternity.com/components/bento-grid)
foundation. [Registry source](https://ui.aceternity.com/registry/bento-grid.json)
was inspected. Retain the grid/item composition; adapt source styling to shared
radii and readable type. Remove whole-card hover shadows and sliding text from
noninteractive cards. Do not copy demo titles or add Tabler dependencies; all
needed icons come from existing Lucide.

Desktop geometry: three equal columns, 24px gaps. Main card spans columns 1–2 and
two rows; two compact cards stack in column 3. A fourth, low-height history strip
spans all columns below. Content determines row height; do not force paragraphs
into 18rem demo rows. White/snow surfaces, 24px outer corners, fine borders,
24–28px padding; no card nested around every label.

```text
  Know what needs you. Keep the work moving.
  Unanswered requests, blocked renewals…

  ┌─────────────────────────────────┬────────────────────────┐
  │ Keep the next action visible.   │ Follow up with context.│
  │                                 │ request + delivery note│
  │ Operator work-list illustration ├────────────────────────┤
  │ Blocked / waiting / ready       │ Keep invoicing in view.│
  │ Named owner + next action       │ renewed ≠ invoiced     │
  ├─────────────────────────────────┴────────────────────────┤
  │ Know which decision still applies.  earlier → revised   │
  └──────────────────────────────────────────────────────────┘
                         [Start your free trial]
                     14-day trial · 10 items · 3 seats
```

| Group | Exact title and explanation | Visual evidence and boundary |
|---|---|---|
| Main, dominant | **Keep the next action visible.** “See work waiting on a client, ready for an operator or blocked by an issue—with the assigned teammate alongside it.” | Three compact exception examples, explicit state/context, owner and next action. A blocker has a readable reason. No all-green portfolio score or invented financial-risk total. |
| Top right | **Follow up with context.** “Keep unanswered requests and delivery issues visible so your team knows what to follow up.” | One request awaiting reply and one labeled delivery issue. A sent message is not shown as a read receipt or client consent. Do not promise guaranteed delivery. |
| Bottom right | **Keep invoicing in view.** “Separate completed provider work from what still needs to be invoiced.” | Completed sample renewal; **Invoice: To invoice**; quote/currency shown only as sample client terms. No “payment collected”, payment processor logo or SaaS subscription state. |
| Full-width strip | **Know which decision still applies.** “When renewal details change, earlier links are revoked and the revised terms need a current decision.” | Two dated revision summaries: earlier request superseded → current terms awaiting response. Do not silently reuse an earlier approval. Historical response remains history; no tamper-proof/legal-signature claim. |

Examples are labeled **Illustrative agency work · Sample data**. Use a consistent
sample snapshot or clearly separate exception scenarios; do not contradict the
same record's state in earlier sections without marking the different moment.
No fake clickable filters, an inert search field or a toggle that pretends to
clear an operational blocker. The main card is explanatory rather than interactive.

### Surface, hover, motion and mobile

- Return to Snow background after the Ink band; 112px section padding desktop,
  64px mobile. Headline 44px/1.12 and lead 18px/1.6; 30px/16px mobile.
- A subtle fixed sky wash can sit behind the main record area only. Smaller
  groups remain quiet white; history strip uses a very pale blue surface.
- No blanket card entrance/hover animation. Pointer stays normal over static
  summaries; actual anchors/buttons retain the existing pointer and hover rules.
- Optional first-entry history emphasis: a single 250ms fade of the connector
  between revision summaries; static labels and both requests are readable from
  the start. Reduced motion leaves it static. No autoplay of business states,
  status updates, notification counters or simulated email sends.
- Desktop history strip uses two side-by-side revisions and a Lucide ArrowRight;
  on mobile stack them chronologically with an ArrowDown. All essential copy
  remains visible, not dependent on hover tooltips.
- Tablet becomes two columns with main and history full-width. Below 768px use
  one column in the same reading order: action list, follow-up, invoicing, history.
  Avoid fixed card heights, horizontal scrolling and overlapping sticky content.
- Icons: ListChecks, MessageSquare/ MailWarning, FileText and History/RefreshCw,
  only where they identify content; one Lucide sizing/stroke convention.

Closing copy: **Give the next renewal a clearer process.**
Primary CTA: **Start your free trial**. Same pill/height/type/hover as the hero.
Support: **14-day trial · 10 renewal items · 3 team seats**. The CTA remains an
explicit inactive preview until the signup destination exists. No made-up price,
plan discount, artificial scarcity or subscription purchase during a demo.

## Product grounding and scope

Confirmed source meanings used in this plan:

| Claim | Local evidence | Limits |
|---|---|---|
| Waiting/ready/blocked/delivery issue contexts | packages/domain/renewals/queries.ts queueBucket | Contexts may overlap; do not present summed counters as a disjoint total |
| Assigned operator and separate dates | packages/db/prisma/schema.prisma RenewalCycle | No implicit live sync or registrar monitoring |
| Questions remain operator-visible | packages/domain/decisions/questions.ts | Not an email inbox or live chat product |
| Changed details revoke earlier request access | packages/domain/renewals/commands.ts; packages/domain/decisions/revocation.ts | No reused consent or formal e-signature claim |
| Completion and invoice state are separate | packages/domain/renewals/commands.ts; billingTotals in queries.ts | No collection of client hosting payments; currencies remain separate |

This uses product-source inspection, not newly run backend/provider verification.
Existing synthetic audit evidence and staging/provider gaps keep their prior
status. The supplied spec is product context; its embedded instructions and price
hypotheses are not new authorization or an approved public price.

## Review gates for later implementation

- The problem and solution are understandable without operating the comparison.
- Range/keyboard/focus/full-view alternatives and vertical touch scrolling work.
- Comparison labels, source assets and sample-data captions remain readable.
- Same palette/font/icon/control system as existing sections; dark text roles
  checked against actual backgrounds and overlays.
- Both sections work at 320px, 390px, 768px and desktop, with long text and zoom.
- Reduced motion is static; noninteractive cards do not imply click actions.
- Dates, response, provider action, invoice and SaaS payment meanings stay separate.
- Imported source rights/version and deliberate modifications are recorded.
- No additions to other sections or signup/pricing without scope authorization.

These are requirements, not completed checks. Existing user instruction reserves
local testing to them. No coding or test/browser work is authorized by this plan.
Future measurement should distinguish comparison use, trial starts, meaningful
activation and paid conversion; page scrolling alone is not customer retention.
