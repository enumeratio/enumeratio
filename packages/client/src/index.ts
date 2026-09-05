// The node entry for the pure-SQL core client: the read-through API (core.ts) plus the Db loaders (node.ts).
// Wire it with `provideDb(() => makeDb())` (main-thread, one-shot) or `provideDb(() => makeWorkerDb())`
// (off-thread + watchdog), then use collections/construct/describe/summary/Handle.
export * from './core'
export * from './rows'
export * from './select'
export * from './preds'
export * from './ir'
export * from './engine'
export { pgEngine } from './pg-engine'
export { tsEngine, InexactResult } from './ts-engine'
export { routerEngine, standardEngine } from './router'
export * from './registry'
export { makeDb, makeWorkerDb, setQueryTimeout } from './node'
// Dev/test only: a real-Postgres Db over a throwaway scratch database (see pg.ts). Node-only — deliberately absent
// from index.browser.ts so `pg` never reaches a browser bundle.
export {
  makePgDb, onPgDiagnostic, recentPgDiagnostics,
  type PgDb, type PgDbOptions, type PgDiagnostic, type PgDiagnosticKind, type PgStatement,
} from './pg'
