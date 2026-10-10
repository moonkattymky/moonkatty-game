# Optional save transport and Convoy recovery candidate

Source base: merged client `40d89a9a5a73b1ea387d074cf1dc237e5fc0229e`.
Its publication is verified separately from this draft.
This is a source/test candidate. No backend deployment or database migration has
been performed. Do not merge its client model before the matching backend is
explicitly approved, deployed and verified. Keep parallel graphics work separate.

## Scope and preserved behavior

- Use the already-reviewed lossless trace codec for optional versioned cloud and
  completion transport. Every original replay action and floating-point value is
  decoded before the existing model verification; no traces are pruned.
- The shipping entrypoint explicitly sets `traceTransport:false`, ignoring any
  existing activation environment flag. A separately approved source release can
  enable it; then session/player responses advertise `trace_codec` and the client
  negotiates `campaign.cloud.v2` and `life.complete.v2`. Old clients keep the legacy
  actions and receive expanded raw snapshots, including conflict responses.
- In enabled mode, every cloud upload, including a legacy action, is canonicalized
  to compact storage before the existing atomic revision RPC. In default mode,
  reads still decode, v2 actions are refused, and uploads stay raw within old byte
  limits. Invalid/oversized data is rejected before a write, never partially saved.
- Match the reviewed Convoy checkpoint bound on both model copies. Format 1 stays
  capped at 6. Format 2 derives its maximum from 3 starting cells, the existing 0–2
  modifier and three once-only pickups, preserving fractional addition order.
- Preserve the current seed/edition/reset route API, account verification,
  database schema, completed rewards, point amounts, event idempotency and stage
  rules. No trusted-route restart policy or finale verification is activated.
- The body reader counts UTF-8 bytes while streaming, retaining the 400,000-byte
  HTTP budget. Existing codec entry, aggregate, expansion and replay limits remain.

No artwork, image/video, renderer, stylesheet, gameplay controller or store is
changed. `index.html` changes only the model cache query. Existing test fingerprints
are updated only for the intentional model correction; their budgets stay intact.

## Compatibility evidence

Tests execute actual current and historical clients with in-process handlers and
an isolated synthetic PGlite database. Historical server/client/model fixtures are
pinned to published 61b514c source. Coverage includes unchanged route registration
and reset, recorded eight-stage Chapter 1 proof replay, one 500-point award and
idempotent retries, compact/raw cloud downloads and conflicts, preserved snapshots
on rejection, model continuation, and actual Convoy save/reload/Continue controls.
The latter browser suite requires GitHub CI; local VM/source results alone do not
certify it. No signed production account or physical phone is used.

One valid four-minute flight fixture with 12,000 changing control rows has a
387,381-byte checkpoint and 121,413-byte packed checkpoint. It replays identically
and continues for 600 simulation ticks. This is a fixture measurement, not a
whole-campaign size guarantee. Incompressible or larger legitimate sessions can
still hit fixed limits; the client retains local evidence and displays a warning.

## Required approval and rollout order

1. Finish exact-head CI and review the final source diff. Preserve the deployed
   backend package and current database backup through the owner's normal backup
   process; do not create credentials or alter access as part of this candidate.
2. Obtain explicit approval to deploy this specific `rewards` function package
   in decoder-only mode. Keep the explicit `traceTransport:false` entrypoint. No schema change
   is required. Approval for static Pages does not cover this function.
3. Deploy the decoder-compatible handler and generated models through the approved
   existing flow. Verify health, absent compact advertisement, raw roundtrip and
   conflict behavior with an owner-approved disposable account. Establish that
   every serving instance uses this decoder and old in-flight handlers have
   drained; mixed old/new readers must not share newly compact records.
4. Obtain separate activation approval and review the entrypoint source change
   before enabling compact transport. Environment settings cannot activate this
   release. An enabled entrypoint advertises support and compacts all cloud uploads,
   including requests from old clients. Verify compact/raw roundtrip and conflict
   behavior without changing real balances. Existing live clients opt in on their
   next capability refresh; this is a server-side activation, not a Pages gate.
5. Only after the matching handler is verified, publish the Convoy client model.
   Its recovery correction is independent of compact transport and may follow
   the verified decoder-only deployment. Recheck current main and preserve any
   separately developed graphics changes.
6. Verify exact Pages build SHA/resources and normal restore. Physical Telegram
   account switching and long-session saving still need device acceptance.

Existing open documents may cache a negative capability result until a new
session/player refresh or reopen. They remain on the legacy raw path meanwhile.
Lack of advertised support keeps clients on the raw path. Generic backend errors
retain the cached capability and pending work; explicit unsupported action/protocol
responses downgrade it. Decoder-only mode therefore stops compact requests safely,
while large work may remain pending until enabled service returns.

## Rollback and remaining limits

A plain rollback to the pre-codec backend is unsafe after compact records are
stored: it cannot expand them for older clients. A reviewed rollback must retain
the codec reader/raw-response adapter, or losslessly migrate every packed record
back within the old limits first. The latter can be impossible for a legitimate
large snapshot. The explicit off mode stops compact writes but retains decoding. Merely removing
advertisement from an otherwise compact-writing handler would not do so, and
neither choice makes the pre-codec handler safe.
Prefer a decoder-preserving fix-forward; do not clear saves or pending evidence.
Similarly, do not revert the Convoy bound after legitimate 7/8-cell saves exist.

The original user-selected route-seed design and missing authoritative finale
proof remain separate known reward-integrity gaps. This patch does not claim to
fix them, certify financial security, establish human play or support 10,000
concurrent players. The separate moderation/trusted-route migrations are absent.
