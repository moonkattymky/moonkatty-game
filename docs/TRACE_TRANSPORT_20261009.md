# Lossless replay transport v1

Source-only change. No database migration, deployment, pruning, reward change, or retention-policy change is included. Art, video, model physics, tick rates, input quantization, and points are unchanged.

## Format and boundaries

`trace-codec.js` is the dependency-free browser/CommonJS source. `tools/build-server-models.cjs` generates its identical Edge ESM module. A compact trace is still an array:

`[["mkty-trace", 1, rowCount, tickCount, canonicalBase64], ...rawTail]`

Only one marker is allowed, at the start. The binary frame stores each original row independently. Tick records distinguish field and flight shapes, flags, a bounded minimal unsigned varint count, and each exact axis. Signed 16-bit millisteps are used only when decoding exactly recovers the original number; otherwise finite float64 is used, including negative zero. Other JSON row shapes use bounded literals. No tick is expanded into additional replay rows, merged with another row, requantized, omitted, or reordered.

Malformed frames, unsupported versions, nested/misplaced markers, invalid base64, truncated fields, nonminimal varints, and inconsistent counts fail closed. Decode has running per-entry and aggregate byte budgets. Row and simulation-tick limits remain 25,000 and 200,000 per trace.

Cloud values must be less than 180,000 UTF-8 bytes each; the JSON-escaped snapshot must be at most 350,000 bytes. Expanded values are limited to 1,000,000 bytes each and 2,000,000 bytes in aggregate. Proofs have a 1,000,000-byte expanded budget. Full HTTP requests, including authentication and JSON escaping, are capped at 400,000 actual bytes. The server counts streamed bytes independently of Content-Length. Existing database limits are unchanged. An incomplete or memory-only device store is never uploaded as a replacement snapshot; read failures during capture retain dirty state and the existing recovery warning.

Packing happens on copies at cloud/proof transport boundaries. A bounded lossless JSON serializer preserves negative zero in proof HTTP bodies even when a short trace stays raw. The new browser normally retains raw local traces. All downloaded or staged snapshot values are decoded before any restore writes begin. Conflict choice still stages a restore for the next document, after outgoing controllers finish pagehide saving. A durable restore transaction retains the first outgoing recovery copy across quota failures and repeated reloads. Failed applications reconstruct one coherent outgoing snapshot through the storage adapter before controllers initialize; successful applications commit before clearing the staged copy. A committed cleanup retry cannot replay stale cloud data over newer gameplay.

Restore state transitions remain local to the device:
- `applying`: the pending cloud choice and original recovery are durable before live-key changes. An interrupted write rolls back to the coherent outgoing copy.
- `local`: successful “Retry saving” or subsequent durable gameplay pauses the pending restore. Reload preserves the local continuation; the cloud copy requires explicit selection again. A single internal storage-success event also protects play made while storage was memory-only and then persisted by Retry saving. After a native storage failure, writes stay in the memory overlay until that explicit retry succeeds; an opportunistically recovered native store cannot persist a checkpoint while leaving older transaction metadata behind. A coherent retry guard is persisted before any explicit retry flushes live keys, so a later metadata-write failure cannot expose newer gameplay to an old applying marker. Startup prioritizes that guard; it is removed only after the local phase is durable. Checked metadata reads distinguish an absent guard from an unreadable guard; unreadable recovery state blocks fallback and uploading until the authoritative guard can be recovered. Retry aborts before live writes if any guard-preparation read fails. Without a restore transaction the hook/event is a no-op.
- `retry`: explicit cloud re-selection captures the latest outgoing copy after final pagehide saves, separately from the first recovery, before applying the remote. Both outgoing copies remain recoverable.
- `complete`: all restored keys and revision are durable before pending cleanup. Cleanup failures never reapply stale remote data over later gameplay.

An orphaned applying marker with missing pending data rolls back once and settles to local when durable. Legacy account migration stages the complete source and destination reads before copying anything. Read failures defer migration, and Retry saving must finish that staging before flushing or reporting success. Existing or newly played namespaced values, including queued deletions, take precedence; only untouched missing destination keys are copied. The ownership marker follows all copies, and unnamespaced originals remain untouched. This prevents both partial read/write migrations and later re-copying over newer account progress.

Normal successful gameplay does not serialize extra snapshots or poll storage; the additional snapshot copy is limited to an explicitly retried interrupted restore. Pending reward intent is persisted before awaited route/proof work.

## Negotiation and rollback

Authenticated session/player responses advertise `capabilities.trace_codec = "mkty-trace-v1"`. Compact requests use separate `campaign.cloud.v2` and `life.complete.v2` actions and an exact protocol value. A new client requires the protocol acknowledgement and a valid advanced cloud revision before clearing dirty state. Unsupported cached capabilities after a server rollback fail safely; packed data is never sent under a legacy action by the new client.

- New client + new server: compact cloud/proof transport, bounded lossless expansion on receipt.
- New client + old server: raw legacy transport only if it fits the same safe entry/aggregate/request limits. Oversized evidence stays local or queued with a visible warning.
- Old client + new server: ordinary cloud reads and conflicts return expanded arrays. The server accepts raw proof and packed-prefix-plus-raw-tail proof and applies the same replay checks.
- Old client + old server after a packed save: current old controllers preserve the array marker, append ordinary rows, and save/reload it intact. The old verifier rejects the marker, so an unpaid packed proof cannot settle until the codec-capable backend returns. An old generic error may suggest replay even though the evidence is still present. Oversized expanded saves may also be refused.

The HTML loads the new codec before both clients and bumps the codec, storage, rewards, and cloud-save cache versions. The storage version supplies both the successful-retry event and the memory-only write guard, which are correctness dependencies of interrupted restore recovery. Publish these static assets together: mixing stale HTML without the codec with updated dependent clients can temporarily prevent synchronization until the complete bundle is loaded; local evidence remains intact.

Keep the matching new storage/cloud/codec bundle through interrupted-restore recovery. Pre-batch cloud-save.js does not understand paused/local/retry-guard metadata and may process the old pending-restore key unconditionally. The verified old field/flight controller compatibility does not establish safe rollback of the whole frontend during such a transaction.

This is not seamless all-version rollback. PR39 remains the minimum rollback floor for protection against silently truncated cloud entries. Source tests run the actual old field/flight controllers without loading the codec and exercise resume, input/action append, RLE, blur/pagehide save, reload, and subsequent exact decode. A separate browser suite is intended for exact-head CI.

## Capacity and limits of the claim

The synthetic 12,000-row `big` fixture in `tests/trace-codec.cjs` measures 419,269 raw trace-array bytes and 112,033 compact trace-array bytes using `Buffer.byteLength(JSON.stringify(value), "utf8")`, a 73.28% reduction. This excludes the enclosing checkpoint and campaign. `tests/trace-codec-models.cjs` separately measures complete real-model saved-state entry strings with `Codec.utf8Bytes`: field 284,021 → 112,761 and flight 430,655 → 121,764 bytes, each with 12,000 varying tick rows and actions.

Packing substantially reduces a long alternating-control trace, but cannot guarantee unlimited campaign storage. Multiple long chapters or incompressible legacy data can still hit the encoded or expanded caps. Those failures retain all available evidence and remain visible; this change does not delete settled proofs, archives, checkpoints, or live data.

Packing is not proof of human play or financial-grade security. Existing account/route verification and replay checks remain mandatory. The separately identified finale-proof gap is unchanged.
