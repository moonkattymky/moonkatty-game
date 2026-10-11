# Compact save transport activation

Base: published `436ed2e8a3bdf08548c95f0568d66c0799235e7c`.
This release changes the explicit `traceTransport` option in
`server/rewards/index.ts` from `false` to `true`. It does not change the codec,
models, authentication, point amounts, reward event rules, database schema, client
scripts, artwork, or bot configuration.

## Deployment boundary

- Deploy only the existing `rewards` function. Its reviewed package has 15 files;
  the entrypoint is the only production file changed by this release.
- Before preparation, active `rewards` version 19 and `telegram-progress` version
  18 were downloaded. Every file matched the corresponding repository source.
  Both already contain the codec reader. Their complete source and deployment
  metadata are retained in a private rollback archive.
- Preserve the existing deployment authentication setting. The existing handler
  continues to verify Telegram init data or its existing account-bound session.
  Do not enter or change secrets, access settings, credentials, or migrations.
- Keep `telegram-progress` unchanged. It remains the small legacy action adapter;
  do not advertise or route v2 operations through that URL.

## What activation does

Authenticated session/player responses advertise `trace_codec`. Compatible
clients then use `campaign.cloud.v2` and `life.complete.v2`. The two versioned
operations change representation only. Every original replay value is decoded
before the existing model checks; no evidence is pruned.

All subsequent cloud uploads, including legacy raw uploads, are canonicalized to
compact storage before the existing atomic revision update. Old clients receive
expanded raw data on reads and conflicts. Existing stored records are not bulk
rewritten. Open clients may retain their previous negative capability result until
the next player/session refresh or reopen; their raw requests remain supported.

## Required evidence before and after deployment

1. Independent review and full exact-head CI, including actual shipping-entrypoint
   execution, current and pinned older client compatibility, strict size limits,
   continuation after roundtrip, conflict preservation, committed-but-lost cloud
   receipts, and idempotent retry after a lost completion receipt.
2. Explicit decoder-only rollback tests, including cached-capability downgrade,
   raw reads/conflicts, retained oversized local work, and successful reactivation.
   Synthetic SQL fixtures are isolated; tests must not alter real player rewards.
3. Recheck deployed baseline metadata and source before mutation. Deploy the
   reviewed package using the existing entrypoint and authentication settings.
4. Retrieve the new deployed source and compare every file with the approved
   package. Verify public health and that `telegram-progress` stayed unchanged.
   These checks do not prove a signed Telegram save.
5. The owner performs normal save/reopen and second-device restore in Telegram.
   Until that acceptance is observed, production authenticated end-to-end and
   cross-device restore remain pending. Do not request or copy authentication
   tokens, reset progress, or fabricate production reward events for testing.

## Limits remain finite

The codec limits are unchanged: each packed snapshot value must be under 180,000
UTF-8 bytes, the complete snapshot at most 350,000 bytes, and the entire request at
most 400,000 bytes. Decoded limits are 1,000,000 bytes per snapshot value and
2,000,000 bytes in aggregate; decoded completion proof is limited to 1,000,000
bytes. Each trace is bounded to 25,000 rows and 200,000 replay ticks.

The existing four-minute flight fixture has 12,000 changing control rows and
shrinks its checkpoint from 387,381 to 121,413 bytes, with identical continuation.
This is one fixture, not a nine-chapter or unlimited-session guarantee. Histories
accumulate, compression ratios vary, and device storage has its own limits.
Oversized or invalid requests must reject the whole operation, retain local
evidence and pending intents, and leave the prior server save intact.

## Safe rollback floor

Use the archived version-19 decoder-compatible package, with explicit
`traceTransport:false`, if rollback is required. It stops new compact writes and
advertisement, refuses v2 requests, and still expands existing compact records for
legacy clients. A cached v2 capability is downgraded on explicit unsupported
responses; oversized work remains local and pending until service is restored.

Never restore the pre-codec backend after compact records exist. Expanding every
record back into the old storage limits may be impossible for legitimate large
progress. Do not delete records, traces, or pending reward evidence to make a
rollback fit. Prefer a decoder-preserving correction.

Trusted route issuance, authoritative finale verification, moderation admission,
financial reward eligibility, and concurrency capacity are separate release
questions. This transport activation does not certify or activate them.
