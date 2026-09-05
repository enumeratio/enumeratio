// The node entry for the pure-SQL core client: the read-through API (core.ts) plus the Db loaders (node.ts).
// Wire it with `provideDb(() => makeDb())` (main-thread, one-shot) or `provideDb(() => makeWorkerDb())`
// (off-thread + watchdog), then use collections/construct/describe/summary/Handle.
export * from './core'
export * from './rows'
export * from './select'
export * from './preds'
export { makeDb, makeWorkerDb, setQueryTimeout } from './node'
// Dev/test only: a real-Postgres Db over a throwaway scratch database (see pg.ts). Node-only — deliberately absent
// from index.browser.ts so `pg` never reaches a browser bundle.
export {
  makePgDb, onPgDiagnostic, recentPgDiagnostics,
  type PgDb, type PgDbOptions, type PgDiagnostic, type PgDiagnosticKind, type PgStatement,
} from './pg'
