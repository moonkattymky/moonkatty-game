# Chapter 1 lunar expedition prototype — 10 October 2026

Base: main 40d89a9, including the previously confirmed published 3521323 and the later account/replay callback fix in PR58. This is a working first-chapter **surface mission** prototype, not a redesign of every chapter, board, flight or legacy Life 1 controller. The original character identity remains. The existing production equipment props, footprints, conduits, 94×94 SVG hit targets and canonical FieldRules positions are retained.

## Presentation

- New 1024px WebP lunar ground with consistent white/gold station lighting.
- A transparent 1024×341 four-frame astronaut cat walk sheet, horizontal facing and existing eased tile movement. The renderer derives animation from the last displayed position; it never writes the gameplay state. Reduced-motion preference skips the animation.
- Navy/gold telemetry and a compact scanner. Movement remains the existing adjacent-tile tap action; no new control handler.
- Actual neighboring legal moves retain the reviewed corner feedback. Fractures, power sources and airlock remain linked to the rules.
- HTML controls stay at least 44px; text stays at least 11px. The existing completion action and concise control reminder remain; the expandable guide is available.
- Artwork loads when the first surface mission renders, not on the home screen. A combined equipment/walk atlas plus ground uses exactly two shared images, 846848 bytes total, below the original 850000-byte scene budget. New ground replaces the previous ground in this scope. The separate walk sheet is editable source, not a third loaded texture.

## Compatibility

No server deployment, save migration, reward changes or level geometry changes. The existing client-only release recovery, trace transport, crew workshop and server compatibility remain. The renderer adapter is restricted to chapter 1, mechanic 1, non-daily missions. `field-missions.js`, every model, server file and existing test are byte-identical to main 40d89a9. Other uses of mechanic 1 retain the existing renderer. Equipment and hit targets reuse `lunarWorksite`; there is no second independent level map. Shared-file edits are limited to the `field-art.js` rendering hook and the `index.html` asset includes/cache version; there are no changes in controller or state management files.

## Evidence

`docs/lunar-preview/chapter1-playable.png` and `chapter1-small-phone.png` are genuine rendered screenshots from the local game, not generated interface mockups. Fixtures run without a real user account or reward writes.

`tests/lunar-expedition-ui.cjs` exercises Russian, English and Arabic in four viewports (390×844, 320×568, 430×932, 568×320), verifies visible unobstructed 44px controls, taps in all four directions against FieldRules, scanner, canonical completion and absence of browser exceptions. `tests/field-ui.cjs` checks all nine field missions, pause/reload and eight additional variants. `tests/a11y-floor.cjs` checks 141 screens.

The unchanged review capture pipeline rendered 74 real before/after screenshots with 12687 checks and no failures. It verifies the two-texture scene, 16 independently clipped sprites, eight grounded modules, all 36 exact cell targets, portrait cell size, text bounds and scanner hit testing. Expanded instructions may scroll on a small screen; the closed guide and essential controls fit in the 320×568 portrait viewport.

Physical Telegram iPhone/Android validation is still required. This is an initial implementation of the visual direction, not pixel-identical fidelity to the cinematic concept, free-roaming 3D, or a completed nine-chapter redesign.
