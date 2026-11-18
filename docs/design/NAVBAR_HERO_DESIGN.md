# RenewRelay navbar and hero design

18 November 2026. Scope: navbar and opening hero only. Ink & Sky is selected by
the user. The copy, composition and sizing below are the design recommendation
for review; no frontend code, packages, fonts or icons have been installed.
No other section is designed or authorized for implementation in this task.

## Direction

Use the supplied Mobbin screenshot's centered typographic composition: a quiet
header, a large multi-line message, compact inline visual cues, short supporting
copy and two clear actions. Carry Calendly's warm light surface, deep navy,
precise spacing and restrained depth into that composition. The signature texture
is the actual Aceternity cubes component, confined to the hero background.

The reattached Calendly and cubes files have the same SHA-256 hashes as the prior
attachments in references/attachment-manifest.json. Their installation commands
remain reference instructions; the user's current no-coding instruction governs.

## Exact opening copy

Headline, read as one accessible heading:

> Track client renewals.
> Get clear decisions.
> Keep work moving.

Support:

> For web agencies managing domains, hosting and ongoing services. Track renewal
> dates, collect client decisions and keep your team’s next steps in one place.

Primary action: **Start your free trial**.
Secondary action: **See plans**.
Support note: **14-day trial · 10 renewal items · 3 team seats**.

The headline identifies the task, the client-decision workflow and team
follow-through. The support sentence identifies the audience and service types.
It does not promise automatic supplier renewals, automatic payments, guaranteed
savings or that client approval completes the work. The previous palette-study
headline is superseded for this hero. Trial note matches current backend policy;
confirm again before launch. Do not add “free forever” or an unverified card claim.

## Desktop navbar

| Element | Design decision |
|---|---|
| Container | 1200px maximum; centered; 24px minimum outer gutters |
| Height | 88px, no floating capsule or detached glass panel |
| Brand, left | Text wordmark “RenewRelay”, Manrope 24px/700, solid ink; no unapproved symbol/logo |
| Main links | Product, How it works, Pricing; 16px/500; 28px gaps; no dropdown chevrons without dropdowns |
| Account actions, right | Log in as a quiet text action; Start free trial as ink-filled button |
| Alignment | Brand, links and actions share one vertical center; brand and right action align to container edges |
| Background | Same snow surface as page; static header at this stage; no changing size or shadow on scroll |
| Links | Brand → marketing root; Product/How it works/Pricing → eventual corresponding marketing destinations; Log in/trial → app origin |

Link labels and intended destinations are decided, but final route/anchor names
must match implemented destinations. A later navbar/hero-only preview must omit
unavailable destinations rather than ship clickable dead links or invent other
sections. No social icons, search field, announcement badge or mega-menu is needed
in this opening design.

Mobile: 72px header; 20px gutters (16px at 320px); 20px wordmark; a quiet Log in
link plus a 44px Menu icon control. Trial action is visible in the hero and again
inside the menu. Below 768px, links move into a full-width panel below the header;
Menu changes to Close, expanded state is exposed, Escape closes and focus returns
to the trigger. Normal document flow, no hover-only navigation or focus trap.
At 200% text enlargement, permit earlier collapse and growth rather than clipping.

## Hero composition and measurements

```text
RenewRelay       Product   How it works   Pricing       Log in  [Start free trial]

                         Track client renewals. [calendar]
                          Get clear decisions. [message]
                            Keep work moving. [check]

                    For web agencies managing domains, hosting
                     and ongoing services. Track renewal dates,
                     collect client decisions and keep your
                         team’s next steps in one place.

                      [Start your free trial]  [See plans]
                      14-day trial · 10 renewal items · 3 team seats

                Quiet sky-toned cubes near the sides and lower edge
```

This is a composition diagram, not a rendered screen or a measured result.

| Role | Desktop target | Mobile target |
|---|---|---|
| Hero top space after navbar | 88px at 1440×900; reduce to 56px on short screens | 48px |
| Heading | Manrope 80px/1.06, weight 650, tracking -0.025em; width up to 1040px | 40px/1.10, weight 650; 36px near 320px; tracking -0.02em |
| Heading wrapping | Three intentional phrases; one per line where actual font metrics permit | Natural wrapping, about 4–5 lines; no forced desktop line widths |
| Inline glyph chips | Up to three, 56px tonal squares, 16px corners; 28px glyphs | Omit the decorative chips to prioritize reading and reduce wrapping |
| Supporting copy | 20px/1.5, weight 400; max 660px; 28px below heading | 17px/1.5; full readable width; 24px below heading |
| CTA group | 28px below support; 12px between controls; 52px controls | 24px gap; controls stack full-width below 480px; minimum 48px tall |
| Trial note | 14px/1.5, muted; 16px below actions | 14px/1.5; wrapping allowed |
| Hero bottom space | 80px; content determines height | 56px; no fixed viewport height |

Use one semantic H1. Decorative glyphs never replace words or become part of its
accessible name. No rotating words, letter-by-letter reveal or all-caps eyebrow.
At 1440×900 the headline, explanation and CTA group should be visible together;
this is an implementation acceptance target, not a current verification claim.
At shorter viewports and zoom, normal scrolling is preferable to shrinking text.
Do not add a dashboard card, proof strip or additional section in this task.

## Ink & Sky roles for this scope

| Role | Value | Use |
|---|---|---|
| Snow | #FCFBF8 | Navbar and hero canvas |
| Ink | #071A31 | Heading, wordmark, links and primary button fill |
| Sky | #C3DFFE | Meaningful decorative chips and quiet backdrop accents |
| White | #FFFFFF | Secondary button surface |
| Muted | #526171 | Supporting sentence and trial note |
| Border | #D8DFE5 | Decorative separation where necessary, not a focus indicator |
| Focus | #071A31 with snow offset | 2px visible outline, 3px offset; visible on both button variants |

Primary: snow text on ink; 16px/600, 14px corner radius, 24px horizontal padding;
hover ink #102C48, pressed ink #061426. Navbar primary is the same variant at
44px height and 20px horizontal padding. Secondary: ink text on white, thin border,
hover #EDF4FB, same radius and hero height. Hover changes color, not position,
scale or the words' baseline. Do not rely on the faint border to identify an
otherwise unlabeled control; secondary has a visible text label and fill.

## Font and icon provenance

Use **Manrope**, served locally as WOFF2 with system-ui fallback. Source actual
files from the maintained font project or a reviewed pinned package; retain the
SIL OFL notice and record the exact version/hash at import. The maintained
[Manrope project](https://github.com/googlefonts/manrope) and
[license](https://github.com/google/fonts/blob/main/ofl/manrope/OFL.txt) were checked.
Do not copy Calendly Sans, Wulkan or Mobbin's Saans from their websites.

Production checklist control 015 currently says “Self-host fonts where practical”
and is NOT APPLICABLE for the API-only build. The user now explicitly requires
local serving: no Google Fonts CSS/API, fonts.googleapis.com, fonts.gstatic.com,
remote CSS @imports, remote icon font or hotlinked media. Browser font loading
must stay on our own origin. The design choice is made; file selection, license
retention, font-display/fallback metrics and network verification await coding.

Use locally bundled **Lucide** SVG icons only: CalendarDays for renewal dates,
MessageSquare for client decisions, CircleCheck for follow-through, Menu/X for
mobile navigation. Consistent 2px stroke, no emoji, brand logos or icon-font CDN.
Inline hero icons are decorative; their meaning remains in the words. Menu/Close
are real controls with accessible names. Retain applicable notices from the
[Lucide license](https://lucide.dev/license). No arrow or play glyph is needed in
the hero CTAs because neither action plays a video.

## Cubes, texture, choreography and scrolling

Use the actual [Background Cubes Grid](https://ui.aceternity.com/components/background-cubes-grid),
starting with its isometric variant. Snow ground, subtle blue-gray edges and
sky highlights. Keep the central reading zone calm with a snow-colored mask;
let visible cube detail sit toward the outer/lower field. No grain overlay,
full-screen glow, dark gradient, rainbow icons or moving text. The cubes are the
single distinctive decorative feature. Exact amplitude/density must be tuned
against the actual component and device performance, not invented as proven props.

Navbar is immediately visible. On ordinary-motion desktop, one restrained
opacity entrance for hero content may last 240ms; do not hide critical copy until
JavaScript or animation finishes. All main content appears together, with no
staggered wait to see the CTA. Button feedback 160ms, menu transition 180ms.
Default recommendation: no continuous idle ripples; a small pointer response
only on capable desktop devices. Reduced-motion preference removes all decorative
movement, including pointer/camera movement. Mobile uses a static lightweight
representation/fallback rather than continuous WebGL work. Pause decorative work
when offscreen or the tab is hidden; failed rendering leaves content and actions
fully available. Decorative input listeners must not capture clicks or focus.

Use normal browser scrolling; no scroll hijacking, parallax text or pinned hero.
Any future in-page smooth scrolling respects reduced motion and keeps target
headings visible. Do not implement downstream sections merely to demonstrate it.
The supplied component's partial reduced-motion behavior needs documented
adaptation; its incident-alert demo copy/integration logos must not ship.

## Implementation review gates, not completed checks

- [ ] Readable real Manrope rendering at 1440×900, 1024px, 768px, 390px and 320px.
- [ ] Text enlargement/reflow without clipped heading, trial note or actions.
- [ ] Actual default/hover/focus text and indicator contrast verified.
- [ ] Keyboard menu, visible focus, Escape, link destinations and CTA semantics.
- [ ] No Google font/CDN requests; font license and imported asset hashes recorded.
- [ ] Real cubes source behavior: reduced motion, static fallback, mobile cost,
      hidden/offscreen pausing and no pointer/keyboard obstruction.
- [ ] Opening sentence understood as agency renewal/decision coordination; no
      implication that approval or our SaaS subscription performs supplier renewal.
- [ ] Rendered screenshots and UI-review evidence before any screen signoff.

Only the palette is user-approved. This design recommendation is reviewable;
frontend implementation and screen-level checks remain pending.
