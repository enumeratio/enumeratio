/// <reference path="./vite-env.d.ts" />
// (carries the `*?worker` / `*?sharedworker` ambient decls into any compilation that follows this import — e.g. the
//  explorer's vue-tsc — so consumers resolve the Vite worker suffixes without their own vite/client types.)
// The SESSION-mode Db provider: one long-lived, SHARED, observable calculation surface across all same-origin tabs.
// It wires the two planes from session-protocol.ts:
//   • the ENGINE (a SharedWorker holding the one pglite) — where queries actually run;
//   • the CONTROLLER (a ServiceWorker) — the versioned control/observability/notification singleton.
// `makeServiceWorkerDb()` returns a SessionDb: a normal Db (query/close, so provideDb() works) PLUS an observability
// surface (`on`, `notify`, `flush`, `presence`) the UI uses to SEE and CONTROL the shared session. Contrast with
// makeDb() (one-shot, in-process) — see https://github.com/enumeratio/enumeratio/wiki/Service-Worker-And-Session for the split.
import type { Db, Row } from './core'
import type {
  ControllerEvent,
  EngineEvent,
  EngineRequest,
  EnginePhase,
  Notification,
} from './session-protocol'
// Vite's dedicated SharedWorker import: a bundled constructor. We use this rather than `new SharedWorker(new URL(...))`
// because Vite's dev URL-worker path injects an HMR/env shim that assumes a Window/DedicatedWorker global and throws
// when evaluated in a SharedWorker scope ("Failed to fetch a worker script"). The ?sharedworker bundle has no such
// shim. Browser/Vite-only (index.browser wires this); the type is declared in vite-env.d.ts.
import EnumeratioEngine from './shared-worker.ts?sharedworker'
import EnumeratioEngineDedicated from './shared-worker.ts?worker'

/** Everything the session surfaces beyond a bare Db — the control + observability the shared surface makes possible. */
export type SessionDb = Db & {
  /** Subscribe to the live event stream (activity from ALL tabs, liveness, notifications, controller version). */
  on(handler: (ev: SessionEvent) => void): () => void
  /** Author a notification that fans out to every tab (and, via the controller, may raise an OS notification). */
  notify(note: Notification): void
  /** Ask the ServiceWorker controller to replace itself now (skipWaiting + claim) — the cheap flush/replace path. */
  flush(): void
  /** Current liveness snapshot (phase, connected tab count, boot time). */
  readonly presence: Presence
}

export type Presence = { phase: EnginePhase; clients: number; bootMs?: number; transport?: 'shared' | 'dedicated' }
/** The unified event a UI listens to — engine events plus controller (version/reload) events, tagged by plane. */
export type SessionEvent =
  | ({ plane: 'engine' } & EngineEvent)
  | ({ plane: 'controller' } & ControllerEvent)

const SW_URL = '/enumeratio-service-worker.js' // a plain, self-contained, versioned static file (docs/public/)

/** Register the ServiceWorker controller (best-effort — no SW ⇒ the engine still works, you just lose the OS-level
 *  notification + versioned flush plane). Returns a thin handle for version/flush + a message subscription. */
function connectController(emit: (ev: SessionEvent) => void) {
  const sink = (ev: ControllerEvent) => emit({ plane: 'controller', ...ev })
  let reg: ServiceWorkerRegistration | null = null
  const ready = (async () => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    try {
      reg = await navigator.serviceWorker.register(SW_URL, { type: 'module', scope: '/' })
      navigator.serviceWorker.addEventListener('message', (e: MessageEvent<ControllerEvent>) => sink(e.data))
      // Ask the active worker who it is (version/build stamp) once it's controlling.
      const ask = () => navigator.serviceWorker.controller?.postMessage({ kind: 'version' })
      if (navigator.serviceWorker.controller) ask()
      navigator.serviceWorker.addEventListener('controllerchange', ask)
    } catch (err) {
      // dev without HTTPS/localhost, or a blocked scope — degrade to engine-only.
      console.warn('[enumeratio session] ServiceWorker controller unavailable:', err)
    }
  })()
  return {
    ready,
    send(msg: { kind: 'version' } | { kind: 'flush' } | { kind: 'notify'; note: Notification }) {
      void ready.then(() => navigator.serviceWorker?.controller?.postMessage(msg))
    },
    async flush() {
      await ready
      const w = reg?.waiting ?? reg?.installing ?? navigator.serviceWorker?.controller
      w?.postMessage({ kind: 'flush' })
    },
  }
}

export function makeServiceWorkerDb(): SessionDb {
  const handlers = new Set<(ev: SessionEvent) => void>()
  const emit = (ev: SessionEvent) => { for (const h of handlers) h(ev) }
  const presence: Presence = { phase: 'booting', clients: 0 }

  const controller = connectController(emit)

  let seq = 0
  const pending = new Map<number, { resolve: (v: { rows: unknown[] }) => void; reject: (e: Error) => void }>()

  const onEngineMessage = (ev: EngineEvent) => {
    if (ev.kind === 'result') { pending.get(ev.id)?.resolve({ rows: ev.rows }); pending.delete(ev.id) }
    else if (ev.kind === 'error') { pending.get(ev.id)?.reject(new Error(ev.message)); pending.delete(ev.id) }
    else if (ev.kind === 'status') { presence.phase = ev.phase; presence.clients = ev.clients; presence.bootMs = ev.bootMs }
    emit({ plane: 'engine', ...ev })
  }

  // A tiny transport abstraction: `post` a request, get events via onEngineMessage. Two implementations —
  // the shared engine (all tabs → one instance) and the dedicated fallback (this tab's own instance).
  let post: (req: EngineRequest) => void = () => {}

  let heardFromShared = false
  const wireShared = (): boolean => {
    try {
      const worker = new EnumeratioEngine() as SharedWorker // same bundled URL in every tab ⇒ one shared instance
      worker.onerror = () => { if (!heardFromShared) wireDedicated('shared-worker failed to load') }
      const p = worker.port
      p.onmessage = (e: MessageEvent<EngineEvent>) => { heardFromShared = true; onEngineMessage(e.data) }
      p.start()
      post = (req) => p.postMessage(req)
      presence.transport = 'shared'
      // The engine posts a `status` the instant a port connects. Silence within a short window ⇒ the SharedWorker
      // never loaded (Vite dev shim / no Android support) → fall back. (Boot TIME doesn't matter — `status` fires at
      // connect, before pglite is ready, so this races the connect handshake, not the multi-second tar mount.)
      setTimeout(() => { if (!heardFromShared) wireDedicated('shared-worker never connected') }, 5000)
      post({ kind: 'ping' })
      return true
    } catch { return false }
  }

  let fellBack = false
  const wireDedicated = (why: string) => {
    if (fellBack) return
    fellBack = true
    console.warn(`[enumeratio session] using per-tab engine (${why}) — cross-tab sharing unavailable here`)
    const worker = new EnumeratioEngineDedicated() as Worker
    worker.onmessage = (e: MessageEvent<EngineEvent>) => onEngineMessage(e.data)
    post = (req) => worker.postMessage(req)
    presence.transport = 'dedicated'
    post({ kind: 'ping' })
  }

  if (!wireShared()) wireDedicated('SharedWorker unsupported')
  const send = (req: EngineRequest) => post(req)

  const db: SessionDb = {
    query<T = Row>(sql: string, params: unknown[] = []): Promise<{ rows: T[] }> {
      const id = ++seq
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve: resolve as (v: { rows: unknown[] }) => void, reject })
        send({ kind: 'query', id, sql, params })
      })
    },
    // No `cancel`: shared-worker.ts serializes every query on the one engine and the protocol carries no cancel
    // message, so there is nothing honest to implement here — leaving it undefined makes cancelDb() report false
    // rather than claim an abort did something. Fixed by #279 (the queue-based calc worker).
    async close(): Promise<void> {
      // A shared surface is NOT ours to close — just detach this tab. The engine lives while any tab is open (in the
      // dedicated-fallback case the per-tab worker is reclaimed when the page unloads).
      for (const p of pending.values()) p.reject(new Error('session detached'))
      pending.clear()
    },
    on(handler) { handlers.add(handler); return () => handlers.delete(handler) },
    notify(note) { send({ kind: 'notify', note }); controller.send({ kind: 'notify', note }) },
    flush() { void controller.flush() },
    get presence() { return presence },
  }
  return db
}
