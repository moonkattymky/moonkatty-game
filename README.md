# MOONKATTY: 9 LIVES 🌙🚀

Telegram Mini App starter for the MOONKATTY universe.

## Current build
- Telegram WebApp SDK integration
- 12-language selector with saved preference
- RTL support for Hebrew
- Mission Control home screen
- Playable LIFE #1–#9 with one-time completion rewards and local checkpoints
- Moon Points demo UI

## LIFE #5 — Reactor engineering

The reactor chapter uses three sequential stages: charge three cells while controlling heat, keep temperature at 45–68°C and magnetic field at 45–55% for three seconds, then time three ignition pulses. Fully charged cells survive thermal shutdown; accepted pulses survive a miss. The guide, window blur and app backgrounding pause the simulation and release held controls. Charging routes automatically to the next unfinished cell. A versioned local checkpoint restores unfinished cells, calibration and accepted pulses after closing the app, behind an explicit resume button.

`reactor5.js` runs a display-synchronized animation loop with bounded time steps and 10 Hz accessible readouts. `reactor5-fx.js` draws the core plasma, energy feeds, coolant and one-shot pressure waves with cached textures, capped pixel density and adaptive particle detail. Both stop while paused or outside the chapter; `reactor5.css` scopes its portrait/landscape layouts. `i18n.js` supplies Russian UI text. Artwork and energy rings share an SVG coordinate system with uniform scaling. Reduced motion disables decorative rotation, particles and pressure waves while preserving the timing challenge. The console reserves its maximum phase height to keep the camera steady when switching stages. Short viewports use a uniformly scaled close view of the core. Chapter completion retains the existing one-time 1,250-point reward and unlocks LIFE #6.

## Important
Moon Points are in-game/reputation points only. They have no monetary value and do not guarantee a future token allocation.

Production rewards, social verification, persistence, wallet ownership verification and claim logic require a secure backend and must not rely on client-side state.


## Campaign recovery audit — 4 October 2026

Chapters 7–9 were reachable through the sixth chapter but missing from mission selection and resume navigation. They now appear as each continuation unlocks. Unfinished continuations retain the current stage, puzzle input, core power, ship hull, shields and asteroid positions. Returning to a saved session pauses before play resumes. Completed chapters reopen in review mode without replaying their challenges or awarding more points.

The shared guide and background pause now cover chapters 7–9. Final coordinates accept either a decimal point or comma. The final balance and mission archive refresh immediately after the last reward. Existing chapter 1–6 save formats are unchanged.

Verification: browser playthrough of chapters 1–6 from a fresh profile (5,500 points), then all existing continuation chapters through actual controls (12,250 cumulative points from seeded prerequisites). Targeted checks cover reload during flight and partially entered sequences, pause, failed attempts and retry, chapter locks, paid code hints, restored completions and duplicate rewards. Tests run in Chromium with mobile viewport sizes, not on physical iOS/Android devices. Telegram authentication is stubbed in isolated test profiles.

Run the saved continuation regression test after installing Playwright and its Chromium browser:

```sh
npm install --no-save playwright
npx playwright install chromium
node tests/continuation.cjs
```

An existing compatible Chromium executable can be supplied via `CHROMIUM_PATH`; `MKTY_TEST_OUTPUT` selects the report directory. The test serves this checkout locally on a random port and never touches a real player's data. Full scene animation and asteroid avoidance are additionally checked with a real-time browser playthrough; the saved regression uses a virtual clock to exercise pause/reload boundaries deterministically.

## LIFE #7 — The Void

The seventh chapter now crosses three asteroid sectors in a 72-second flight, followed by a short gate approach. Amber lane markers precede each incoming wave; every wave leaves a safe lane, with enough spacing for the previous wave to pass before the next warning. Tap or hold the steering buttons, swipe the scene, or use the arrow keys. Space and the shield button arm one charge until a single impact consumes it. Large rocks remove 28% hull, smaller rocks 18%.

Sector boundaries save progress, repair 12% hull and restore one shield charge (maximum three). Hull failure opens an explicit retry at the start of the last sector with full supplies. A single animation clock drives bounded-step motion, collision checks, warnings and effects; hazards no longer depend on independent CSS animations. Pause, backgrounding and app exit preserve flight positions and supplies. Unfinished version-2 checkpoints resume behind the guide; old version-1 saves migrate their distance, lane, hull and shields into the new flight with a safe warning window. Completed sessions remain complete, retain a flight report when available, award 1,750 points once and unlock chapter 8.

`void7.css` provides compact portrait and landscape decks with English and Russian copy. The new background and original ship keep their proportions. Asset provenance is in `art/README.md`.

```sh
node tests/void7.cjs
node tests/continuation.cjs
```

The chapter-specific regression flies all three sectors through actual controls, reloads amid moving hazards, checks shields, failure/retry, old-save migration, keyboard/hold/swipe input and scene cleanup. Layout checks cover nine viewport sizes in English and Russian. The continuation regression also exercises chapter 8–9 puzzles and prevents duplicate rewards. These are isolated Chromium browser tests; they do not represent physical-device or Telegram-client certification.
