# First open 3D lunar-base sample — validation evidence

Production base: `00e391ffe0bb2ed663a7e3136cf382b0030857b4` (PR60).
Graphics work: PR59, `feat/lunar-expedition-20261010`.
Playable source checkpoint: `f7f3a9c2797eb58a08e6b2261b946f83d797a1be`.

## Scope and production boundary

One actual WebGL2 location with continuous analog walking, a full-volume animated
tabby astronaut, 360° camera orbit, collision, open airlock, reactor, relay,
generator, rover, scanner and three local inspections. This is a bounded first
location, not a finished nine-chapter 3D campaign or a final cinematic mascot.
Run from the repository root with `python3 -m http.server 8000` and open
`http://localhost:8000/graphics-preview/`.

All 329 files already tracked by the published main have the same content in
the graphics candidate. Auth/account switching, retries, convoy restoration,
reward/backend code and save formats were not edited. Compressed writes remain
disabled. The new page does not load campaign controllers or call game APIs.
Its own per-tab `sessionStorage` position and inspection list are only for the
sample; they do not grant or migrate campaign progress.

## Regression evidence

`main-regression.json` maps all **77 existing main test programs** to passing
results. `main-first-run.log` contains 75 main passes and the earlier 3D timeout
under concurrent software rendering; the interrupted long `story.cjs` and
`worlds.cjs` programs passed in `main-resumed-run.log`. This is the completion of
an interrupted run, not a claim of one uninterrupted 78/78 process. No main test
or test runner was weakened or modified.

The separate final real-render test **passed all 17 scenario groups**, with no
JavaScript errors; `graphics-regression.json` records the seven layouts and
individual hit targets. The sample requests **1,458,550 bytes** before HTTP
compression. The test uses actual keyboard and native touch input,
not state setters or teleports. It covers seven sizes from 320×568 through
768×1024, portrait/landscape layouts, 44 px controls and unobstructed hit targets,
simultaneous walking/looking, pinch/cancel, collision, all three inspections
reached by walking, a full camera revolution and minimum outdoor framing, pause,
map/tasks, reload, untouched campaign storage/API boundary, BFCache lifecycle,
backgrounding, economy mode, lost GPU context and failed-asset recovery. Telegram
SDK ready/expand/stable viewport/BackButton/deactivation are checked with a local
fixture, not a signed-in physical Telegram client.

## Measured software-renderer limits

`performance-software-webgl.json` is a fresh isolated benchmark from the final
source. Chromium 149 uses ANGLE / SwiftShader, without a physical GPU or phone.
Cold cache loading uses 4 Mbit/s, 150 ms network latency and 4× CPU throttling.
CPU throttling is removed for the subsequent interaction sample; no other WebGL
workload runs concurrently. All stalls are retained.

| Measurement | Result in this environment |
| --- | --- |
| Ready after cold load | 8,488 ms |
| Frame interval median / p95 | 233.3 / 566.6 ms (45 samples) |
| Input to first observed movement median / p95 | 745.3 / 1,260.6 ms (6 samples; includes automation overhead) |
| Visible scene at benchmark position | 69 draw calls / 120,974 triangles |
| Automatic pixel ratio | 0.85 |
| JavaScript errors | 0 |

These results **do not pass a smooth-play release criterion on this software
renderer** and must not be presented as phone frame rates. Full-scene shadow
sampling was removed, terrain AO is baked, rough terrain uses vertex lighting,
repeated station geometry is instanced and opaque mascot meshes are merged per
animated rig part. Metal/glass materials and character geometry are retained.
The sample remains a graphics prototype pending device validation.

Suggested physical-device release checks: frame median ≤33.3 ms and p95 ≤50 ms,
touch response median ≤100 ms and p95 ≤200 ms, and a 10-minute walk/orbit session
inside Telegram on representative Android and iPhone devices. Check minimize /
return, orientation and safe areas, simultaneous joystick/camera, pause, reload,
reconnect and sustained performance. Browser emulation cannot complete these
checks.

## Authentic screenshots and recording

The accompanying PNGs and separately delivered MP4 are captured from the actual local build at
390×844 with native touch input. The recording shows walking to a module,
inspection, camera orbit, map, pause/resume and further walking. Initial loading
is trimmed; playback speed is unchanged. The MP4 container rate is not a measured
render rate. `capture.json` records the capture environment and final snapshot.
The complete MP4 is also included under `review/` in the downloadable stage
archive. Reproduce with `tools/record-open-world-preview.cjs`; rerun the benchmark with
`tools/benchmark-open-world-preview.cjs`.

## Integration and publication

PR59 remains a draft; no production Pages deployment or main replacement is made.
The required shared controller/input/checkpoint decisions are listed in
`docs/OPEN_WORLD_GRAPHICS_20261010.md`. This is a coordination document; it has
not been claimed as delivered to or agreed with the other chat. Exact 3D campaign
coordinates must not silently become a new save schema. After agreement and
device validation, combine with the newest main and rerun the combined checks.

Rollback: the sample is entirely additive. Remove/revert its graphics-only
changes while retaining all newer logic fixes; no save migration is required.
Texture originals, pinned engine license, editable rig/scene code, tests and
capture helpers are included in the source archive.

![Actual first frame at 390×844](mobile-first-frame.png)

![Actual orbit beside the inspected generator](mobile-orbit.png)

![Actual pause dialog](mobile-pause.png)
