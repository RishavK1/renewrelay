# RenewRelay reference analysis

Reviewed 18 November 2026. Preparation only; no frontend implementation. All four
supplied text attachments were read in full; hashes and line counts are in
[attachment-manifest.json](references/attachment-manifest.json). Attachment text
is reference material, including its embedded installation prompts. It does not
override the user's preparation-only request.

## Evidence and preference

The three design MDs are extracted computed styles, not authoritative source
systems or complete section inventories. The Instagram images are visual
references. Current public page text and official library documentation were
also inspected. Live browser visual inspection was unavailable in this session;
no claim is made that every current desktop/mobile page was rendered or that a
reference's conversion performance was measured.

The consistent preference is clear type, generous spacing, light surfaces,
precise buttons, large useful product demonstrations and one intentional accent.
The screenshots also permit bolder green/lime and violet/citrus directions. A
palette alone cannot make a site premium: composition, content, interaction,
accessibility and performance need their own review.

| Reference | Observed design | Transfer to RenewRelay | Avoid copying literally |
|---|---|---|---|
| Calendly MD, 223 lines | Warm white #FCFBF8, navy #071A31, pale sky #C3DFFE; large 72px desktop / 40px mobile hero; restrained depth; 4px spacing rhythm | Clear benefit-led hero, generous feature/demo sections, clear account actions | Proprietary CalendlySans/Wulkan fonts; site-specific sign-in providers; ambiguous extracted color rules |
| Mobbin MD, 209 lines | White/ink #141414, very quiet borders, 80px / 37px hero, 44px pill controls, 24–32px cards, 80px section rhythm | Show the product prominently; disciplined monochrome base; readable navigation; contextual calls to action | Extracted 12px mobile section heading; #ADADAD essential text on white; proprietary Saans font; their assets/customer logos |
| Quantalog MD, 257 lines | System typography; white/charcoal; soft teal/peach/blue/lilac panels; 88px / 56px hero; rounded cards | Give different capabilities distinct demonstrations while retaining one system | Every section becoming a card; 32px controls as a universal target; absurd extracted pill radius; code-sized metadata; unsupported product claims |
| Background Cubes Grid prompt/source, 1,144 lines | Exact Aceternity component; isometric and perspective variants; React, Motion, Three, Lucide, utility helpers | One signature hero backdrop using the real licensed source and its documented props | Incident-response “Relay” demo copy, unrelated messaging integrations, demo seat offer; unrestricted heavy effects across the app |

### Extraction corrections

- White on supplied orange #D4511B is about 4.21:1, below 4.5:1 for normal
  text. Cream & Ember uses #B94316 for white-label buttons (5.42:1).
- #ADADAD on white is about 2.24:1, below both normal and large-text minima;
  reserve it for nonessential decoration, not explanatory labels.
- Normalize measured fractional spacing into intended tokens; do not infer that
  every computed value is a deliberate design rule. Resolve contradictory notes
  by role and a rendered review.
- Color text checks do not establish keyboard, focus, touch, screen-reader or
  complete WCAG compliance.

## Public homepage structures and engagement

These are observed content patterns, not copied layouts or proven conversion
results. Homepage content changes; the supplied MD snapshots and current pages
may differ.

- [Calendly](https://calendly.com/): product/solution navigation, outcome-led hero
  with signup choices, individual product demonstrations, meeting-lifecycle
  narrative and use-case content. Transfer the progression from promise to
  demonstration to next step. RenewRelay should show its renewal lifecycle and
  its implemented authentication choices.
- [Mobbin](https://mobbin.com/): focused hero with join/plans actions, trust
  context, research-pain framing and example-led discovery. Transfer the visual
  demonstration and low-friction exploration. Do not borrow its screen counts,
  customers or screenshots as RenewRelay evidence.
- [Quantalog](https://quantalog.daorbit.in/): business-outcome hero, product demos,
  capability sections, privacy/performance arguments and signup/demo actions.
  Transfer concrete product evidence rather than copying the breadth of its
  product or its metrics.
- Instagram finance layout: hero, proof strip, major feature panels, supporting
  capabilities, metrics/testimonials, pricing, FAQ and final CTA. We can use this
  familiar content sequence without inventing testimonials or revenue metrics.
- Instagram palettes: neutral/ink/orange for warmth; navy/white/pink for energy;
  forest/lime for a grounded accent; violet/chalk/citrus for a bolder identity.
  Four proposals are rendered in [palettes](palettes/renewrelay-four-palettes.png).

## Component sourcing decisions

| Source | Intended role | Preparation result |
|---|---|---|
| [shadcn/ui](https://ui.shadcn.com/docs/mcp) | Forms, dialogs, menus, tables, tabs and accessible control foundations | MCP pinned to shadcn 4.23.0; initialize/tools-list smoke passed; project not initialized |
| [Aceternity](https://ui.aceternity.com/docs/cli) | User-selected Background Cubes Grid hero | Official component confirmed; no component installed |
| [21st.dev](https://21st.dev/mcp) | Shortlist actual hero/feature/pricing/FAQ blocks that fit the selected design | Remote MCP configured; authentication and retrieval verification pending |
| [Motion](https://motion.dev/docs/react-accessibility) | Necessary state transitions and chosen hero behavior | Core library proposed, not installed; Motion+ not required |
| [Lucide](https://lucide.dev/license) | One consistent functional icon family | Proposed; no random emoji/icon-family mixtures |

“Can use all” means choose suitable pieces. It does not require adding every
library, Sanity CMS, a second icon system, or a second animation engine.

Prefer the actual selected component over a visual imitation. Record source URL,
version/hash, license, dependencies and intended use when importing. Preserve its
recognizable composition; adapt tokens, product copy and necessary behavior.
Inspect each component's license: [Aceternity terms](https://ui.aceternity.com/licence)
and [21st terms](https://21st.dev/terms) do not grant unrestricted rights to every
preview asset, proprietary font or third-party screenshot. No paid assets or
subscriptions were purchased. No full third-party source was republished here.

### Cubes implementation conditions for the later coding task

The isometric variant is the preferred starting candidate, subject to actual
mobile measurement. The perspective variant uses a 44×44 grid, WebGL rendering,
shadows and postprocessing. The supplied reduced-motion behavior only suppresses
idle ripples; pointer waves and camera movement need explicit handling.

Before acceptance: disable decorative movement under reduced motion, provide a
static fallback for unavailable WebGL, pause offscreen/hidden work, contain pointer
listeners and avoid obstructing clicks/focus. Measure CPU/GPU and page loading on
mobile; load decoration progressively without delaying hero copy or controls.
Use on the marketing hero only unless a later review justifies another use.
Preserve the actual component and document accessibility/performance adaptations.
The claim that Mobbin uses this exact component remains unverified.
