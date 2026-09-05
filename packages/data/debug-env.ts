// Lift the DEBUG env var into the pglite session as the `enumeratio.debug` GUC, and route gated RAISE NOTICE
// output back through the JS `debug` library — the data-package half of the #200 debug convention (run.mts,
// selfcert.mts boot pglite directly, with no dependency on @enumeratio/client). packages/client/src/debug-env.ts is
// the client-side sibling: duplicated rather than imported to avoid a data → client dependency cycle (client
// already depends on data).
import debug from 'debug'

const sqlLog = debug('enumeratio:sql')

/** The DEBUG value to lift into the session GUC, or null when it names no `enumeratio:` namespace — nothing to
 *  turn on, so the caller skips the SET (the zero-cost-when-off path: no GUC set ⇒ debug_enabled() short-circuits
 *  on an empty current_setting()). */
export function debugGucValue(env: string | undefined = process.env.DEBUG): string | null {
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
 *  namespace would use. A NOTICE with no [ns] prefix falls back to the generic enumeratio:sql namespace. */
export function routeNotice(notice: { message?: string }): void {
  const msg = notice.message ?? ''
  const m = /^\[([\w:.-]+)\]\s?([\s\S]*)$/.exec(msg)
  if (m) debug(m[1])(m[2])
  else sqlLog(msg)
}
