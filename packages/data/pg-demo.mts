// Demo + evidence for the real-Postgres Db provider (#265): boot the sqlsrc core into a throwaway scratch
// database on a local Postgres, run a real catalog query against it, and then PROVE the thing that motivated the
// provider in the first place — that `SET statement_timeout` actually cancels a hung query here.
//
// pglite ignores statement_timeout entirely (single-threaded WASM, no cooperative-cancel path): `pg_sleep(10)`
// under a 1s timeout runs the full 10s, which is why makeWorkerDb() needs a worker + watchdog. A real server
// cancels in ~the timeout, with SQLSTATE 57014. This script asserts exactly that and exits nonzero if it doesn't.
//
//   node --import tsx pg-demo.mts                     # against $ENUMERATIO_PG_URL, else localhost:5432/postgres
//   ENUMERATIO_PG_URL=postgres://host/db node --import tsx pg-demo.mts
//
// The client lives in a package that depends on this one, so it's imported by path rather than by name — a
// workspace devDependency the other way would be a cycle, and this is a dev script, not shipped surface.
import { makePgDb } from '../client/src/pg.ts'

const TIMEOUT_MS = 500
const SLEEP_S = 10

const db = await makePgDb()
console.log(`scratch database: ${db.database}`)

try {
  const { rows } = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM base_catalog')
  console.log(`base_catalog rows: ${rows[0]?.n}`)

  await db.query(`SET statement_timeout = ${TIMEOUT_MS}`)
  const t0 = Date.now()
  let cancelled: { code?: string; message: string } | null = null
  try {
    await db.query(`SELECT pg_sleep(${SLEEP_S})`)
  } catch (e) {
    cancelled = e as { code?: string; message: string }
  }
  const elapsed = Date.now() - t0

  if (!cancelled) {
    console.error(`FAIL: pg_sleep(${SLEEP_S}) completed under a ${TIMEOUT_MS}ms statement_timeout (${elapsed}ms)`)
    process.exitCode = 1
  } else if (cancelled.code !== '57014') {
    console.error(`FAIL: query errored, but not as a cancellation: ${cancelled.code} ${cancelled.message}`)
    process.exitCode = 1
  } else if (elapsed > SLEEP_S * 1000 * 0.5) {
    console.error(`FAIL: cancelled, but only after ${elapsed}ms — the timeout did not bite`)
    process.exitCode = 1
  } else {
    console.log(`OK: pg_sleep(${SLEEP_S}) cancelled after ${elapsed}ms (SQLSTATE 57014) — statement_timeout works`)
  }

  // the session survives a cancellation — it's a query abort, not a connection kill
  await db.query('SET statement_timeout = 0')
  const { rows: after } = await db.query<{ ok: number }>('SELECT 1 AS ok')
  console.log(`session still usable after cancel: ${after[0]?.ok === 1}`)
} finally {
  await db.close()   // drops the scratch database
}
