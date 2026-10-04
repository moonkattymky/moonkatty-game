# MOONKATTY: 9 LIVES 🌙🚀

Telegram Mini App starter for the MOONKATTY universe.

## Current build
- Telegram WebApp SDK integration
- 12-language selector with saved preference
- RTL support for Hebrew
- Mission Control home screen
- Playable LIFE #1–#9 with one-time completion rewards and local checkpoints
- Moon Points demo UI

## Chapters 4–9 — mission depth update

Each chapter now contains three persistent operations with increasing complexity, followed by its existing live mission. These are decision puzzles, with no added countdown or enforced waiting:

| Chapter | Operations | Live mission |
| --- | --- | --- |
| 4 | Three terrain routes, mandatory beacons, obstacles and a fuel budget | Manual descent and landing |
| 5 | Three rotating power circuits through required nodes, from 4×4 to 6×6 | Charge, calibrate and ignite the reactor |
| 6 | Three mass-distribution layouts with simultaneous row and column targets | Preflight, engine start and ascent |
| 7 | Three interacting shield arrays, from 3×3 to 5×5 | Three asteroid sectors |
| 8 | Three deduced keys of 3, 4 and 5 unique symbols, using positional feedback | Acquire and decode the transmission |
| 9 | Three resource-constrained restoration sequences with 6–8 systems | Navigate and transmit the return code |

`mission-rules.js` generates deterministic solvable boards and validates checkpoint input. `operations.js` owns the operation deck, per-move saves, undo, reset, optional hints, pause and the handoff to the existing chapter controller. Failures restart only the current operation. The resource puzzle allows dead ends, with an explicit explanation and reversible actions. Circuit validation requires a continuous powered path through all three nodes, not merely a powered exit. Cargo accepts any arrangement that meets every target. Cipher feedback counts matches without exposing their positions.

Players with old completion flags can play the expanded chapters without deleting achievements. New completed runs expose an explicit replay with new boards. Rewards remain one-time; replaying chapter 8 preserves chapter 9's existing coordinates. Old in-progress flight/reactor/puzzle checkpoints remain available after the new operations. Chapter 1–3 rules and unlock requirements are unchanged. Operation saves use separate versioned keys; no old save format is rewritten.

```sh
node tests/mission-rules.cjs
node tests/operations.cjs
```

The rules regression checks 1,440 generated boards for valid, non-complete starting positions and reachable solutions. The browser journey solves all 18 operations through controls and then completes all six live missions; it also checks reload, pause, false confirmations, resource dead ends, replay, rewards and short-screen controls. Chapter-specific legacy regressions seed completed operations to isolate the live controllers. All browser verification uses isolated Chromium profiles, not physical phones or Telegram clients. Automated solution times are not human playtime estimates.

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
node tests/void7-effects.cjs
node tests/continuation.cjs
```

The chapter-specific regression flies all three sectors through actual controls, reloads amid moving hazards, checks shields, failure/retry, old-save migration, keyboard/hold/swipe input and scene cleanup. Layout checks cover nine viewport sizes in English and Russian. The continuation regression also exercises chapter 8–9 puzzles and prevents duplicate rewards. These are isolated Chromium browser tests; they do not represent physical-device or Telegram-client certification.

### Chapter 7 visual and feedback refinement

The cockpit now shows a live three-lane threat scanner. Incoming warnings persist until a rock clears the actual hull bounds; a close threat in the current lane receives a stronger cue. The scanner, lane brackets and collision checks use the same geometry. Sector-route markers fill with actual progress. New large-asteroid artwork, subtle camera parallax, shield mesh, maneuvering jets, fixed-origin impact fragments and a beveled exit gate add depth while keeping the playfield readable. The final approach smoothly centers and scales the ship into the gate. The renderer uses cached glows, bounded decorative objects and adaptive detail. All moving effects freeze with flight; reduced-motion mode retains the playable hazards. Existing version-2 saves and chapter rewards remain compatible.
