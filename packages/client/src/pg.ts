// A Db backed by a REAL Postgres — the dev/test sibling of node.ts's two pglite providers (#265, #266).
//
// Why bother, when pglite already speaks Postgres? Because pglite silently IGNORES `SET statement_timeout`
// (single-threaded WASM, no cooperative-cancel path — `pg_sleep(10)` under a 1s timeout runs the full 10s), which
// is the whole reason makeWorkerDb() carries a worker + watchdog. A real server cancels queries properly, so a
// one-off analysis/sweep script can just set a timeout and trust it. See pg-demo.mts in packages/data.
//
// Each makePgDb() gets its OWN SCRATCH DATABASE (`enumeratio_scratch_<random>`) created through a control
// connection to the caller's URL — the sqlsrc corpus is applied there, and close() drops it. The caller's own
// database is only ever used to issue CREATE/DROP DATABASE; nothing is written into it.
//
// #266 turned the single client into a POOL plus a forensics layer, which is the other thing a real server buys
// over pglite: an OUTSIDE OBSERVER. Every pooled session is tracked by backend pid, with its in-flight statement
// and a small ring of the statements before it; a watchdog interval notices a statement that outlives a threshold
// and — from a connection that is NOT the stuck one — reads `pg_stat_activity` / `pg_blocking_pids` for that pid,
// emits the whole bundle (query, params, history, wait event, blockers) to `onPgDiagnostic` sinks, then cancels
// the backend (escalating to terminate only if the cancel doesn't take). `statement_timeout` is still the primary
// defense; this is the layer that tells you WHY, and the backstop for when no timeout was set.
//
// This is a dev/test substrate, not a user-facing backend: nothing in the CLI or explorer wires it up, and the
// browser entry (index.browser.ts) does not re-export it, so `pg` never reaches a bundle.
import nodePg from 'pg'
import debug from 'debug'
import { coreFiles } from '@enumeratio/data/node'
import type { Db, Row } from './core'
import { debugGucSetSql, routeNotice } from './debug-env'

const log = debug('enumeratio:client:pgdb')

/** Last-resort default: Dean's local pg18 (`psql -h localhost -p 5432 -U "$USER" -d postgres`) — no credentials,
 *  the libpq default user. Override with the `url` option or ENUMERATIO_PG_URL. */
const DEFAULT_URL = 'postgres://localhost:5432/postgres'

const DEFAULT_MAX = 4
const DEFAULT_STUCK_MS = 30_000
const DEFAULT_POLL_MS = 1_000
const DEFAULT_GRACE_MS = 2_000
/** Statements remembered per session, for the "what ran just before the hang" half of a bundle. */
const HISTORY = 20
/** Emitted diagnostics kept for a late subscriber (mirrors core.ts's perf ring). */
const DIAG_RING = 50

export type PgDbOptions = {
  /** Control connection string. Default: `$ENUMERATIO_PG_URL`, else postgres://localhost:5432/postgres. */
  url?: string
  /** Keep the scratch database on close() instead of dropping it — for poking at it with psql afterwards. */
  keep?: boolean
  /** Scratch database name. Default: `enumeratio_scratch_<random>`. */
  database?: string
  /** Pool size. Default 4 — small on purpose; the watchdog's own diagnostics run on a separate connection, so
   *  this is purely the caller's concurrency budget. */
  max?: number
  /** Watchdog: a statement in flight longer than this is treated as stuck (diagnosed + cancelled). Default 30s;
   *  0 disables the watchdog entirely. */
  stuckMs?: number
  /** Watchdog scan interval. Default 1s. */
  pollMs?: number
  /** How long a cancelled backend gets to actually stop before the watchdog escalates to terminate. Default 2s. */
  graceMs?: number
  /** `SET statement_timeout` applied to every pooled connection as it is created — the PRIMARY defense; the
   *  watchdog is forensics + backstop. Default: unset (server default, usually 0/no timeout). */
  statementTimeoutMs?: number
}

/** One statement as tracked on a session. `endedAt`/`outcome` are filled in when it completes. */
export type PgStatement = {
  sql: string
  params?: unknown[]
  startedAt: number
  endedAt?: number
  outcome?: 'ok' | 'error' | 'in-flight'
  error?: string
}

/** Why a diagnostic bundle was emitted.
 *  - `stuck`        the watchdog saw an in-flight statement past `stuckMs` (diagnostics gathered, cancel issued)
 *  - `cancelled`    `pg_cancel_backend` was sent and the backend did stop
 *  - `terminated`   the cancel didn't take within `graceMs`, so `pg_terminate_backend` was sent
 *  - `query-error`  a statement failed in a way that killed its connection (the client is destroyed, not reused)
 *  - `idle-error`   a background error on an idle pooled client (pg has already purged it from the pool) */
export type PgDiagnosticKind = 'stuck' | 'cancelled' | 'terminated' | 'query-error' | 'idle-error'

/** Everything needed to understand — and reproduce — one bad moment on a pooled session, without re-running it. */
export type PgDiagnostic = {
  kind: PgDiagnosticKind
  at: number
  /** Backend pid of the affected session, null if the connection died before its pid query answered. */
  pid: number | null
  /** The statement that was in flight (for `idle-error`, the last one that ran). */
  statement: PgStatement | null
  /** How long that statement had been running when this was captured. */
  ageMs: number
  /** That session's recent statements, oldest→newest, in-flight one last. */
  recent: PgStatement[]
  /** The `pg_stat_activity` row for the pid (state, wait_event_type, wait_event, query_start, xact_start, …),
   *  read from a different connection. Null when unavailable (session gone, or the lookup itself failed). */
  activity: Row | null
  /** `pg_blocking_pids(pid)` — sessions whose locks this one is waiting on. */
  blockedBy: number[]
  /** The error that triggered an error-kind bundle, or a note about a failed diagnostic step. */
  error?: string
}

/** A pg-backed Db plus the scratch-db facts a caller (or a debugging human) needs. */
export type PgDb = Db & {
  /** The scratch database that was created and had the sqlsrc applied to it. */
  database: string
  /** Connection string for that scratch database — paste into psql when `keep` is set. */
  url: string
  /** Live per-session view: backend pid → its in-flight statement and recent history. For a demo/dev panel. */
  sessions(): { pid: number | null; inFlight: PgStatement | null; recent: PgStatement[] }[]
}

// ── diagnostic sinks (mirrors core.ts's onWindowPerf/perfSinks) ────────────────────────────────────────────────
type DiagSink = (d: PgDiagnostic) => void
const diagSinks = new Set<DiagSink>()
const diagLog: PgDiagnostic[] = []

/** Subscribe to pg watchdog / dead-connection diagnostics (returns an unsubscribe). Process-wide, like the perf
 *  sinks in core.ts — a makePgDb caller that wants only its own can filter on the pids it sees in `sessions()`. */
export function onPgDiagnostic(sink: DiagSink): () => void {
  diagSinks.add(sink)
  return () => { diagSinks.delete(sink) }
}

/** The recent diagnostic ring, oldest→newest — what a late subscriber (or a post-mortem) reads. */
export function recentPgDiagnostics(): readonly PgDiagnostic[] {
  return diagLog
}

function emitDiagnostic(d: PgDiagnostic): void {
  diagLog.push(d)
  if (diagLog.length > DIAG_RING) diagLog.shift()
  for (const s of diagSinks) try { s(d) } catch { /* a sink must never break the watchdog */ }
  // A hang or a dropped connection is not a routine event, so a summary line is always visible; the FULL bundle
  // goes to DEBUG=enumeratio:client:pgdb, to recentPgDiagnostics(), and to any sink. Nobody files a ticket for
  // you — the point is only that the evidence exists after the fact.
  const wait = (d.activity as { wait_event_type?: string; wait_event?: string } | null)
  console.warn(
    `[enumeratio pgdb] ${d.kind} pid=${d.pid} age=${d.ageMs}ms` +
    (wait?.wait_event_type ? ` wait=${wait.wait_event_type}/${wait.wait_event}` : '') +
    (d.blockedBy.length ? ` blockedBy=${d.blockedBy.join(',')}` : '') +
    ` sql=${JSON.stringify(d.statement?.sql?.slice(0, 120) ?? null)}` +
    (d.error ? ` error=${JSON.stringify(d.error)}` : ''),
  )
  log('%s bundle %s', d.kind, JSON.stringify(d))
}

function scratchName(): string {
  return `enumeratio_scratch_${Math.random().toString(36).slice(2, 10)}`
}

/** Same host/credentials, different database. */
function withDatabase(url: string, database: string): string {
  const u = new URL(url)
  u.pathname = `/${encodeURIComponent(database)}`
  return u.toString()
}

/** A `SET` issued through query() lands on ONE pooled connection, so without replay a pool would make
 *  `SET statement_timeout` non-deterministic — the next query might get a different backend. We keep an
 *  append-only log of session-scoped SET/RESET and replay the unapplied tail onto whichever connection a query
 *  checks out, which preserves single-client semantics for session GUCs. (`SET LOCAL` and friends are
 *  transaction-scoped, so they're deliberately not replayed.) */
const SET_RE = /^\s*(?:set|reset)\s+(?!local\b|transaction\b|constraints\b)/i
/** Cap: a pathological caller SETting in a loop must not grow this without bound. */
const SETUP_MAX = 64

type Session = {
  client: nodePg.PoolClient
  pid: number | null
  inFlight: PgStatement | null
  recent: PgStatement[]
  /** How far through the session-setup log this connection has been brought up to date. */
  setupApplied: number
  /** Set once the watchdog has acted on the current in-flight statement, so it doesn't re-diagnose every tick. */
  actedOn: PgStatement | null
}

/** Boot the pure-SQL core into a fresh scratch database on a real Postgres and hand back a pooled Db over it.
 *  Tested against PostgreSQL 18 (no lower bound established — DROP DATABASE ... WITH (FORCE) needs 13+). */
export async function makePgDb(options: PgDbOptions = {}): Promise<PgDb> {
  const t0 = Date.now()
  const controlUrl = options.url ?? process.env.ENUMERATIO_PG_URL ?? DEFAULT_URL
  const database = options.database ?? scratchName()
  const url = withDatabase(controlUrl, database)
  const stuckMs = options.stuckMs ?? DEFAULT_STUCK_MS
  const pollMs = options.pollMs ?? DEFAULT_POLL_MS
  const graceMs = options.graceMs ?? DEFAULT_GRACE_MS

  const control = new nodePg.Client({ connectionString: controlUrl })
  await control.connect()
  try {
    await control.query(`CREATE DATABASE ${quoteIdent(database)}`)
  } finally {
    await control.end()
  }
  log('created scratch database %s', database)

  // Session setup replayed on every connection, in order: the debug GUC, an opt-in statement_timeout, then any
  // SET/RESET the caller has issued through query() since.
  const setup: string[] = []
  const debugSet = debugGucSetSql()
  if (debugSet) setup.push(debugSet)
  if (options.statementTimeoutMs != null) setup.push(`SET statement_timeout = ${Number(options.statementTimeoutMs)}`)

  const sessions = new Map<nodePg.PoolClient, Session>()

  const pool = new nodePg.Pool({ connectionString: url, max: options.max ?? DEFAULT_MAX })

  pool.on('connect', client => {
    const s: Session = { client, pid: null, inFlight: null, recent: [], setupApplied: setup.length, actedOn: null }
    sessions.set(client as nodePg.PoolClient, s)
    client.on('notice', n => routeNotice({ message: n.message }))
    // A pg Client runs its queries FIFO, so everything queued here executes before the caller's first statement,
    // even though 'connect' is emitted synchronously as the client is handed out. A replacement connection for a
    // killed one comes through here too, so pid tracking and session setup re-establish themselves for free.
    void client.query('SELECT pg_backend_pid() AS pid')
      .then(r => { s.pid = Number((r.rows[0] as { pid: number }).pid) })
      .catch(e => log('pid lookup failed: %s', (e as Error).message))
    for (const sql of setup) void client.query(sql).catch(e => log('session setup failed (%s): %s', sql, (e as Error).message))
  })

  // pg REMOVES an idle client from the pool before emitting 'error' (pg-pool's makeIdleListener) — so recycling is
  // already correct here; what's missing is the evidence, which is what we add. Having a listener at all is also
  // load-bearing: an EventEmitter 'error' with no listener throws.
  pool.on('error', (err, client) => {
    const s = sessions.get(client as nodePg.PoolClient)
    emitDiagnostic({
      kind: 'idle-error', at: Date.now(), pid: s?.pid ?? null,
      statement: s?.inFlight ?? s?.recent[s.recent.length - 1] ?? null,
      ageMs: 0, recent: s ? [...s.recent] : [], activity: null, blockedBy: [],
      error: (err as Error).message,
    })
  })
  pool.on('remove', client => { sessions.delete(client as nodePg.PoolClient) })

  // The watchdog's own connection. Deliberately NOT from the pool: a saturated pool (every slot stuck) would make
  // the forensics layer wait on exactly what it is trying to diagnose. One standalone client, connected lazily and
  // reconnected if it dies, is the only shape that can't deadlock against the thing it observes.
  let diagClient: nodePg.Client | null = null
  async function diag(): Promise<nodePg.Client> {
    if (diagClient) return diagClient
    const c = new nodePg.Client({ connectionString: url })
    await c.connect()
    c.on('error', () => { if (diagClient === c) diagClient = null })
    diagClient = c
    return c
  }

  try {
    // Apply the corpus on ONE dedicated connection — per-file, in dependency order, the same corpus and ordering
    // bootCore()/buildCore() apply to pglite. Spreading these across the pool would break their ordering.
    const boot = await pool.connect()
    try {
      for (const f of coreFiles()) await boot.query(f.content)
    } finally {
      boot.release()
    }
  } catch (e) {
    await pool.end().catch(() => {})
    await dropDatabase(controlUrl, database).catch(() => {})
    throw e
  }
  log('makePgDb ready in %dms (%s)', Date.now() - t0, database)

  /** Did this error kill the connection? An ordinary SQL error (syntax, constraint, even a 57014 cancellation)
   *  leaves the session perfectly usable — pg's own pool.query() destroys the client on ANY query error, which
   *  needlessly churns connections. Class 08 (connection exception) and 57P01/57P02/57P03 (admin shutdown, crash,
   *  cannot connect now) do kill it, as does anything that leaves pg's own `_queryable` flag false. */
  function connectionFatal(client: nodePg.PoolClient, e: unknown): boolean {
    const code = (e as { code?: string })?.code
    if (code && (code.startsWith('08') || code === '57P01' || code === '57P02' || code === '57P03')) return true
    return (client as unknown as { _queryable?: boolean })._queryable === false
  }

  function finish(s: Session, stmt: PgStatement, outcome: 'ok' | 'error', error?: string): void {
    stmt.endedAt = Date.now()
    stmt.outcome = outcome
    if (error) stmt.error = error
    s.inFlight = null
    s.actedOn = null
    s.recent.push(stmt)
    if (s.recent.length > HISTORY) s.recent.shift()
  }

  /** Read everything an outside observer can see about a stuck pid. Never throws — a failed lookup becomes part
   *  of the bundle rather than swallowing the hang report. */
  async function inspect(pid: number): Promise<{ activity: Row | null; blockedBy: number[]; error?: string }> {
    try {
      const c = await diag()
      const a = await c.query<Row>('SELECT * FROM pg_stat_activity WHERE pid = $1', [pid])
      const b = await c.query<{ pids: number[] }>('SELECT pg_blocking_pids($1) AS pids', [pid])
      return { activity: a.rows[0] ?? null, blockedBy: (b.rows[0]?.pids ?? []).map(Number) }
    } catch (e) {
      return { activity: null, blockedBy: [], error: `diagnostic lookup failed: ${(e as Error).message}` }
    }
  }

  /** Is `pid` still actively running the same statement it was? Drives the cancel→terminate escalation.
   *  Matched on the query TEXT pg itself reports, not on query_start: pg's timestamptz has microsecond precision
   *  and the JS Date it round-trips through only has milliseconds, so an equality test on the timestamp silently
   *  never matches (and every escalation would be skipped). */
  async function stillRunning(pid: number, queryText: string): Promise<boolean> {
    try {
      const c = await diag()
      const r = await c.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid = $1 AND state = 'active' AND query = $2`,
        [pid, queryText],
      )
      return (r.rows[0]?.n ?? 0) > 0
    } catch { return false }
  }

  async function signal(fn: 'pg_cancel_backend' | 'pg_terminate_backend', pid: number): Promise<void> {
    try {
      const c = await diag()
      await c.query(`SELECT ${fn}($1)`, [pid])
    } catch (e) {
      log('%s(%d) failed: %s', fn, pid, (e as Error).message)
    }
  }

  async function handleStuck(s: Session, stmt: PgStatement): Promise<void> {
    const pid = s.pid
    const base = { at: Date.now(), pid, statement: { ...stmt }, ageMs: Date.now() - stmt.startedAt, recent: [...s.recent, { ...stmt }] }
    if (pid == null) {
      emitDiagnostic({ kind: 'stuck', ...base, activity: null, blockedBy: [], error: 'no backend pid — cannot cancel this session' })
      return
    }
    const { activity, blockedBy, error } = await inspect(pid)
    emitDiagnostic({ kind: 'stuck', ...base, activity, blockedBy, error })

    await signal('pg_cancel_backend', pid)
    const queryText = (activity as { query?: string } | null)?.query ?? null
    await new Promise(r => setTimeout(r, graceMs))
    // Still our statement in flight AND still the same active query server-side after the grace window ⇒ the
    // cancel didn't take (plpgsql can trap query_canceled and carry on); escalate to a FATAL it can't trap.
    const stuckStill = s.inFlight === stmt && (queryText != null ? await stillRunning(pid, queryText) : true)
    if (stuckStill) {
      await signal('pg_terminate_backend', pid)
      emitDiagnostic({ kind: 'terminated', ...base, at: Date.now(), ageMs: Date.now() - stmt.startedAt, activity, blockedBy })
    } else {
      emitDiagnostic({ kind: 'cancelled', ...base, at: Date.now(), ageMs: Date.now() - stmt.startedAt, activity, blockedBy })
    }
  }

  const watchdog = stuckMs > 0
    ? setInterval(() => {
        const now = Date.now()
        for (const s of sessions.values()) {
          const stmt = s.inFlight
          if (!stmt || s.actedOn === stmt) continue
          if (now - stmt.startedAt < stuckMs) continue
          s.actedOn = stmt   // latch first: handleStuck awaits, and the interval keeps ticking
          void handleStuck(s, stmt)
        }
      }, pollMs)
    : null
  watchdog?.unref?.()   // never hold the process open on the watchdog alone

  let closed = false

  return {
    database,
    url,
    sessions: () => [...sessions.values()].map(s => ({ pid: s.pid, inFlight: s.inFlight, recent: [...s.recent] })),

    async query<T = Row>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
      if (closed) throw new Error('@enumeratio/client: makePgDb Db is closed')
      const client = await pool.connect()
      const s = sessions.get(client) ?? { client, pid: null, inFlight: null, recent: [], setupApplied: setup.length, actedOn: null }
      if (!sessions.has(client)) sessions.set(client, s)
      // Bring this connection up to date with any SET issued since it was last used (see SET_RE above).
      while (s.setupApplied < setup.length) {
        const sSql = setup[s.setupApplied++]!
        await client.query(sSql).catch(e => log('session setup replay failed (%s): %s', sSql, (e as Error).message))
      }
      const stmt: PgStatement = { sql, params, startedAt: Date.now(), outcome: 'in-flight' }
      s.inFlight = stmt
      try {
        const r = await client.query(sql, params as unknown[] | undefined)
        finish(s, stmt, 'ok')
        // Session GUCs must survive landing on a different pooled connection next time.
        if (SET_RE.test(sql)) {
          if (setup.length < SETUP_MAX) { setup.push(sql); s.setupApplied = setup.length }
          else log('session setup log full (%d) — not replaying: %s', SETUP_MAX, sql)
        }
        client.release()
        return { rows: r.rows as T[] }
      } catch (e) {
        const err = e as Error
        finish(s, stmt, 'error', err.message)
        if (connectionFatal(client, e)) {
          emitDiagnostic({
            kind: 'query-error', at: Date.now(), pid: s.pid, statement: { ...stmt },
            ageMs: Date.now() - stmt.startedAt, recent: [...s.recent], activity: null, blockedBy: [],
            error: err.message,
          })
          client.release(err)   // truthy err ⇒ pg destroys this client instead of returning it to the pool
          sessions.delete(client)
        } else {
          client.release()   // an ordinary SQL error leaves the session fine; don't churn the connection
        }
        throw e
      }
    },

    async close(): Promise<void> {
      closed = true
      if (watchdog) clearInterval(watchdog)
      await pool.end().catch(() => {})
      if (diagClient) await diagClient.end().catch(() => {})
      diagClient = null
      sessions.clear()
      if (options.keep) {
        log('keeping scratch database %s', database)
        return
      }
      await dropDatabase(controlUrl, database)
      log('dropped scratch database %s', database)
    },
  }
}

/** Double-quote an identifier (the scratch name is ours, but CREATE/DROP DATABASE can't be parameterized). */
function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

/** FORCE so a leaked/idle connection can't wedge the drop — reliable cleanup is the point of the scratch db. */
async function dropDatabase(controlUrl: string, database: string): Promise<void> {
  const control = new nodePg.Client({ connectionString: controlUrl })
  await control.connect()
  try {
    await control.query(`DROP DATABASE IF EXISTS ${quoteIdent(database)} WITH (FORCE)`)
  } finally {
    await control.end()
  }
}
