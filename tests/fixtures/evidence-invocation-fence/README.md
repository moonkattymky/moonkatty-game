# Native invocation-fence candidate

Prepared source only. Native execution is restricted to approved GitHub CI;
this fixture deliberately refuses ordinary local execution. It does not change
or activate a workflow, listener, runtime import, server, account, or save.

The driver fixes `Date.now` to `2026-10-12T12:00:00Z` with
`page.clock.setFixedTime`. Native IndexedDB execution and watchdog timers remain
real. This is not general gameplay-time or wall-clock timing evidence.

The bounded driver is `tests/evidence-invocation-fence-ui.cjs`: 44 isolated cases,
including both prepared-operations final handlers' 24 native write failures and
two successful ends. It loads the actual unchanged full index at one synthetic
HTTPS origin using a finite file cache. All unexpected requests are blocked and
fail the evidence run. Runtime source pins and complete source hashes are checked
before/after; the executing clean commit must equal the CI commit.

Preparation rounds, prior chapter progress, and the already-won final checkpoint
are explicit synthetic prerequisites. The driver enters through the original
`MKTYOps.open`, resumes/finishes the actual original field controller, holds that
controller's original completion closure, and calls it only through a freshly
committed/read-back invocation fence. The original writer contract observes and
forwards the actual writes. The chapter-9 epilogue is displayed but not continued.

A failure is injected below the original `MKTYStorage` facade before one native
write. The original callback then returns using the original RAM overlay. These
are native write-failure observations, not abrupt execution interruption or
process/power-crash evidence. Two failed midflush cases separately expose the
latest-value overlay map, which need not produce an original callback prefix.

The driver next actually navigates to `inspect.html`, a source-only document with
no gameplay handlers, original closures, or storage facade. BFCache is disabled
and `pagehide.persisted` must be false. Original pagehide/blur/visibility handlers
are never removed or suppressed: their real logical/native writes are recorded
through a Node binding, and the new document's retained native values must equal
the original native prefix plus all observed successful lifecycle writes. Only
bounded known background writes and the original prepared-operations pagehide
rewrite are accepted. Unexpected lifecycle writes fail rather than being hidden.

Inspection runs twice on retained real IndexedDB and native localStorage, changes
neither archive bytes nor native game values, and never enables play, continuation,
callback invocation, original save retry, or award work. RETURNED means observed
same-realm return only; it is never an exact durable DONE acknowledgment.

Additional native cases cover an empty database, old unjournaled context/phase,
PREPARED only, ISSUED before invocation, return without a RETURNED receipt, actual
append/read aborts, actual committed but held acknowledgment with the adapter's
real timer, exact duplicate retry, and current-identity change after readback. The live fixture separately requires exact
prepared-operations core bytes from both the original facade and native storage
before invocation; the journal helper trusts that integration guard. An actual
old-writer operations mutation after PREPARED must block ISSUED. Once invoked, the
fixture observes the original writer and its RAM/native outcomes without treating
legitimate write-failure prefixes as an identity change.
A separate incomplete-history case appends one canonical standalone RETURNED
through the ordinary native adapter, with absent PREPARED/ISSUED dependencies,
then verifies that a fresh attempt discovers it and refuses before any additional
journal or original writes. No records are deleted or metadata rebuilt.
The existing adapter tests own broader native quota/schema/capture-bound matrices.

The synthetic namespace is `native:fence`; it is deliberately short enough for
the existing 5,120-byte journal metadata envelope. Longer identities that exceed
that envelope must refuse intact, rather than increasing the limit. In the exact
source-only probe of the prior 29-character `invocation-fence-native:guest` scope
with `disposable-guest:1`, PREPARED succeeded (metadata peak 5,054 bytes), while
ISSUED refused before append: its prospective overlap was 5,166 bytes, 46 above
the unchanged limit. Only PREPARED remained; no original callback ran and no
candidate/page slot remained. This is source-probe evidence, not a native case.

The journal and phase ledger retain their existing limits. Diagnostic strings,
trace snapshots, payload digests, and report objects are separately bounded test
observations and are not a browser heap/RSS measurement. The fixture makes no
claim about arbitrary old writers, authentication, cross-tab leases, restoration,
eviction, or exactly-once server/financial settlement.
