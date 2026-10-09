# Release recovery audit — 9 October 2026

This is a bounded release-candidate patch based on main `61b514c`. It preserves
all artwork, chapter rules, balances and the current neutral LIFE #2/#3 videos.
It introduces no new mechanic, purchase, database migration or production deployment.

## Correctness fixes

- Persist a chapter-completion retry before awaiting its network-backed route proof.
  Preserve saved proof when it cannot be rebuilt. An old offline life debit rejected
  with `no_lives` no longer blocks earned chapter rewards behind it.
- Use a cleared `AbortController` timer for network requests instead of requiring
  `AbortSignal.timeout` in the player's mobile WebView.
- Stage an explicitly selected cloud save for restoration at the next document's
  startup. The outgoing game's `pagehide` handlers can no longer overwrite that
  save. Preserve the final outgoing local snapshot as the existing recovery copy.
  Do not reload to restore while device storage is memory-only.
- Refuse oversized cloud snapshots without dropping a chapter. The new client
  checks the existing limits before uploading, protecting it even against the
  currently deployed server. The server source rejects an oversized allowed entry
  or aggregate with HTTP 413 / `snapshot_too_large` before changing its revision.
  Local progress stays intact and dirty; the warning explicitly says that this
  route currently remains on this device only.
- Recover valid-JSON but malformed life-charge and daily-demo records. Preserve
  one-charge-per-failure behavior after recovery.
- Keep delayed zero-life redirects scoped to the failed scene, so they do not
  hijack a newer destination.
- Restore a clearly visible gold power-grid hint, with a `?` marker as well as
  colour, and increase powered-path contrast. Reset console scroll on navigation
  so Settings and other screens open at their headings.

## Verification

New deterministic suites: `tests/rewards-recovery.cjs` and
`tests/runtime-recovery.cjs`. The production client/modules are loaded directly;
these are not substitutes for browser or physical-device testing.

Expanded regressions cover the real browser cloud-restore/reload flow, power-grid
hint styling, console navigation and a real PGlite-backed cloud rejection that
leaves the earlier snapshot/revision untouched. Existing CI runs every suite.

Local Chromium launch is blocked by the execution environment's socket policy.
The local aggregate therefore reports environment-blocked browser suites, not a
complete pass. Use the exact draft-PR head's full GitHub Actions result as the
browser/model gate. Physical iPhone, Android and signed Telegram checks remain
required. No live player state was used in these regression fixtures.

## Remaining release gates

- Approve and deploy the source-only rewards-function change separately. There is
  no migration. New-client/old-server protection and new-server refusal are tested;
  old clients will retain their dirty save after the server refusal, but their
  generic retry message lacks the new size explanation.
- Complete the existing owner/legal-contact, real Telegram login, bot configuration,
  platform-policy and physical-device gates in `PRELAUNCH_20261009_RU.md`.
- Large flight traces still need a durable size solution before claiming reliable
  cross-device continuation for every long route. This patch prevents silent loss;
  it does not raise limits or make an oversized route sync successfully.

### Follow-up design for long routes

Separate the resume checkpoint from reward evidence, with an explicit versioned
schema and server validation. Keep the compact physical state needed to resume in
cloud saves. Store verified action evidence independently in bounded chunks, or
apply lossless trace encoding that preserves deterministic replay. Never discard
reward proof, round control inputs, or change existing seeds to save space.

Before rollout, test legacy migration, interrupted chunk transfer, idempotent
commit/receipt, account isolation, conflict selection, the longest legal flight,
proof replay parity and total per-user limits. Measure payload and write frequency
under realistic touch input; do not infer concurrent-user capacity from CI.
