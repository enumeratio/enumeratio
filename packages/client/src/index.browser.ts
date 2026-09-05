// Browser entry for the pure-SQL core client: the read-through API (core.ts) + the in-browser Db loaders
// (browser.ts). Wire with `provideDb(() => makeWorkerDb())` for off-thread, non-blocking calculation
// (the explorer), or `provideDb(() => makeDb())` for a small main-thread instance.
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
export { makeDb, makeWorkerDb, setQueryTimeout } from './browser'
// Session mode: one shared, observable calculation surface across all tabs (SharedWorker engine + ServiceWorker
// controller). See https://github.com/enumeratio/enumeratio/wiki/Service-Worker-And-Session.
export { makeServiceWorkerDb, type SessionDb, type SessionEvent, type Presence } from './session'
export type { ActivityEntry, Notification, EngineEvent, EnginePhase } from './session-protocol'
