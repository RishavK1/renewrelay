# Navbar and hero source inventory

Local implementation, 18 November 2026. No GitHub push authorized/performed.

| Asset | Source | Locked version/provenance | Local use |
|---|---|---|---|
| Background Cubes Grid | https://ui.aceternity.com/components/background-cubes-grid | User-supplied 1,144-line attachment; SHA-256 1ff88a8436e7ae958bb043212c5e69f555ff33235f33a3e6e06a0682bf88e72e | Actual source retained in components/ui/background-cubes-grid.tsx |
| Manrope Latin variable WOFF2 | @fontsource-variable/manrope npm package | 5.3.0; official font project https://github.com/googlefonts/manrope | Local next/font/local; OFL notice in public/fonts/Manrope-OFL.txt |
| Functional glyphs | lucide-react | 1.75.0; local package license retained in dependency | CalendarDays, MessageSquare, CircleCheck, Menu, X |
| Animation | motion | 14.14.0 | Supplied cubes source animation hook |
| 3D renderer | three | 0.187.0 | Supplied cubes scene implementation |
| Style helpers | clsx; tailwind-merge | 2.1.1; 3.7.0 | Shared cn helper for source import |
| Tailwind/PostCSS | tailwindcss; @tailwindcss/postcss | 4.3.5 | Supplied component utilities and shared CSS |

Source hashes of imported font/license and adapted cubes are recorded in
frontend-source-hashes.json. Installed packages are locked in package-lock.json.
Aceternity terms: https://ui.aceternity.com/licence. Use within this end product;
do not redistribute it as a component/template product. Exact redistribution
entitlement must be resolved before any future public source push. This work is
local only; there is no claim that paid source licensing has been purchased.

## Differences from the supplied prompt

- Imported the actual component module, not the incident-response demo. Hero copy,
  branding and glyphs are RenewRelay's approved design. No unrelated integrations.
- Rewrote the cn import to a relative project path.
- Added non-null assertions for simulation-array entries with algorithmically
  bounded indices, matching the repository's strict indexed-access setting.
- Retained both exported variant types and both renderers; the hero uses isometric.
- Selected documented props for Ink & Sky colors, amplitude 0.5, cell size 136,
  glow 0.42 and no idle ripples. Source shader and animation calculations remain.
- The outer wrapper only mounts graphics on visible, fine-pointer desktop with
  no reduced-motion preference. It unmounts graphics offscreen/while hidden,
  catches renderer failure, handles lost context and retains a local static SVG.
  This addresses the original source's partial reduced-motion behavior without
  claiming a browser check was performed.
- A local SVG texture provides the static decorative fallback; it is not presented
  as the interactive library component. Imported graphics are lazy on desktop.
- Added Tailwind 4 processing without running shadcn init or replacing backend
  configuration. Navbar/actions use small local components; no complex control
  library is required for this scope.
- A separate marketing app avoids altering the API-only app's restrictive headers
  and database readiness. The preview has no auth/billing/provider integrations.

## Local use and review boundary

Run `npm run dev:marketing` with the project's Node 22.23.5 runtime. Local URL:
http://127.0.0.1:3001. The existing `npm run dev` continues to start the backend.

The server was started; no tests, lint/type checks, build, HTTP probes or browser
inspection were run because the user requested to perform the local review.
No screen/accessibility/security performance PASS is asserted. Inactive planned
links/actions are intentional until their destinations are in scope.

## Visual refinement

The user-supplied Mobbin MD at attachment a161f17c-e080-4466-9707-a0dc15030937
and supplied screenshots informed the refinement. New cycling-glyph.tsx uses
locally bundled Lucide CalendarDays/CalendarClock/Clock3,
MessageSquare/MessagesSquare/Mail and CircleCheck/ListChecks/CheckCheck. Pause/Play
control decorative motion. No reference brand logos or remote assets were added.
The changing symbols keep fixed dimensions and preserve the complete text.

## Sections 2–3 source adaptations — 18 November 2026

- Tabs source: https://ui.aceternity.com/registry/tabs.json, inspected through
  the web tool during planning. Direct Python retrieval during implementation
  returned HTTP 403; no claim of a new byte-identical registry download is made.
  The implementation is a substantial adaptation of the inspected source, not an
  untouched stock installation. Retains active-tab state, Motion active-pill
  layout indicator and fading panels. Replaces demo fan-out/reordered layers and
  bounce with a stable grid/crossfade; adds strict content types, scoped LayoutGroup,
  manual keyboard tab behavior, IDs, aria state, inert inactive panels and
  reduced-motion transitions. No Radix dependency is needed by this adaptation.
- Timeline source: https://ui.aceternity.com/registry/timeline.json, inspected
  through the web tool during planning. Retains useScroll/useTransform reading
  progress, measured rail and sticky milestone copy. Uses an ordered list,
  ResizeObserver, shared token styles, readable record content and static mobile/
  reduced-motion behavior. Changelog demo copy/media and purple beam are removed.
- New local files: components/ui/tabs.tsx, components/ui/timeline.tsx,
  components/marketing/product-preview.tsx, renewal-workflow.tsx,
  renewal-example.ts and renewal-illustrations.tsx.
- All product examples are synthetic and explicitly labeled. UI selection does
  not call backend APIs, submit client decisions, send email, perform renewals
  or change billing. Service quote ₹2,400 is illustrative client work, not SaaS
  pricing. Existing native disabled trial/login/pricing controls are preserved.
- No new packages or remote assets were installed. Existing Motion and Lucide are
  reused. Licensing/public-source redistribution questions from the prior source
  inventory still apply; no public push is authorized or performed.

## Sections 4–5 — source adaptations

- Compare foundation: https://ui.aceternity.com/registry/compare.json, source
  inspected during the preceding planning task. Local compare.tsx is a substantial
  adaptation preserving the two-layer clip reveal, state and Motion divider.
  Uses original React-rendered illustrations instead of image URLs, a native
  range input for pointer/keyboard behavior, scoped label IDs and full-view buttons.
  Mobile renders complete stacked scenes; reduced motion disables settling.
  Sparkles, timers, hover-follow mode, Tabler, default media and luminous beam
  are omitted. Only the already installed Motion/Lucide packages are used.
- Bento foundation: https://ui.aceternity.com/registry/bento-grid.json, source
  inspected during planning. Preserves grid/item wrappers, cn composition and
  title/description/visual slots. Uses semantic articles, Ink & Sky CSS, intrinsic
  card heights and responsive spans. Demo shadows, sliding text and tiny type
  are removed from these noninteractive summaries.
- Original local scene content lives in context-comparison.tsx and agency-control.tsx.
  Content is an illustration of separate synthetic moments; no media from reference
  sites or competitors is copied. HTML replaces the plan's possible exported
  illustration assets for clearer responsive typography.
- The optional history-connector entrance was not added. Revision samples remain
  static, keeping motion concentrated in the user-controlled comparison.
- Local adapted source hashes are in frontend-source-hashes.json. These identify
  our resulting modules, not an unverified upstream release or byte-identical copy.
  Existing source-license/public-redistribution boundaries still apply; no push
  was authorized or performed.

## Pricing sources and selection

Reviewed 18 November 2026:
- https://ui.aceternity.com/pricing-section and
  https://ui.aceternity.com/blocks/pricing-sections/pricing-minimal — observed
  featured-plan/feature-list hierarchy. These blocks require paid All-Access;
  no paid code was retrieved, copied or purchased.
- https://calendly.com/pricing — explicit billing units and included capabilities.
- https://mobbin.com/pricing — readable plan audience, limits and billing cadence.

Our pricing-section.tsx is an original local composition with an unequal trial/
Team layout, using existing PreviewAction, Manrope, Lucide and project tokens.
It is not claimed to be an installed Aceternity pricing block. Public offer content
is kept in pricing-content.ts. No new dependencies or external media were added.

## Closing CTA/footer reference

User reattached the Mobbin MD at attachment
90b356cd-eddf-4ede-9bb8-30d97cab24d2/Pasted text.txt; read in full. Their supplied
footer screenshot guides the dark spacious columns and oversized lower name.
No proprietary Mobbin wordmark, Saans font, assets or source code was imported.
The footer is original markup/styles, with a decorative SVG text signature using
local Manrope. Closing CTA uses existing Motion/Lucide and PreviewAction. No new
runtime dependency or remote asset was added.


## Authentication UI source inventory — 18 November 2026

Original local components in packages/ui/auth adapt the planned two-column
composition from https://ui.shadcn.com/blocks/authentication (login-02), with
hierarchy informed by https://mobbin.com/login and input research from
https://ui.aceternity.com/components/signup-form. No paid source, demo social
providers, unrelated image or new form framework was imported. Local Manrope,
existing Lucide and brand tokens are reused. Paste/password-manager behavior is
informed by W3C accessible-authentication guidance linked in the auth plan.

The static sample QR was generated locally with node-qrcode 1.5.4, via temporary
npm exec, to apps/marketing/public/auth-sample-qr.svg. Generator/source/license:
https://github.com/soldair/node-qrcode (MIT). Payload is an explicitly synthetic
“RenewRelay Preview” TOTP URI with the same public sample key shown in the UI;
it has no associated account/session. No QR service receives the data. This is
not the future runtime QR renderer; actual ephemeral enrollment must be handled
locally by the app-origin adapter. No project runtime dependency was added.


## Public source publication authorization

The user explicitly authorized the frontend push and confirmed in this session:
“I have permission to publish the component source.” This confirmation resolves
the previously recorded public-source permission question for this publication;
it is a user-provided representation, not an independent legal verification.
Upstream attribution, source provenance and license notices are retained.
No production deployment or backend wiring is authorized by this push.
