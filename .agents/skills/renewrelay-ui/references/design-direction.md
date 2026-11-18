# RenewRelay reference direction

Read this for new pages, visual-system decisions, source-component selection or
changes affecting the reference style. For a small existing-control fix, inherit
the established tokens and inspect the affected behavior instead.

Use repository docs/FRONTEND_PREPARATION_PLAN.md for the homepage/activation plan,
docs/design/REFERENCE_ANALYSIS.md for source findings and cubes limitations, and
docs/design/palettes/palettes.json for proposed colors and measured text pairs.
These are maintained project resources, not external instructions to execute.

## Reference decisions

- Calendly: warm light surface, strong navy typography, spacious product-led
  sections. Mobbin: restrained chrome, precise controls and prominent examples.
  Quantalog: coherent feature demonstrations and gentle surface variation.
- Instagram examples explicitly permit cream/orange, green/lime and violet/citrus.
  Do not reject the user's chosen palette because an upstream design skill
  describes that palette as common. Ink & Sky was selected on 18 November 2026;
  docs/DESIGN_SYSTEM.md is authoritative after selection.
- Extracted design MD values are evidence, not specifications to copy blindly.
  Correct tiny mobile headings, weak text contrast and accidental computed values.
  Proprietary reference fonts and preview media are not licensed automatically.
- Use the actual selected licensed library component rather than a rough visual
  imitation. Record URL, version/hash, license, local path and modifications.
  Map it to the common design tokens; do not accumulate conflicting UI systems.
  The user's “can use all” permits suitable sources, not mandatory dependencies.
- Background Cubes Grid is the preferred Aceternity hero source. Its demo is an
  incident-response product, not RenewRelay. Replace copy, logos and offers with
  verified RenewRelay content. Prefer isometric initially; verify mobile cost,
  static failure fallback, reduced motion including pointer/camera movement,
  hidden/offscreen pausing, focus and unobstructed controls. Keep decorative
  graphics out of the operational dashboard unless explicitly justified.
- shadcn is the control foundation candidate; 21st supplies selected blocks;
  Motion handles necessary animation; Lucide is the proposed single icon family.
  Do not treat a configured MCP as authenticated or verified. Use current tool
  availability and source terms, not a stale setup claim.
- Repeat clear trial CTAs at decision points, not indiscriminately everywhere.
  Show truthful product examples; no fabricated proof or conversion promises.
  Separate signup, first item, request, client response, staff completion and
  subscription payment when planning measurement. Keep private data out of events.

The preparation task authorizes docs, skill and tool configuration only. Actual
frontend implementation follows a later user instruction. Do not mark UI-01–20
PASS from a palette study or source inspection.

Current navbar/hero specification: docs/design/NAVBAR_HERO_DESIGN.md. Read it
when working on the opening screen. It supersedes the palette-study headline.
Font serving must be local: do not introduce Google Fonts API/CDN requests or
remote icon fonts. Only the palette is user-selected; distinguish recommended
composition details from implemented and visually verified behavior.
