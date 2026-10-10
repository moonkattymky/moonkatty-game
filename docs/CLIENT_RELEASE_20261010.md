# Client-only release, 10 October 2026

This release is composed from tested PR54 artwork and recovery changes on current
production main `61b514c8e6f350dfb05304890d861f0bee089be0`. It is deliberately not
an unconditional merge of the draft stack. Exact release CI and deployment must
be checked for this combined commit; earlier draft results do not certify it.

## Included

- Updated home, Chapter 1 lunar worksite and Chapter 2 crew workshop presentation.
- Clear next-stage guidance, compact reachable controls, focus/hint contrast,
  Settings scroll reset, malformed local record recovery and scoped failure navigation.
- Chapter 1 entrance/cancel/resize collision-geometry refresh.
- Device-storage and cloud-conflict recovery, durable retry guards and protection
  against oversized snapshots being silently truncated by the existing server.
- Durable pending reward retries and compatible request timeouts.
- Echo and closing-gate terminal checkpoint restoration and valid-phase-only
  reactor checkpoint writes. Their existing finale win rules are unchanged.

The neutral Chapter 2/3 videos, gameplay amounts and existing non-monetary legal
wording are retained. No bot URL/configuration change is included.

## Existing backend compatibility

The live `campaign.open` seed/edition/reset handshake and `proofFor` construction
are retained from the pre-trusted-route recovery client. Story opening registers
that route immediately, and explicit replay registers its reset after creating
the new plan. The latest optional trusted-route API is not exported by this
release client, so authenticated play is not blocked waiting for an unavailable
challenge version. Existing account-scoped state/callback checks remain active.

Codec, storage, rewards and cloud-save ship together. The old backend advertises
no compact-trace capability: only raw legacy actions are used. Safe byte limits
are checked before upload; oversized progress/evidence stays on the device or in
the retry queue with a warning. Compression is not enabled in production by this
client release. Do not clear device data to resolve that warning.

The existing API version marker remains `20261009-prelaunch-1` for the current
health-check contract. Changed client resources have separate cache query
versions. `build.json.sha` identifies the exact deployed client commit.

## Explicitly deferred

- Trusted random route issuance, legacy-route migration/restart policy and matching
  rewards handler rollout. No live migration or backend deployment is performed.
- Atomic moderation admission backend rollout and infrastructure/load guarantees.
- Convoy cells-bound restoration: an earned 7-cell preparatory-stage checkpoint
  is accepted by the draft fix but rejected by the old live verifier. Its original
  bound remains until both sides can be released together. No proof is clamped or
  rewritten to hide that mismatch.
- Chapter 3 modular artwork until its exact browser/full checks pass.
- Chapter 1 finale-verifier prototype and all authoritative finale integration.

Known existing reward-integrity gaps therefore remain. This release does not
claim financial-grade security, proof of human play, or a production capacity.
The minimal server-source oversized-snapshot rejection is retained for regression,
but the live client independently enforces its bounds before calling the old API.
Generated field/codec server model files are source mirrors used by regression
checks; GitHub Pages excludes `server/` and `supabase/`. No function code or
migration is executed by the static deployment.

## Verification and publication

Run every applicable `tests/*.cjs` through the unchanged aggregate runner; run
both real-controller screenshot workflows on the exact release head. Dedicated
compatibility tests exercise the production clients against the old handler and
isolated synthetic database. No signed production account is used by CI.

Merge only after all release-head checks pass. The existing Pages workflow runs
the aggregate again before deployment and verifies live byte equality plus
`build.json` SHA. The byte inventory includes the new codec, recovery controllers,
art renderer, CSS and lunar image resources. Check the actual website in the
cloud browser afterward. Telegram WebView and physical iPhone/Android behavior
still need the owner's device test through the existing bot.

## Recovery and rollback

The previous production source is the immutable public main commit above; keep
it and the release source archive. Keep all draft branches intact for review.
A whole-client rollback is not safe during an interrupted cloud-restore
transaction: the old client does not understand the new durable retry metadata.
For a visual regression, roll back the presentation-only files while retaining
the new compatible storage/cloud/codec/rewards recovery bundle, then retest.
For a persistence regression, preserve saves and use a reviewed fix-forward or
explicit recovery plan. Do not automatically replace the entire client with an
old bundle, clear storage, reclassify routes, or change confirmed balances.
