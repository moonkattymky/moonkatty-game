# Chapter 1 lunar expedition prototype — 10 October 2026

Base: current reviewed main 3521323. This is a working first-chapter **surface mission** prototype, not a redesign of every chapter, board, flight or legacy Life 1 controller. The original character identity remains. The existing production equipment atlas, footprints, conduits, 94×94 SVG hit targets and canonical FieldRules positions are retained.

## Presentation

- New 1024px WebP lunar ground with consistent white/gold station lighting.
- A transparent 1024×341 four-frame astronaut cat walk sheet, horizontal facing and existing eased tile movement. The renderer derives animation from the last displayed position; it never writes the gameplay state. Reduced-motion preference skips the animation.
- Navy/gold telemetry and a compact scanner. Movement remains the existing adjacent-tile tap action; no new control handler.
- Actual neighboring legal moves retain the reviewed corner feedback. Fractures, power sources and airlock remain linked to the rules.
- HTML controls stay at least 44px; text stays at least 11px. The existing completion action and concise control reminder remain; the expandable guide is available.
- Artwork loads when the first surface mission renders, not on the home screen. Active ground + shared atlas + walking sheet total approximately 1.01 MB uncompressed file sizes. New ground replaces the previous ground in this scope.

## Compatibility

No server deployment, save migration, reward changes or level geometry changes. The existing client-only release recovery, trace transport, crew workshop and server compatibility remain. The renderer adapter is restricted to chapter 1, mechanic 1, non-daily missions. `field-missions.js`, every model, server file and existing test are byte-identical to the base. Other uses of mechanic 1 retain the existing renderer. Equipment and hit targets reuse `lunarWorksite`; there is no second independent level map.

## Evidence

`docs/lunar-preview/chapter1-playable.png` and `chapter1-small-phone.png` are genuine rendered screenshots from the local game, not generated interface mockups. Fixtures run without a real user account or reward writes.

`tests/lunar-expedition-ui.cjs` exercises Russian, English and Arabic in four viewports (390×844, 320×568, 430×932, 568×320), verifies visible unobstructed 44px controls, taps in all four directions against FieldRules, scanner, canonical completion and absence of browser exceptions. `tests/field-ui.cjs` checks all nine field missions, pause/reload and eight additional variants. `tests/a11y-floor.cjs` checks 141 screens.

Physical Telegram iPhone/Android validation is still required. This is an initial implementation of the visual direction, not pixel-identical fidelity to the cinematic concept, free-roaming 3D, or a completed nine-chapter redesign.
