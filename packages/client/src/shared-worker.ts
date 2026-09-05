// The SESSION engine: a SharedWorker that owns the ONE pglite for the whole origin. Every tab (`new SharedWorker(...)`)
// gets a MessagePort into HERE, so all tabs share a single wasm instance + a single warm cache — and the instance
// outlives any individual tab. Queries are serialized (pglite is one connection); every start/end is broadcast to all
// ports as an ActivityEntry, giving real cross-tab visibility into the shared surface. bootPglite mounts the prebuilt
// tar (fast path) exactly as the dedicated Web Worker does.
import { bootPglite } from './boot'
import {
  ENGINE_PENDING_LOG,
  type ActivityEntry,
  type EngineEvent,
  type EngineRequest,
  type EnginePhase,
  type Notification,
} from './session-protocol'

const ports = new Set<MessagePort>()
const recent: ActivityEntry[] = [] // a small ring for late joiners to replay the session so far
let phase: EnginePhase = 'booting'
let bootMs: number | undefined
let seq = 0

// Boot pglite once, lazily, and reuse the promise for every port/query.
let pgP: ReturnType<typeof bootPglite> | null = null
function pg() {
  if (!pgP) {
    const t0 = performance.now()
    pgP = bootPglite()
    pgP.then(
      () => { phase = 'ready'; bootMs = Math.round(performance.now() - t0); broadcastStatus() },
      (err) => {
        phase = 'failed'; broadcastStatus()
        const message = err instanceof Error ? `${err.message}` : String(err)
        console.error('[enumeratio engine] boot failed:', err)
        fanNotification({ level: 'error', title: 'Engine boot failed', body: message, sticky: true, key: 'boot-fail' })
      },
    )
  }
  return pgP
}

// Serialize queries onto one chain — pglite is a single connection, and a shared surface must not interleave.
let chain: Promise<unknown> = Promise.resolve()
function serialize<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(job, job)
  chain = run.catch(() => {}) // keep the chain alive after a failed query
  return run
}

function post(port: MessagePort, ev: EngineEvent) { port.postMessage(ev) }
function broadcast(ev: EngineEvent) { for (const p of ports) p.postMessage(ev) }
function broadcastStatus() { broadcast({ kind: 'status', phase, clients: ports.size, bootMs }) }

function logActivity(entry: ActivityEntry) {
  recent.push(entry)
  if (recent.length > ENGINE_PENDING_LOG) recent.shift()
  broadcast({ kind: 'activity', entry })
}

const clip = (sql: string) => (sql.length > 120 ? sql.slice(0, 117) + '…' : sql).replace(/\s+/g, ' ').trim()

async function handleQuery(port: MessagePort, req: Extract<EngineRequest, { kind: 'query' }>, origin: string) {
  const local = ++seq
  const at = Date.now()
  logActivity({ id: local, phase: 'start', sql: clip(req.sql), origin, at })
  const t0 = performance.now()
  try {
    const db = await pg()
    const res = await serialize(() => db.query(req.sql, req.params as never))
    const ms = Math.round(performance.now() - t0)
    const rows = (res as { rows: unknown[] }).rows
    post(port, { kind: 'result', id: req.id, rows, ms })
    logActivity({ id: local, phase: 'end', ms, rows: rows.length, ok: true, sql: clip(req.sql), origin, at: Date.now() })
  } catch (e) {
    const ms = Math.round(performance.now() - t0)
    const message = e instanceof Error ? e.message : String(e)
    post(port, { kind: 'error', id: req.id, message })
    logActivity({ id: local, phase: 'end', ms, ok: false, sql: clip(req.sql), origin, at: Date.now() })
  }
}

function fanNotification(note: Notification) {
  broadcast({ kind: 'notification', note })
}

function onConnect(port: MessagePort) {
  ports.add(port)
  const origin = `tab-${(ports.size + Math.floor(Math.random() * 90) + 10)}` // a cheap human tag; the tab may override
  port.onmessage = (e: MessageEvent<EngineRequest>) => {
    const req = e.data
    switch (req.kind) {
      case 'query': void handleQuery(port, req, origin); break
      case 'notify': fanNotification(req.note); break
      case 'ping': post(port, { kind: 'status', phase, clients: ports.size, bootMs }); break
    }
  }
  // Replay the session so far + current liveness to the newcomer, then tell everyone the client count changed.
  for (const entry of recent) post(port, { kind: 'activity', entry })
  post(port, { kind: 'status', phase, clients: ports.size, bootMs })
  broadcastStatus()
  void pg() // start booting as soon as the first tab connects
  // SharedWorker ports have no reliable 'close' — presence is best-effort. A tab's beforeunload can send a 'ping'-less
  // cleanup, but the honest signal is a heartbeat; the POC drops a port when a post throws (see prune()).
}

function prune() {
  for (const p of [...ports]) {
    try { p.postMessage({ kind: 'status', phase, clients: ports.size, bootMs } satisfies EngineEvent) } catch { ports.delete(p) }
  }
}
setInterval(prune, 15_000)

// Dual-mode entry. Preferred: a SharedWorker (SharedWorkerGlobalScope has `onconnect`) — every tab's port lands here,
// one instance for the origin. Fallback: a DEDICATED Worker (no `onconnect`) — used where a SharedWorker can't load
// (Chrome-Android has none; Vite's dev server mis-serves module SharedWorkers). In dedicated mode `self` IS the single
// port, so this tab gets its own engine — the session degrades from cross-tab-shared to per-tab, but the exact same
// protocol + calculation surface runs. session.ts picks the transport and reports which one is live.
const scope = self as unknown as { onconnect?: unknown; postMessage: (m: unknown) => void; onmessage: ((e: MessageEvent) => void) | null }
if ('onconnect' in scope) {
  ;(scope as unknown as { onconnect: (e: MessageEvent) => void }).onconnect = (e: MessageEvent) => {
    const port = (e as unknown as { ports: MessagePort[] }).ports[0]
    port.start?.()
    onConnect(port)
  }
} else {
  // Adapt the dedicated-worker global into the MessagePort shape onConnect expects (postMessage + settable onmessage).
  const selfPort: MessagePort = {
    postMessage: (m: unknown) => scope.postMessage(m),
    set onmessage(fn: ((e: MessageEvent) => void) | null) { scope.onmessage = fn },
    start() {},
    close() {},
  } as unknown as MessagePort
  onConnect(selfPort)
}
