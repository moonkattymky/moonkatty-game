# PR61 compatibility review — latest entry plus graphics

Production main: `00e391ffe0bb2ed663a7e3136cf382b0030857b4`.
PR61 head checked: `9af41ee97e704bbf77353787aff24971c040cd4d`.
Graphics source: `bd8636b827f6a708ea756033068aeac8a65f5d41` (full CI passed).

A detached worktree overlays only `graphics-preview/scene.js` and `world.css`.
PR61's Home integration, world.js pause/dispose/loading lifecycle, auth/account
code, game controllers, rewards and every save format remain intact.
No actual PR61 branch, main or production hosting was modified by this review.

## Latest passing evidence

The current combined candidate passes `preview-entry-source.cjs` and
`preview-entry-ui.cjs` (**2/2**); see `pr61-latest-compat.log` and the report.
It tests actual WebGL, narrow/landscape hosting, movement/pause, close while loading,
return/reopen, backgrounding and preservation of existing account/cloud/checkpoint
state after root reload. Telegram, accounts and APIs are synthetic fixtures;
physical devices and production accounts are not claimed as tested.

The only temporary test change is the exact two visual SHA256 updates in
`PR61_REVIEW_PATCH.diff`. All other frozen file hashes and assertions stay intact.
Those reviewed hash updates are a proposal for the entry/integration owner, not
an applied change to PR61. Do not remove file-boundary tests or derive expected
hashes from the current source under test.

## Previous failure was already fixed by the PR61 owner

The older head `3779a5f0424751a3b2eab0ab4479186fedae24d1` reproduced an empty
Navigation Timing entry during root reload. It failed unchanged and with graphics;
GitHub run 38071207661 ended 79/80. Baseline and earlier proposed-fix logs are kept
as historical evidence, not current failures. Our earlier navigation-response
proposal is preserved in the previous graphics commit history only.

The PR61 owner has independently replaced that assertion in head 9af41ee with a
fresh document token and preserved root-request checks. The test installs a mocked
clock; its Performance timeline is not a reliable root-reload proof. The current
compatibility run uses the owner's updated UI test unchanged. Do not reapply the
obsolete navigation-response patch or overwrite the newer test.

## Publication gates

Keep PR61's current lifecycle hooks and root entry when combining with latest main.
Review the two graphics hashes, run the full combined suite after integration,
and validate physical Telegram Android/iOS before publication. The full 80-test
combined candidate is not claimed as completed here. The shared antialias option
is listed in `RENDERER_PROPOSAL.md` and remains unchanged pending coordination.
