# Chapter 1 browser parity gate

## Current reviewed baseline

This diagnostic continuation uses exact reviewed PR49 commit
`357d819fdc8ef2ab7e245e7abcd79859bba6c256`, tree
`669f3efe9d355af0184a10314fdb506dc7e92f01`. That baseline passed 73/73 game
suites, 32 real PostgreSQL contention cases and 74 screenshots / 12,539 checks.
Those are baseline results, not proof that this prototype is correct.

The prototype remains unwired. Its runtime, CSS, endpoint, settlement and SQL
surfaces are byte-identical to PR49, pinned in `life1-source-manifest.json`.
PR49 includes the separately reviewed Chapter 1 entrance-cache correction and
cloud fixture acknowledgement corrections. The model still needs exact native
layout parity; no threshold or boolean assertion is relaxed to obtain a pass.
Local browser/socket execution is not used; the independent diagnostic and
full workflows provide actual Chromium evidence.

## First CI result and diagnostic follow-up

The first full run, `37977916761` / job `113980757948`, on PR47 head
`e5d741d4005f2a1e2352cb0104b2d359f988d2f3` finished with 71/73 suites passing.
The Chapter 1 browser suite passed 19/23 cases: all 15 frame/layout scenarios,
all three earned quests, and puzzles/lifecycle. Each compact/large/fractional
strict-boundary case reported 36 decision mismatches. The ordinary-motion
entry-cache case also failed its cached-width assertion. The model boundary failures remain unresolved. The independently fixed runtime
entrance-cache case is now retested against PR49. This diagnostic follow-up does
not change the candidate model, production files, tolerances, boolean assertions
or expected results.

The CI log previously kept only the first mismatch from three failed cases,
so it omitted the animation measurements and most independent native edges.
It now prints one bounded synthetic row per failed scenario: Chromium version,
configuration, world rectangle, all three raw obstacle rectangles, candidate,
cached and freshly measured collision edges, plus initial/final animation
geometry and four passive 50ms post-animation observations. The original
immediate cache assertion remains intact; later samples only distinguish
persistent stale geometry from a pending observer delivery. Additional bounded observations include computed positioning/transform styles,
DPR, visual-viewport/scroll offsets, ancestor transforms and the actual player
and hotspot rectangles at each strict proximity probe. These observations
never become model input.

A path-filtered `Chapter 1 prototype parity diagnostics` workflow runs these
four non-browser suites and the real Chromium parity suite directly, providing
shorter feedback on prototype changes. It does not replace or modify the full
aggregate workflow. No CI rerun has yet verified this follow-up. The source
fingerprint checks and eight-group non-browser harness contract pass locally;
no local browser/socket process was launched.

## Run in an authorized browser-capable environment

Use the repository's existing pinned dependencies and Chromium workflow:

```sh
npm ci --ignore-scripts
npx playwright install --with-deps chromium
node tests/life1-browser-contract.cjs
node tests/life1-browser-parity.cjs
```

The existing `npm test` discovers both suites automatically and remains mandatory.
The focused workflow runs the Chapter 1 suites separately for quicker diagnostics. `CHROMIUM_PATH` optionally selects an installed Chromium;
`MKTY_TEST_OUTPUT` selects the report directory. Without it, the browser suite
creates a unique temporary directory. It writes `life1-browser-parity.json` and
failure screenshots. Failure output includes bounded synthetic geometry rows for every failing
scenario, so the existing aggregate's final 25 log lines retain all three
obstacle-edge sets and the animation-cache observation without artifacts.

`node tests/life1-browser-contract.cjs` is safe without a browser: it imports the
runner without calling `main`, checks compilation and isolation, and verifies
the original source fingerprints. It does not listen on a port or import
Playwright. Do not use `npm test` in an environment where browser execution is
prohibited; it includes the browser suite.

## Coverage authored (not yet browser-verified)

23 independent cases run in fresh browser contexts:

- 15 reduced-motion geometry/movement cases: 30, 60 and 120 explicit frames/sec
  for 320×568, 360×640, 390×844, 520×1000, and a fractional containing-block case
- Trusted mouse pointerdown/move/up in every rate/layout case: 4 px joystick
  dead zone, measured-width strength normalization, observed input axes,
  captured release outside the pad, and subsequent stopped frames
- A real viewport resize in each case, with the original ResizeObserver doing
  cached-geometry refresh and walkable-position recovery
- Separate compact, large and fractional strict-boundary cases, using identical
  query coordinates for candidate/oracle collision decisions and actual DOM
  player placement around the strict proximity threshold
- Three earned full quests with seeds 0, 571 and uint32 maximum: real energy
  collection, repair sequence, tuning, exactly 25 active interval callbacks,
  delayed completion, paused completion delay, and frozen completed movement
- A puzzle/lifecycle case: wrong repair, watch timing, hidden auto-pause,
  explicit resume, terminal-close regeneration, disabled-cell screen return,
  ±3/±4 tuning, signal loss, antenna close, paused hold, and leaving before the
  completion card's timer fires
- A separate ordinary-motion entry-animation cache gate, without forced refresh

The fractional case constrains only `#app` to 387.375 CSS px in a 430×932
viewport. The production world and all object styles remain intact; the report
records the actual resulting world size. This is a containing-block fixture,
not a claim about a physical device or a particular phone's achievable layout.

## Independence and test-only setup

The suite loads the full unchanged `index.html` and normal script/CSS order.
`life1-model.js` is added through Playwright only; the game loader still does not
import it. No DOMRect getter, obstacle, player size, or source physics is mocked.
The model retains its own ideal layout calculation. Measured browser rectangles
are never substituted into the candidate's obstacle or hotspot geometry.

The test-only adapter:

1. Cancels both pre-existing Chapter 1 RAF handles (the initial production
   registration uses the legacy `life1MoveFrame` name). It invokes the unchanged
   source movement function once per explicit frame and cancels only its next
   Chapter 1 registration. Unrelated animation loops continue under the clock.
2. Observes calls to the original collision predicate without changing its
   return value. A differing collided/not-collided decision fails exactly.
3. Wraps timer registration transparently for Chapter 1 missionTimeout and
   antenna hold. Actual Playwright-clock callbacks execute the original source
   function, and their observed timestamps feed the model. It never injects a
   hold/delay callback, rounds its recorded timestamp, or changes its due time.
4. Registers a second ResizeObserver after production's. It records actual
   dimension changes, including flex changes caused by mission-status text.
   Geometry/nearest-target assertions defer only until the native observer
   transition settles; no source geometry refresh is called by the adapter.
   Each action drains that bounded observation before further navigation.
5. Uses the existing seeded story prerequisite helper and local demo pacing
   setup to isolate the finale. It does not claim to test the eight earlier
   story tasks, `openMission` restore, or reload/checkpoint continuity.
6. Temporarily supplies the route-derived PRNG only during the synchronous
   initial Chapter 1 reset and terminal-close challenge reset. It records the
   five/four draws and restores Math.random by identity in `finally`. The real
   frequency and sequence generators retain their ordinary distribution. It
   never assigns their outcomes or seeds unrelated app startup.

The pure frame-injection lane assigns input axes only. The separate pointer
lane reads actual controller axes after trusted browser mouse events and checks
those axes independently against recorded event coordinates and the measured
joystick rectangle. It then passes the observed axes to the candidate. These
are mouse interactions, not touch, iOS, Telegram or real-device certification.

Quest/puzzle actions use the original DOM `.click()` handlers and range `input`
events. They exercise real controller logic and native disabled buttons, but
are explicitly **not an all-pointer/hit-testing playthrough**. No `.onclick()`
shortcut, forced Playwright click, expected stage assignment, earned-pickup
assignment, or direct timer completion is used. Navigation is replanned from
the candidate model after earned interactions and observed layout changes.

Strict proximity probes alone assign the player's starting coordinates. This
is isolated boundary setup, never a quest shortcut. They restore coordinates
and presentation-only status text immediately; they do not alter collection,
repair, or completion state. Synthetic visibilitychange and pagehide dispatches
exercise actual listeners. Pagehide is an observation (Chapter 1 has no direct
pagehide-to-leave mapping), not a forged model `leave` event. This does not test
browser tab throttling, BFCache or a real page unload.

## Timing and tolerances

Playwright 1.58.2 rounds `clock.runFor` endpoints up to integer milliseconds.
Repeated `runFor(1000 / hz)` would accidentally test 34/17/9 ms intervals. The
fixture instead maintains a cumulative explicit frame timeline, advances the
clock to the ceiling of each absolute target, and supplies the unrounded target
to the original movement function and candidate. Both requested frame time and
observed performance.now are recorded. Semantic/timer events use the observed
clock. Navigation/movement phases have no active puzzle timers; a subsequent
phase starts from the current clock, avoiding time reversal. Rates describe
explicit frame inputs, not monitor refresh or browser scheduling throughput.

Numeric rectangles and visual centers permit at most 1/16 CSS px, four common
Chromium layout units, to account for independent percentage/edge rounding.
Coordinate tolerance converts that same CSS-pixel budget to percentages;
normalized distance tolerance is at most twice it over the smaller dimension.
Other scalar controller values are compared to 1e-8. Discrete states, each
repair button's disabled state, nearest target, strict collision results, and
strict proximity reachability have no epsilon allowance. A tiny geometry
residual that changes an actual decision is a failure, not a tolerated pass.

Near-threshold probes include ideal model edges and measured browser edges
with ±1e-7 percentage offsets, plus proximity positions at −0.125, 0 and +0.125
CSS px from the mathematical boundary. Those deliberate adversarial cases can
expose the model's current lack of subpixel quantization. Do not weaken their
booleans or import oracle rectangles to make them pass.

## Isolation and remaining gates

A fresh read-only static server binds to 127.0.0.1 on a random port. Only local
static GET/HEAD assets are served; test/server/tool files, the prototype model
URL, API paths and mutation requests are rejected. Page routing aborts every
nonlocal request, service workers are blocked, and WebSockets are closed.
Nothing calls a live API or uses an authenticated player. All data and report
values are synthetic. Authored isolation is covered by non-browser tests;
actual browser routing still awaits CI.

This gate does not establish native timer jitter or recovery cadence. Native
setInterval may deliver a late callback followed by a shorter recovery interval,
where the current prototype's minimum-spacing admission could reject legitimate
source behavior. That remains a separate recorded-timing/ingestion design gate.
Likewise, entrance-transform cache drift is a source-grounded hypothesis until
the ordinary-motion case runs. No result from this unexecuted fixture authorizes
runtime adoption, receipt issuance, transport, account binding or settlement.
