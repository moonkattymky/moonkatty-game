# PR61 compatibility review — graphics candidate

Production base is main `00e391ffe0bb2ed663a7e3136cf382b0030857b4`.
Test-entry source is PR61 head `3779a5f0424751a3b2eab0ab4479186fedae24d1`.
The compatibility build is a detached worktree, never an update to PR61.
Only the graphics branch's `graphics-preview/scene.js` and `world.css` were
overlaid on PR61. PR61's Home integration, `world.js` pause/dispose/loading
lifecycle, auth, accounts, campaign controllers, rewards and storage were retained.

## Reproduced baseline blocker

The unchanged PR61 baseline passes `preview-entry-source.cjs` but fails
`preview-entry-ui.cjs` at the final root-reload assertion:
`performance.getEntriesByType('navigation')[0].type` throws because the array is
empty. This also occurs with the new graphics, and was confirmed in GitHub run
38071207661, job 114268816163 (full suite 79/80). It is not a graphics regression.
The reason this browser exposes no Navigation Timing entry is not established.
`pr61-baseline-failure.log` preserves the local reproduction.

## Reviewable proposal; not applied to PR61

`PR61_REVIEW_PATCH.diff` makes two narrow test changes:

1. Update only the two reviewed visual asset SHA256 values, keeping every other
   frozen auth/controller/backend/art/vendor hash and all boundary checks intact.
   The expected hashes are fixed values, not computed from the file under test.
2. Prove the root reload using a main-frame navigation event registered before
   `page.reload`, its successful HTTP response, and the navigation request/frame.
   Do not depend on an optional Navigation Timing record. Retain every existing
   account, cloud/checkpoint, no-reseeding, request-count and durable-state check.

With those proposals, the separate graphics-plus-PR61 build passes both tests
(**2/2**), including actual WebGL, narrow-screen hosting, close while loading,
return/reopen, backgrounding, account transition and root reload. The fixture uses
synthetic Telegram/account/API responses. It is not physical-phone or production
account validation. `pr61-proposed-fix.log` records the passing run.

This patch is a handoff for the PR61 owner, not an assertion of cross-chat delivery
or approval. Do not overwrite PR61 or merge stale world.js over its lifecycle hooks.
Before publication, review the exact patch against the then-current PR61/main,
combine the graphics and approved entry, and rerun the full combined suite.

The separate `RENDERER_PROPOSAL.md` lists a shared renderer option for coordination.
It is intentionally not implemented in this graphics stage.
