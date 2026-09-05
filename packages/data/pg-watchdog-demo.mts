// Demo + evidence for the pooled makePgDb watchdog (#266): PROVE that a hung query on a real Postgres is
// detected, diagnosed from an outside connection, cancelled — and that the pool survives it.
//
// The sibling script pg-demo.mts proves the primary defense (`statement_timeout` really cancels here, unlike in
// pglite). This one proves the layer underneath it: what happens when nothing cancels the query for you.
//
// Four scenarios, each asserted and each exiting nonzero on failure:
//   A  a hang with NO statement_timeout set → the watchdog notices it past `stuckMs`, emits a bundle carrying the
//      pg_stat_activity row + blockers + that session's recent statements, and pg_cancel_backend()s it. The
//      session SURVIVES (same backend pid afterwards) — a cancel is a query abort, not a connection kill.
//   B  a query that TRAPS cancellation (plpgsql can catch query_canceled and keep going — statement_timeout can't
//      touch it either) → the watchdog escalates to pg_terminate_backend after the grace window. This is the case
//      that justifies the backstop existing at all.
//   C  the connection dying mid-query (an outside session terminates our backend) → a `query-error` bundle, and
//      the destroyed client is NOT reused.
//   D  an IDLE pooled connection killed from outside → pg's own pool purges it and emits 'error'; we attach the
//      pid + statement history to that. A replacement connection picks up pid tracking on its own.
//
//   node --import tsx pg-watchdog-demo.mts            # against $ENUMERATIO_PG_URL, else localhost:5432/postgres
//
// The client lives in a package that depends on this one, so it's imported by path rather than by name — a
// workspace devDependency the other way would be a cycle, and this is a dev script, not shipped surface.
import nodePg from 'pg'
import { makePgDb, onPgDiagnostic, type PgDiagnostic } from '../client/src/pg.ts'

const STUCK_MS = 1_500
const GRACE_MS = 1_500

const bundles: PgDiagnostic[] = []
const unsubscribe = onPgDiagnostic(d => bundles.push(d))
const since = () => bundles.length
const seen = (from: number, kind: PgDiagnostic['kind']) => bundles.slice(from).find(d => d.kind === kind)

let failures = 0
function check(ok: boolean, label: string, detail?: unknown): void {
  if (ok) console.log(`  OK   ${label}`)
  else { failures++; console.error(`  FAIL ${label}`, detail ?? '') }
}
const sqlstate = (e: unknown): string | undefined => (e as { code?: string })?.code
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

const db = await makePgDb({ max: 3, stuckMs: STUCK_MS, pollMs: 250, graceMs: GRACE_MS })
console.log(`scratch database: ${db.database}  (watchdog: stuck>${STUCK_MS}ms, grace ${GRACE_MS}ms)\n`)

try {
  // A few real statements first, so the ring buffer in the bundle has something to show.
  const { rows } = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM base_catalog')
  console.log(`base_catalog rows: ${rows[0]?.n}`)
  await db.query('SELECT id FROM base_catalog WHERE id = $1', ['permutations'])

  // ── A: a hang with no statement_timeout — the watchdog is the only thing that can end it ────────────────────
  console.log('\nA. hang with NO statement_timeout → detect, diagnose, cancel')
  const pidBefore = db.sessions()[0]?.pid ?? null
  const markA = since()
  const t0 = Date.now()
  let errA: unknown = null
  try { await db.query('SELECT pg_sleep($1)', [30]) } catch (e) { errA = e }
  const elapsedA = Date.now() - t0

  const stuck = seen(markA, 'stuck')
  check(!!errA, 'pg_sleep(30) did not complete — it was killed')
  check(sqlstate(errA) === '57014', `killed by cancellation (SQLSTATE 57014), got ${sqlstate(errA)}`, (errA as Error)?.message)
  check(elapsedA < 10_000, `ended in ${elapsedA}ms, well short of the 30s sleep`)
  check(!!stuck, 'a `stuck` diagnostic bundle was emitted')
  check(stuck?.pid != null, 'the bundle carries the backend pid')
  check(stuck?.statement?.sql === 'SELECT pg_sleep($1)', 'the bundle carries the stuck SQL')
  check(JSON.stringify(stuck?.statement?.params) === '[30]', 'the bundle carries the stuck params')
  check((stuck?.ageMs ?? 0) >= STUCK_MS, `the bundle reports the age at detection (${stuck?.ageMs}ms >= ${STUCK_MS}ms)`)
  check(!!stuck?.activity, 'the bundle carries the pg_stat_activity row read from ANOTHER connection')
  check((stuck?.activity as { state?: string })?.state === 'active', 'that row shows the backend active')
  check(Array.isArray(stuck?.blockedBy), 'the bundle carries pg_blocking_pids()')
  check((stuck?.recent.length ?? 0) >= 3, `the bundle carries the session's recent statements (${stuck?.recent.length})`)

  console.log('\n  --- the bundle a human would read ---')
  console.log(JSON.stringify({
    kind: stuck?.kind, pid: stuck?.pid, ageMs: stuck?.ageMs,
    statement: stuck?.statement,
    activity: {
      state: (stuck?.activity as Record<string, unknown>)?.state,
      wait_event_type: (stuck?.activity as Record<string, unknown>)?.wait_event_type,
      wait_event: (stuck?.activity as Record<string, unknown>)?.wait_event,
      query: (stuck?.activity as Record<string, unknown>)?.query,
      query_start: (stuck?.activity as Record<string, unknown>)?.query_start,
      xact_start: (stuck?.activity as Record<string, unknown>)?.xact_start,
    },
    blockedBy: stuck?.blockedBy,
    recent: stuck?.recent.map(s => ({ sql: s.sql, params: s.params, outcome: s.outcome })),
  }, null, 2).split('\n').map(l => `  ${l}`).join('\n'))
  console.log('  --- end bundle ---\n')

  await wait(GRACE_MS + 500)   // let the escalation check settle
  check(!!seen(markA, 'cancelled'), 'the follow-up bundle says `cancelled`, not `terminated`')
  check(!seen(markA, 'terminated'), 'no escalation was needed — pg_cancel_backend was enough')

  const { rows: afterA } = await db.query<{ ok: number }>('SELECT 1 AS ok')
  check(afterA[0]?.ok === 1, 'the pool still works after the cancel')
  check(db.sessions().some(s => s.pid === pidBefore), `the cancelled session survived — same backend pid ${pidBefore}`)

  // ── B: a query that traps cancellation → escalate to terminate ───────────────────────────────────────────────
  console.log('\nB. cancel-proof query → escalate to pg_terminate_backend')
  const markB = since()
  // plpgsql CAN trap query_canceled and carry on; a FATAL terminate it cannot trap. This is exactly the shape
  // `statement_timeout` also fails to handle, which is why the backstop exists.
  const cancelProof = `DO $$ BEGIN LOOP BEGIN PERFORM pg_sleep(60); EXCEPTION WHEN query_canceled THEN NULL; END; END LOOP; END $$`
  const tB = Date.now()
  let errB: unknown = null
  try { await db.query(cancelProof) } catch (e) { errB = e }
  const elapsedB = Date.now() - tB

  check(!!errB, 'the cancel-proof query was stopped anyway')
  check(sqlstate(errB) === '57P01' || /terminat/i.test((errB as Error)?.message ?? ''),
    `stopped by a TERMINATE (57P01 / "terminating connection"), got ${sqlstate(errB)}`, (errB as Error)?.message)
  check(elapsedB < 30_000, `ended in ${elapsedB}ms, short of the 60s loop`)
  check(!!seen(markB, 'stuck'), 'a `stuck` bundle was emitted first')
  check(!!seen(markB, 'terminated'), 'escalation bundle `terminated` was emitted (the cancel did not take)')
  check(!!seen(markB, 'query-error'), 'the dead connection also produced a `query-error` bundle')

  const { rows: afterB } = await db.query<{ ok: number }>('SELECT 1 AS ok')
  check(afterB[0]?.ok === 1, 'the pool still works after a terminated backend')
  const pidsB = db.sessions().map(s => s.pid)
  check(!pidsB.includes(seen(markB, 'terminated')?.pid ?? -1),
    `the terminated backend is gone from the pool (pids now ${pidsB.join(',')})`)

  // ── C: the connection dies mid-query, killed from outside ────────────────────────────────────────────────────
  console.log('\nC. connection killed mid-query from outside → query-error bundle, client destroyed')
  const outside = new nodePg.Client({ connectionString: db.url })
  await outside.connect()
  const markC = since()
  const killLater = (async () => {
    await wait(500)
    const target = db.sessions().find(s => s.inFlight?.sql.includes('pg_sleep'))?.pid
    if (target) await outside.query('SELECT pg_terminate_backend($1)', [target])
    return target ?? null
  })()
  let errC: unknown = null
  try { await db.query('SELECT pg_sleep($1)', [1]) } catch (e) { errC = e }
  const killedPid = await killLater

  check(killedPid != null, `found the in-flight session from the outside (pid ${killedPid})`)
  check(!!errC, 'the query failed when its backend was killed')
  const qe = seen(markC, 'query-error')
  check(!!qe, 'a `query-error` bundle was emitted')
  check(qe?.pid === killedPid, `the bundle names the killed pid (${qe?.pid})`)
  check((qe?.recent.length ?? 0) > 0, 'the bundle carries that session\'s statement history')
  check(!db.sessions().some(s => s.pid === killedPid), 'the dead client was NOT returned to the pool')

  const { rows: afterC } = await db.query<{ ok: number }>('SELECT 1 AS ok')
  check(afterC[0]?.ok === 1, 'the pool still works after a mid-query connection death')

  // ── D: an IDLE pooled connection killed from outside ─────────────────────────────────────────────────────────
  console.log('\nD. idle pooled connection killed from outside → idle-error bundle, clean replacement')
  const idlePid = db.sessions().find(s => s.pid != null && !s.inFlight)?.pid ?? null
  const markD = since()
  check(idlePid != null, `an idle tracked session exists (pid ${idlePid})`)
  if (idlePid != null) await outside.query('SELECT pg_terminate_backend($1)', [idlePid])
  await wait(750)
  const ie = seen(markD, 'idle-error')
  check(!!ie, 'an `idle-error` bundle was emitted for the background failure')
  check(ie?.pid === idlePid, `the bundle names the killed pid (${ie?.pid})`)
  check(!db.sessions().some(s => s.pid === idlePid), 'pg purged the dead client from the pool before emitting')

  const { rows: afterD } = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM base_catalog')
  check(afterD[0]?.n === rows[0]?.n, 'a fresh connection serves the same catalog query')
  const newPid = db.sessions().find(s => !s.inFlight)?.pid ?? null
  check(newPid != null && newPid !== idlePid, `the replacement connection got its own pid tracking (${newPid})`)

  await outside.end()
} finally {
  unsubscribe()
  await db.close()   // drops the scratch database
}

console.log(failures === 0 ? '\nALL OK' : `\n${failures} CHECK(S) FAILED`)
if (failures) process.exitCode = 1
