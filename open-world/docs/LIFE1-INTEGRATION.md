# LIFE 1 integration seam (stage 2, not wired in stage 1)

Verified against main `00e391ffe0bb2ed663a7e3136cf382b0030857b4`.

The world should enhance the existing `#storyPlan` screen. Keep the existing eight `[data-story-step]` controls and `#storyCore` mounted as accessible fallback. Spatial POIs activate those same controls. `story.js:activatePlan` requires the story plan to be the active screen, rejects stale/background interaction and delegates through its private guarded `openTask/startTask` path. A separate iframe or duplicate game instance would break this lifecycle contract.

Read titles, controller type, prerequisites and state from `StoryPlan.plan(1, saved.edition || 1)` and `MKTYStory.read(1)`. Do not hardcode edition 2: legacy edition-1 saves retain their original boards/flights until explicit replay.

Edition 2 tasks, zero-based IDs:
1. 0: Base perimeter, Field stage 0, no prerequisites.
2. 1: Power mainline, board 5/round 0, no prerequisites.
3. 2: Distant sector survey, flight tier 1, requires 0 and 1.
4. 3: Observatory power, Field stage 1, requires 2.
5. 4: Mass distribution, board 6/round 0, requires 2.
6. 5: Damaged sector, Field stage 2, requires 3 and 4.
7. 6: Reach the beacon, Field stage 3, requires 5.
8. 7: Operation reserves, board 9/round 1, requires 6.
9. Finale: original #storyCore after all eight completed tasks.

All existing task controllers converge on `story.js:finishTask` via the original descriptor's completion callback. It validates their checkpoints, records proof and performance/attempt metadata, writes the original plan record and returns through `menu(n)`. Preparatory tasks do not award MoonPoints. The finale remains `app.js:finishLife1Signal` → `awardLifePoints(1,500)` → the original reward client. A POI must never call reward or chapter-completion functions itself.

Preserve the original DOM and script order, campaign lifecycle hooks, account namespaces, storage recovery, cloud allowlist, reward idempotency, replay/archive behavior, and LIFE1's ten-second memory-code reveal for later LIFE3 use. The optional trusted-route branch is currently inactive because production MKTYRewards does not export requiresRoute/routeReady; the visual port must not silently activate new auth policy.

Refresh presentation from original state after storage and screen-return events. Do not mirror progress into another store. Suspend world input and rendering behind tasks, dialogs, pause, blur and hidden state. Presentation-only world position must not change the campaign/cloud schema without separately specifying compatibility.

Acceptance before LIFE1 release: all eight ordinary completions and returns; locked/already-done POIs; partial-save reload; cancellation; account switch; legacy edition-1 saves; exactly one unchanged 500-point finale award; physical iPhone and Android end-to-end runs. Device checks remain unperformed until actual hardware is available.
