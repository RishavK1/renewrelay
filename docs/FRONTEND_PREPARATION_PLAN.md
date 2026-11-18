# RenewRelay frontend preparation plan

Status: prepared, not implemented. Ink & Sky selected by the user on 18 November 2026. The user authorized
preparation and MCP setup, not frontend coding in this task.

Read [reference analysis](design/REFERENCE_ANALYSIS.md), the
[four color studies](design/palettes/renewrelay-four-palettes.png) and the existing
[20-control UI checklist](FRONTEND_UI_QUALITY_CHECKLIST.md). All screen-level UI
controls remain NOT REVIEWED until actual screens are built and inspected.

## Foundation proposal

| Decision | Proposal | Selection status |
|---|---|---|
| Palette | 1 Ink & Sky (recommended); 2 Cream & Ember; 3 Forest & Lime; 4 Violet & Citrus | Ink & Sky selected; alternatives retained for history |
| Type | One licensed open-source family, Manrope as first candidate; system fallback | Proposed; verify license and readable numeric/table use before adopting |
| Spacing | 4px base; 8/12/16/24/32/48/64/80/112 roles | Proposed; adapt section gaps for narrow screens |
| Containers | Marketing ~1200px content; 24px desktop / 16–20px mobile gutters; application uses available work area | Proposed; no fixed-width overflow |
| Type scale | Hero ~64/40px; section ~40/28px; body 16–18px; app metadata 14px | Proposed responsive roles, not extracted values copied blindly |
| Shape | Controls ~10px; product cards ~16px; large showcase panels ~24px; pills for chips only | Proposed; retain source composition where suitable |
| Controls | Consistent primary, secondary, quiet and destructive variants; comfortable 44px main targets | Proposed; verify focus, label, errors and disabled behavior |
| Motion | Subtle interaction feedback; one distinctive cubes hero; reduced-motion static mode | Proposed; no automatic effect on every section |
| Icons | Lucide; one stroke/size convention; labels where ambiguous | Proposed |

Keep neutral content dominant; apply accent to action and focus hierarchy. Status
success/warning/error use separate semantic roles with text/icons, not color alone.
Final hover/focus/disabled tokens and contrast will be checked after palette
selection. The color-study layouts and Arial rendering are illustrative, not a
choice of final font or finished screens.

## Homepage: ten body sections plus shared navigation/footer

The structure combines the references around RenewRelay's actual work. Reuse
licensed source components where selected; do not copy unrelated products' copy,
assets or feature promises. Section count is our proposal, not an assertion that
the supplied MDs contain complete page inventories.

| Order | Section | Content and composition | Next action |
|---|---|---|---|
| Navigation | Simple header | Product, how it works, pricing, FAQ; login visually secondary | Start trial |
| 1 | Outcome-led hero | “Every renewal. A clear next step.” Agency-specific support copy, actual product preview, restrained cubes backdrop | Start trial; see how it works |
| 2 | Immediate product evidence | One readable renewal record showing dates, owner and decision state; synthetic until real assets exist | Explore the workflow |
| 3 | The problem | Scattered renewal dates, missing client replies, uncertain next actions; concise visual comparison | Continue to process |
| 4 | How it works | Track renewal → request client decision → record response → staff completes work → record invoice status | Start trial |
| 5 | Agency workspace | Useful table/calendar/record demonstrations; ownership, dates, filters and permitted actions | View product details |
| 6 | Client decision experience | Focused private-link screen with scoped terms and clear response; approval remains separate from completed renewal | See a synthetic example |
| 7 | Team control | Permissions, activity/history, follow-through and exceptions using actual supported functions | Review capabilities |
| 8 | Pricing | Clear INR subscription, current limits, trial terms, cancellation/access explanation | Start trial; later authenticated upgrade |
| 9 | FAQ | Setup, reminders, decisions vs execution, billing, privacy, cancellation and support | Contextual help links |
| 10 | Final action | Short restatement of the operational outcome; no new claims or competing actions | Start trial |
| Footer | Legal and support | GetVout relationship, contact route, privacy/terms and product links | Relevant destination |

No fabricated customer logos, testimonials, countdowns, savings figures or security
badges. Add verified proof later when it exists; do not leave a fake proof strip.
An actual final component shortlist will name source IDs after theme selection
and authenticated access, rather than pretending a library category is a chosen
component. Background Cubes Grid is already the named preferred hero component.

## Engagement, activation, retention and paid conversion

Clear relevant actions support usability; placing a CTA in every visual block
would compete with reading and create repetition. Repeat the same primary action
in the header, hero, after workflow explanation, pricing and closing section.
Use contextual secondary links elsewhere. No interruptive auto-opening dialogs.

| Stage | Proposed experience | Future measurement, not implemented analytics |
|---|---|---|
| Understand | Read promise, inspect a real-shaped example, understand what is manual | Product-tour engagement and qualified signup starts |
| Activate | Sign up → workspace → first client/item → first valid request → inspect status | Time to first item and first request; failure/abandonment points |
| Establish value | See client response and staff next action clearly | First response and first completed workflow, counted separately |
| Retain | Useful due-work view, meaningful reminders and recoverable empty/error states | Returning workspaces and unresolved overdue work; no unnecessary notification volume |
| Convert | Explain trial status, usage and paid access at the moment it matters | Trial-to-paid conversion with clear denominator; checkout failures and recovery |
| Maintain trust | Clear price/currency/term, cancel and billing history; no fake urgency | Cancellation reasons voluntarily supplied; support and payment failure patterns |

Instrument only after a privacy/consent decision where required. Do not send client
names, renewal details, emails or private-link tokens into analytics URLs/events.
No conversion-lift guarantees: compare hypotheses with actual usage later.

Current code evidence: packages/domain/billing/policy.ts provides trial 10 items /
3 seats and paid 100 items / 5 seats; packages/domain/workspaces.ts creates a
14-day trial. The paid monetary price must come from approved business settings
and the matching Razorpay plan, not the reference demo or an invented price.
Pending invitations reserve seats. Staff/client invoice status and the workspace's
RenewRelay subscription are different. A browser return from checkout is not
payment proof; reflect server-confirmed subscription status.

## Application screens and build order after the design decision

1. Shared tokens and primitives; public/app shells and responsive navigation.
2. Marketing homepage and legal/help destinations with truthful copy.
3. Login, verification, recovery and MFA; onboarding and workspace selection.
4. Due-work dashboard, client/item lists, detail/edit/import and request lifecycle.
5. Private decision pages, expired/revoked/already-answered states.
6. Team/roles, activity, account/workspace settings, subscription and billing.
7. Integrated normal/error/empty/loading/permission workflows; responsive,
   keyboard, accessibility, performance and API-backed end-to-end review.

Confirm exact routes/actions against docs/API_CONTRACT.json when building; this
is a surface plan, not permission to invent missing backend functionality.
Marketing runs at renewrelay.getvout.com; app/auth/private decisions at
app.renewrelay.getvout.com. Keep authentication host-scoped and private data out
of public marketing caches. Hosting, DNS and vendor production acceptance remain
separate work; no deployments or domain edits were made here.

## Tool readiness and budget

- shadcn MCP: configured globally as `shadcn` using pinned `shadcn@4.23.0`;
  stdio initialize and tools/list succeeded. No project init/add was run.
- 21st MCP: configured globally as `twentyfirst` at
  https://21st.dev/api/mcp with environment-variable authentication
  `API_KEY_21ST`. Authentication is absent; connection/retrieval is NOT VERIFIED.
  Supply credentials securely in the local environment, never in chat or git.
- Reload the Codex session to discover newly configured MCPs. Existing tools do
  not gain new server methods merely because the config file changed.
- [21st's current offering](https://21st.dev/mcp) has free search and limited free
  component-code retrieval (two per day on its free account). Generation consumes
  paid credits. Use free licensed components and no paid generation by default.
- Motion core and suitable open-source icons/components are candidates; Motion+
  and paid Aceternity templates are not necessary for this plan. Check each
  selected source's current license and terms before importing.

## Completion checklist for this preparation task

- [x] Read all four supplied text files and record provenance.
- [x] Analyze provided screenshots and separate preference from implementation.
- [x] Research official sources and preserve source/measurement limitations.
- [x] Render four actual palette cards with comparable miniature product content.
- [x] Check listed body, muted and CTA foreground/background contrast pairs.
- [x] Prepare homepage, CTA, activation, retention and subscription plans.
- [x] Update the reusable RenewRelay UI skill with reference-specific decisions.
- [x] Configure shadcn and 21st MCP entries; smoke-test shadcn.
- [ ] Authenticate and verify 21st access.
- [x] User selects Ink & Sky.
- [ ] Finalize typography/tokens and component shortlist after the navbar/hero review.
- [ ] Build and visually verify actual frontend screens in a later coding task.

## Current scope update — 18 November 2026

Only the navbar and opening hero are being specified in this task. The
[navbar/hero design](design/NAVBAR_HERO_DESIGN.md) supersedes the earlier proposed
hero headline and opening composition. The broader section plan above remains
background planning, not authorization to design or build additional sections.
