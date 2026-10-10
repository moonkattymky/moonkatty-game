# PR59: open 3D graphics sample and integration boundary

Base: published `00e391ffe0bb2ed663a7e3136cf382b0030857b4` after PR60.
Graphics PR59 incorporated this main with a merge commit
`372002381ca8804822db4f0f924742e3c7c8c648`. The adjacent `index.html` script conflict
kept the new compatible-convoy model version. No force update or main replacement
was used.

The user subsequently requested a true freely traversable 3D world and a first
playable location before expanding the campaign. This PR therefore supersedes the
earlier 2.5D root-page graphics. The previous candidate remains in commit history
and its stage archives. Root `index.html`, `field-art.js` and the existing art
README now match the published main. The final change is an additive, independent
`graphics-preview/` location, its sources, documentation and a new rendered test.
The old feature-specific test was removed together with that superseded feature;
every test supplied by main is retained without modification.

## Preserved production behavior

Auth, account lifecycle, rewards, campaign models/controllers, backend functions,
checkpoint recovery, stage retry and every save format match the base main.
`server/rewards/index.ts` still sets `traceTransport:false`; compressed writes
remain disabled. The 3D page imports none of these modules and calls no game API.
Its independent per-tab session key cannot award campaign progress.

## Working sample

Continuous camera-relative analog movement, acceleration/deceleration, physical
collisions with station modules, walkable airlock ramp and floor, a real-volume
animated mascot, camera orbit through 360°, drag and pinch gestures, scanner,
nearby inspections, map, tasks, pause, blur/background handling, tab-reload
restoration, BFCache return handling, a low-resolution option, and explicit
asset/WebGL failure recovery. All scene elements are real mesh geometry; there is
no fixed cinematic backdrop or billboard mascot standing in for an open world.
Outdoor camera obstruction now raises the viewpoint above nearby equipment when
necessary, keeps at least 7 m of framing, and smooths orbit angles instead of
crossing the character along an interpolated chord. Confined airlock views hide
the avatar only when the camera would otherwise be inside its helmet.

The sampled world is roughly 146 m across, bounded to this one location. Three
inspection objectives are a local presentation exercise. Nine mission chapters,
new reward rules and new progression are not implemented by this graphics PR.
The procedural mascot retains the reference's tabby face, white/gold suit and
striped tail. It is an editable first 3D rig, not a claim of final cinematic
character-model quality.

## Proposed changes requiring agreement with the logic chat

This document is a handoff for coordination. No agreement or delivery to the other
chat has been assumed.

| Area | Decision needed before campaign integration |
| --- | --- |
| `field-missions.js` | A renderer/input adapter for continuous movement and camera drag, with pause, accessibility and fallback behavior. Existing progression callbacks must remain owned by the campaign controller. |
| `field-model.js` and verified server copy | Decide whether the 3D location only visualizes the current validated grid or introduces genuinely new navigation rules. Free roaming must not invent completion traces, skip stage gates or bypass replay verification. Any new navigation model belongs to the logic workstream. |
| `app.js` / root `index.html` | Add a capability-gated location entry and clean lifecycle for leaving/returning to campaign UI, without changing authentication or account switching. The prototype currently has no root-page integration. |
| Checkpoint restoration | Prefer spawning at a visual anchor derived from an existing verified checkpoint, so the save format need not change. Persisting exact 3D coordinates in campaign saves would need a separately approved versioned schema and validation. The prototype session key must not become a production save format by accident. |
| Shared controls / languages | Agree joystick versus existing buttons, camera gesture ownership, screen-reader/keyboard controls and all supported language strings. The graphics-only sample currently uses Russian UI. |
| Deployment | Combine with the latest main, run all tests, retain a release SHA and rollback artifact. Do not merge earlier graphics PR55/57 or enable compact writes to satisfy a graphics dependency. |

## Validation and limits

The new real-browser test checks seven mobile/tablet portrait/landscape sizes,
44 px controls and unobstructed hit targets, actual continuous input, simultaneous
two-finger walking/look, pinch, cancellation, collisions, nearby inspection,
full camera revolution, pause, map/tasks, reload, untouched campaign storage/API
boundary, background pause, economy mode, context loss and failed-asset fallback.
The full main suite separately covers production logic and recovery. Screenshots
and gameplay recordings are captured from the actual local WebGL build.

Runtime transfer budget: below 1.5 MB before HTTP compression, including the local
engine, two WebP textures, HTML/CSS and scene scripts. Scene budgets are under
160 draw calls and 220,000 visible triangles in the tested views. These are size
and geometry limits, not proof of a particular frame rate on a physical phone.
Automatic pixel ratio is capped and reduced when sustained frame timing is slow.
The first software-GPU benchmark exposed expensive full-scene shadow sampling.
That path was removed in favor of contact decals and vertex-baked terrain AO;
small distant bolts use fewer triangles while the character keeps its mesh detail.

Browser verification uses Chromium mobile emulation with software WebGL. Physical
Telegram Android/iOS tests still require representative devices: sustained frame
time and thermal load, joystick/look together, viewport changes and safe areas,
BackButton, minimize/return, orientation change, reconnect and tab/app reload.
The sample is not marked as production-ready on the strength of emulation alone.

## Rollback

Before integration, main remains at its separately verified release. The entire
graphics sample can be removed without a save migration. If an isolated sample
is later merged, revert its graphics-only commit, retaining all later main logic
commits. Never reset main to an old graphics archive or force-push it. Source
archives include generated texture originals, pinned engine/license and tests.
