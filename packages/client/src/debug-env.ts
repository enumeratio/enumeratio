// Lift a DEBUG string into the pglite session as the `enumeratio.debug` GUC, and route gated RAISE NOTICE output
// back through the JS `debug` library — the client-package half of the #200 debug convention. (packages/data's
// run.mts / selfcert.mts boot pglite directly, with no dependency on this package, so they carry a duplicate of
// this same small helper — packages/data/debug-env.ts — rather than the other way round, which would cycle.)
import debug from 'debug'

const sqlLog = debug('enumeratio:sql')

/** Where the DEBUG string comes from: `process.env.DEBUG` in node, `localStorage.debug` in a browser — the same
 *  key the `debug` package itself reads there (its browser build already auto-enables JS-side namespaces from it;
 *  this reads the same value to decide whether to lift it into the SQL-side GUC too). */
function rawDebugEnv(): string | undefined {
  try {
    if (typeof process !== 'undefined' && process.env?.DEBUG) return process.env.DEBUG
  } catch { /* no process (a bundled browser build may strip it entirely) */ }
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage
    const v = ls?.getItem('debug')
    if (v) return v
  } catch { /* no storage (a worker scope, a locked-down embed, …) */ }
  return undefined
}

/** The DEBUG value to lift into the pglite session GUC, or null when it names no `enumeratio:` namespace — nothing
 *  to turn on, so the caller skips the SET (the zero-cost-when-off path: no GUC set ⇒ the SQL-side debug_enabled()
 *  short-circuits on an empty current_setting()). */
export function debugGucValue(env: string | undefined = rawDebugEnv()): string | null {
  return env && /(?:^|,)\s*-?enumeratio:/.test(env) ? env : null
}

/** SQL to run once per session (right after boot) to lift DEBUG into `enumeratio.debug` — null when there's
 *  nothing to set. */
export function debugGucSetSql(env?: string): string | null {
  const v = debugGucValue(env)
  return v == null ? null : `SET enumeratio.debug = '${v.replace(/'/g, "''")}'`
}

/** Route one pglite NOTICE to the JS `debug` logger — the other half of the round trip. A gated
 *  `RAISE NOTICE '[%] %', ns, msg` (debug_log/debug_logf, or an inline hot-loop probe, in debug.sql) prints as
 *  "[ns] msg"; split that back into its namespace so it lands on the SAME debug() stream a TS-side probe in that
 *  namespace would use — indistinguishable from one logged in TS. A NOTICE with no `[ns]` prefix (a bare Postgres
 *  NOTICE, or a raw RAISE with no debug.sql wrapper) falls back to the generic enumeratio:sql namespace. */
export function routeNotice(notice: { message?: string }): void {
  const msg = notice.message ?? ''
  const m = /^\[([\w:.-]+)\]\s?([\s\S]*)$/.exec(msg)
  if (m) debug(m[1])(m[2])
  else sqlLog(msg)
}
