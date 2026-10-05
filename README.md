# MOONKATTY: 9 LIVES 🌙🚀

Telegram Mini App starter for the MOONKATTY universe.

## Current build
- Telegram WebApp SDK integration
- 12-language selector with saved preference
- RTL support for Hebrew
- Mission Control home screen
- Playable LIFE #1–#9 with one-time completion rewards and local checkpoints
- Moon Points demo UI

## Expanded nine-chapter campaign — pacing target: 2–3 hours

New routes use **36 spatial assignments, 27 engineering boards and 9 required sorties**, followed by the original finales 1–7 and new spatial finales 8–9. Every chapter has a dedicated discipline: rover exploration, crew scheduling, orbital maneuvers, geological landing surveys, coupled thermal control, inertial docking, stealth, triangulation and convoy routing. Assignments preserve deterministic seeds and depend on earlier objectives. The three flight contracts now vary across the chapters. Original chapter 4–9 instrument operations remain before their finale.

The graphical redesign adds detailed surface/orbital environments, a transparent rover, mature crew/launch art, connected chapter maps, restrained materials and larger touch controls. Interactive geometry is independent from the raster background. New motions respect reduced motion, pause and background state; docking uses frame-time physics. Zoom remains available.

| Chapter | First-play pacing target, minutes |
| --- | --- |
| 1 — The awakening | 12–16 |
| 2 — The crew | 13–17 |
| 3 — The launch code | 14–18 |
| 4 — The descent | 16–20 |
| 5 — Ignition | 17–21 |
| 6 — Liftoff | 16–20 |
| 7 — The void | 17–21 |
| 8 — The signal | 16–20 |
| 9 — The return | 18–24 |
| **Campaign target** | **139–177** |

These are design targets, **not measured player completion times**. Skilled players and players using hints can finish faster. No minimum playtime, idle wait or new cooldown gate was added. Local active-time records cover operations, flights and final missions to support later pacing review. The existing chapter 3 code penalties retain their established rules and are not counted as content duration. The ten-digit code is still required at the start of chapter 3, before its new plan; successful verification returns to that plan.

`story-plan.js` defines the nine plans, dependency graph, stable seeds and checkpoint validation. `story.js` owns the plan screen, chapter entry gates, local per-stage saves (`mkty_story_plan_N_v1`) and final-controller handoffs. The existing operations and expedition controllers expose scoped assignment sessions. These sessions save into the owning chapter without overwriting standalone operation replays or free expedition progress. Failed sorties retry only their current stage; completed prerequisites persist. Old completion flags, once-only Moon Points, final balances and finale checkpoints remain intact. Existing finished players can play the new chapter plans without deleting achievements.

```sh
node tests/story-plan.cjs
node tests/story.cjs
node tests/story-edges.cjs
node tests/first-three.cjs
node tests/operations.cjs
```

Edition 2 is used for new plans. Existing edition-1 saves retain their original 54 boards and 18 sorties until the player chooses **New chapter route**. Replay archives the previous plan, clears only that chapter’s run checkpoints and preserves achievements, code rules, coordinates and once-only rewards. Partial spatial finales and legacy instrument sessions contribute to the displayed active time. Expanded content is Russian/English; the language screen states this explicitly. Specialist role cards in chapter 2 remain English.

```sh
node tests/field-rules.cjs
node tests/field-ui.cjs
node tests/worlds.cjs
node tests/worlds-edges.cjs
MKTY_TEST_EDITION=2 node tests/first-three.cjs
node tests/operations-edges.cjs
```

`field-model.js` owns deterministic rules and checkpoint validation; `field-art.js` renders corresponding SVG geometry over detailed environments; `field-missions.js` owns input and lifecycle. `chapter-space.js` sequences the two phases of finale 8 and three phases of finale 9. `tests/worlds.cjs` plays all 72 edition-2 stages and the five new finale phases via visible controls. The field model regression solves 1,800 missions; the other models cover 2,520 generated boards and 240 sectors. Browser edge checks exercise malformed state recovery, migration, replay, partial finale time, pause/reload and first-time/duplicate reward settlement.

Tests isolate campaign layers with seeded prerequisite records. Separate tests play the actual 1–3 finales and operations/finales 4–9. This is not a single uninterrupted human playthrough, a phone benchmark or Telegram certification. Virtual-clock solver times do not establish a human 2–3 hour duration. The remaining pacing target requires new-player observation.

## Gameplay depth and detail — 5 October 2026

New field checkpoints use format 2. Existing format-1 assignments continue with their original rules; future assignments use the new rules. Saved chapter editions and once-only rewards are unchanged.

- Orbital maneuvers have changing lateral disturbance and gravity. Angle/impulse guide the ship through an intermediate relay; a separate post-relay trim controls the final capture. Both windows must be crossed.
- Landing surveys validate all four supports of a 2 × 2 footprint. Later assignments require an independent backup pad. Seeds change viable locations, and surface strength remains hidden until sampling.
- Thermal control now cycles through standby, life support and drive loads. Each mode needs diagnosis, the correct bypass and balancing of three coupled valves. Live readings stay visible while scrolling the controls.
- Convoy scouts must actually visit waypoints before the heavy transport can use them. Engineering gate access, narrow passages and occupied nodes still constrain the route.
- Detailed transparent station assets replace simplified props. Each operation displays objective progress and a completion review. Error, collision, detection and action counts persist with completed field stages; the plan identifies precise executions. Help can be expanded without leaving the operation.

Additional regression checks:

```sh
node tests/detail-rules.cjs
node tests/detail-ui.cjs
node tests/worlds-release.cjs
```

The detail rules suite covers 45 legacy missions, recovery after failed choices, intermediate saves and the separate effect of trajectory trim. Browser tests reload after the first orbital burn, primary landing pad, thermal load and scout move; they also play the original orbital/thermal rules and the new thermal controls in eight Russian/English viewport configurations. `worlds-release.cjs` checks nine rendered spaces and SHA-256 of 19 deployed files.

## Open-sector expeditions

The home screen and chapter menu now lead directly to **Expeditions**, a separate repeatable flight mode. Players pilot the original MK–01 freely through a generated sector, inspect a navigable map, discover optional containers, evade asteroids and ion clouds, and recover crew or equipment before docking at Ark station.

Three contracts have different objectives: recover two escape pods; power two relays and extract a derelict's black box; or survey three remote relays. Retrieving pods or the black box raises an alarm that extends patrol detection and pursuit speed. Patrol shots have a visible targeting warning and can be dodged. Boost, scan and a defensive pulse share a regenerating battery; the pulse interrupts nearby patrols and clears nearby projectiles. A repair tender offers a one-use choice between hull/battery restoration and taking its parts as cargo.

Successful docking banks cargo and a contract reward. Ship loss forfeits the current cargo. Early docking banks 35% of cargo and delivers any rescued crew, without completing the contract. Parts buy three levels each of hull, maneuvering engines and scanner range. The second sector tier unlocks after one successful flight; the third after three. Higher tiers add patrols and increase damage. These parts are ship resources, entirely separate from Moon Points; existing chapter unlocks, rewards and final balances are preserved.

`expedition-model.js` owns deterministic world generation, bounded-step flight, hazards, interaction, settlement, upgrades and save validation. `expedition.js` owns the canvas presentation, touch joystick and held controls, keyboard fallback, map waypoints, pause/briefing and a single versioned storage envelope (`mkty_expeditions_v1`). Settlement updates the profile and completed run together, preventing duplicate rewards on reload. Gameplay pauses and releases controls on backgrounding, blur, navigation or an open map. Reloaded flights require explicit resume. No offline flight time is simulated. The `snapshot()` diagnostic returns a detached copy only.

The renderer uses the existing original ship, space background and asteroid textures, with code-drawn stations, relays, pods, drones, scanner waves and warning geometry. One animation loop stops outside live flight; pixel density is capped at two. No external assets, network gameplay service or backend persistence were added. Progress is local to the device.

```sh
node tests/expedition-model.cjs
node tests/expeditions.cjs
node tests/expedition-edges.cjs
```

The model regression checks 240 sectors, geometry, battery/defense rules, patrol warnings, mutually exclusive tender choices, settlement gates, upgrade caps and malformed saves. The browser journey flies all three contracts through actual keyboard and pointer controls, then checks pause, reload, map selection, purchases, Russian/English portrait and landscape layouts, and isolation from the existing campaign balance. The edge regression verifies partial rescue across blur/reload, both tender choices, power locks, ship loss, report navigation and early extraction. Browser tests use Chromium profiles, not physical devices or Telegram clients. Automated pathfinding times do not measure human playtime or retention.

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

### Instrument artwork

The operation deck now uses six distinct SVG instruments: a continuous terrain survey and plotted route, metal conduits with sleeves and powered conductors, cargo tanks in numbered racks, wired shield emitters, a receiver with engraved symbol keys, and subsystem circuit diagrams. `operations-art.js` derives routes, connections, values and status lights from the existing board state. Hovering or focusing a shield emitter previews its actual affected neighbors. The fixed action dock also carries status/error messages so a tall diagram cannot hide feedback. Graphite, steel and muted brass replace rounded colored tiles; artwork remains sharp at any pixel density and introduces no continuous rendering loop.

The observatory and return scenes share this finish through `mission-instruments.css`, with a detailed satellite and mechanical return gate while retaining the original ship and antenna sprites. Puzzle rules, completion rewards and save formats are unchanged. The existing operation journey, 96 English/Russian operation layout cases and continuation regression verify the new rendering and controls.

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
