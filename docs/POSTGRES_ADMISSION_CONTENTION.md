# PostgreSQL admission contention regression

## Scope and current verification status

`.github/workflows/postgres-admission.yml` runs the exact additive migration
`20261009153246_atomic_submission_admission.sql` on an empty PostgreSQL 17 service,
with the repository schema and its prerequisite migrations. It uses synthetic
players, URLs, proofs and timestamps only. No production credentials, migrations,
rewards policy, gameplay code or deployed state are changed.

The harness is prepared for CI. At preparation time, this workspace had no `psql`,
PostgreSQL server or Docker, so **real PostgreSQL execution has not been verified**.
The PGlite fixture/expectation check and pipe-only driver unit tests are local
checks; neither is evidence of contention. A green run of the new workflow is
required to establish the independent-session result. Existing PGlite coverage
and the browser workflow retain their separate purposes.

This is a bounded correctness regression. It does not measure throughput, latency,
production concurrency capacity, pooler behavior, PostgREST integration or real
user traffic. Authorized staging rehearsal remains a release gate.

## What makes the sessions genuinely concurrent

The Node runner uses only built-ins and starts exactly two persistent `psql`
processes. It checks distinct `pg_backend_pid()` values. Both writers run as
`service_role` with READ COMMITTED isolation.

For every scenario:

1. Session A begins a transaction and completes the first actual RPC or legacy
   INSERT, leaving its transaction and admission player lock open.
2. Session B starts the competing writer while A is still uncommitted. B cannot
   be awaited serially, because that would deadlock the harness until its deadline.
3. A temporarily resets its role to inspect the server (it keeps its locks). It
   polls `pg_stat_activity`, `pg_blocking_pids(B)` and `pg_locks`, clearing the
   statistics snapshot between checks. The test requires B's expected statement
   to be active, waiting on a lock, with A reported as blocker and an ungranted
   lock recorded. Same-player cases also require A's player-table RowShareLock.
   It fails if B finishes before that evidence exists. No third connection or
   sleep-duration assumption establishes the result.
4. Only after printing this evidence does A COMMIT or ROLLBACK. B then must return
   the expected response, and the stored rows are checked.

The same-player wait exercises admission's player-row coordination. Cross-account
canonical duplicates exercise the global unique key's transaction wait instead.

## Coverage: 32 observed waits

- Creator weekly, social daily, social follow and social pending-cap quotas:
  RPC → RPC, legacy INSERT → RPC, and RPC → legacy INSERT, each with COMMIT and
  ROLLBACK (24 scenarios). Pending-cap scenarios start with two committed rows.
- Creator and social identical owner retries, plus private cross-account canonical
  duplicates, each with COMMIT and ROLLBACK (8 scenarios).
- After COMMIT, quota checks must see the now-committed row; RPC errors must be the
  exact expected object. Old INSERTs must fail with SQLSTATE P0001 and the expected
  limit message. Retrying the same owner/key must return the unchanged original
  row. A cross-account duplicate must return only the generic duplicate error.
- After ROLLBACK, the blocked writer must succeed and the first row must be absent.
  Each contested slot has exactly one surviving row. Legacy social dates must be
  normalized to UTC. Pending admissions must leave balances and reward events zero.

The SQL fixture has 100 synthetic players. No parallel load loop, browser matrix,
new npm package or package-lock change is needed.

## Safety, bounds and cleanup

The runner refuses to start without `MKTY_PG_TEST_DISPOSABLE=1`. It ignores inherited
libpq connection settings, service files, password files and DATABASE_URL; the host
is fixed to 127.0.0.1, database to `moonkatty_admission_test`, and credentials to the
public fixture-only values below. Only a validated loopback port is configurable.
Do not point that port at a tunnel or an existing service. Opting in means the
entire cluster is disposable, including the three test roles.

Before creating anything it verifies PostgreSQL major 17 and an empty user schema.
Bootstrap runs in one transaction and fails closed if the fixture roles already
exist. There is no DROP/TRUNCATE reset that could erase an existing database.
A second run requires a fresh service.

The CI job is limited to 8 minutes; its service to 1 CPU and 512 MiB. The runner has
an overall 150-second deadline, an 8-second observation deadline per case, 12-second
lock timeout, 15-second statement timeout, 20-second idle-transaction timeout and
20-second client-command timeout. Output buffers are capped. Assertion failures,
interrupts and timeouts close both clients; open transactions roll back when the
connections close. Client shutdown escalates to SIGKILL after one second. GitHub
Actions destroys the service at job teardown. A manually started service must be
removed by its owner using the cleanup below, including after failures.

## Exact invocation

CI check: **PostgreSQL admission contention / contention**. It runs independently
of `model-tests.yml` on matching pull-request changes. It is also reusable through
`workflow_call` and supports `workflow_dispatch`. It is intentionally not wired to
publish/deploy the site or apply a live migration.

The workflow executes:

```sh
MKTY_PG_TEST_DISPOSABLE=1 MKTY_PG_TEST_PORT=<mapped-service-port> \
  node tests/postgres/submission-admission.cjs
```

Once the workflow is published and available for dispatch (GitHub requires it on
the default branch to expose manual dispatch), an authorized CI operator can use:

```sh
gh workflow run postgres-admission.yml --ref <published-branch>
```

A PR containing this new workflow runs its `pull_request` trigger without needing
manual dispatch. Review the checked-out SHA and all 32 WAIT/PASS pairs in the log;
do not infer a pass from a PGlite or browser job. This patch has not been uploaded,
pushed, dispatched or deployed as part of local preparation.

For an explicitly authorized local run with Docker and `psql` already available:

```sh
# Run from the repository root, in a dedicated shell. No production secrets.
set -eu
name=moonkatty-admission-fixture-$$
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT INT TERM
docker run --detach --name "$name" --cpus=1 --memory=512m \
  -e POSTGRES_DB=moonkatty_admission_test -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=mkty-local-fixture-only \
  --publish 127.0.0.1::5432 postgres:17
ready=0
for attempt in $(seq 1 30); do
  if docker exec "$name" pg_isready -U postgres -d moonkatty_admission_test; then
    ready=1; break
  fi
  sleep 1
done
[ "$ready" = 1 ]
port=$(docker port "$name" 5432/tcp | sed 's/.*://')
MKTY_PG_TEST_DISPOSABLE=1 MKTY_PG_TEST_PORT="$port" \
  node tests/postgres/submission-admission.cjs
```

Offline companion checks (no PostgreSQL server needed):

```sh
node tests/postgres-admission-driver.cjs
node tests/postgres-admission-sql.cjs
node tests/submission-admission-sql.cjs
```

The first uses a pipe-only fake executable; the second validates the shared fixture
and all expected outcomes sequentially in PGlite. Both are discovered by the normal
`tests/run-all.cjs` suite. The real test lives under `tests/postgres/`, so the browser
suite never accidentally starts it or requires a database service.

## Primary references

- [GitHub PostgreSQL services and mapped ports](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers)
- [GitHub manual dispatch requirements](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
- [GitHub-hosted Ubuntu 24.04 software, including PostgreSQL/psql](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)
- [PostgreSQL 17 row locks and transaction lifetime](https://www.postgresql.org/docs/17/explicit-locking.html)
- [READ COMMITTED snapshots](https://www.postgresql.org/docs/17/transaction-iso.html)
- [Volatile function snapshot behavior](https://www.postgresql.org/docs/17/xfunc-volatility.html)
- [Backend identifiers and pg_blocking_pids](https://www.postgresql.org/docs/17/functions-info.html)
- [Activity views and statistics snapshot refresh](https://www.postgresql.org/docs/17/monitoring-stats.html)
- [psql SQLSTATE, LAST_ERROR_MESSAGE and ON_ERROR_STOP](https://www.postgresql.org/docs/17/app-psql.html)
