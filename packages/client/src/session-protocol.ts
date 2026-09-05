// The message API for the SESSION mode of the client — one long-lived, SHARED, observable calculation surface across
// all same-origin tabs. Two cooperating planes, split by what each is good at:
//
//   • ENGINE  = a SharedWorker holding the ONE pglite (mounts the prebuilt tar via bootPglite). All tabs connect to
//               the same instance, so a query issued in one tab warms the cache for the next; it stays alive as long
//               as a tab is open, and is NOT subject to the ServiceWorker's kill-an-idle-worker lifecycle.
//   • CONTROLLER = a ServiceWorker: the versioned, install-once control/observability plane (see https://github.com/enumeratio/enumeratio/wiki/Service-Worker-And-Session). It owns liveness fan-out + the notification hook + the flush/replace
//               update path — the things that want a per-origin singleton with a real update lifecycle. It changes
//               only when the interaction MODES change, never when the DB changes.
//
// This file is the wire contract both planes speak; it imports nothing (safe to load in a page, a SharedWorker, or a
// ServiceWorker). Keep it the single source of truth for the shapes.

// ── engine (tab ↔ SharedWorker) ──────────────────────────────────────────────────────────────────────────────
/** A tab's request to the engine. */
export type EngineRequest =
  | { kind: 'query'; id: number; sql: string; params?: unknown[] }
  | { kind: 'notify'; note: Notification } // a tab authors a notification; the engine fans it to every tab
  | { kind: 'ping' } // liveness probe → engine replies with a `status`

/** The engine's messages to a tab (some are point-to-point replies, some are broadcast to EVERY connected port). */
export type EngineEvent =
  | { kind: 'result'; id: number; rows: unknown[]; ms: number } // reply to one query
  | { kind: 'error'; id: number; message: string } // reply to one query
  | { kind: 'status'; phase: EnginePhase; clients: number; bootMs?: number } // liveness (broadcast on change)
  | { kind: 'activity'; entry: ActivityEntry } // observability stream (broadcast) — every query start/end, all tabs see it
  | { kind: 'notification'; note: Notification } // a fanned-out notification (broadcast)

export type EnginePhase = 'booting' | 'ready' | 'failed'

/** One observable interaction on the shared surface — the raw material for the perf-stats / streaming spike. Broadcast
 *  to all tabs so any tab can render a live activity log of the WHOLE session, not just its own calls. */
export type ActivityEntry = {
  id: number
  phase: 'start' | 'end'
  ms?: number // wall time, on 'end'
  rows?: number // row count, on 'end'
  ok?: boolean // on 'end'
  sql: string // truncated preview (the surface is shared; don't leak whole bodies into every tab needlessly)
  origin: string // a short tab tag, so the log shows WHICH tab issued it
  at: number // epoch ms
}

// ── notifications (the hook that ties to the streaming/perf-stats spike) ─────────────────────────────────────
/** A notification intent: a toast/dialog the UI decides how to render. `sticky` = stays until dismissed (errors,
 *  long-running); otherwise it auto-clears. Authored by a tab OR the controller; fanned out so every tab agrees. */
export type Notification = {
  level: 'info' | 'success' | 'warn' | 'error'
  title: string
  body?: string
  sticky?: boolean
  /** de-dupe key: the singleton fan-out drops a repeat with the same key within a short window. */
  key?: string
}

// ── controller (tab ↔ ServiceWorker) ─────────────────────────────────────────────────────────────────────────
/** A tab's message to the ServiceWorker controller. */
export type ControllerRequest =
  | { kind: 'version' }
  | { kind: 'flush' } // skipWaiting + take control — the cheap "replace the SW now" path
  | { kind: 'notify'; note: Notification } // route a notification through the singleton (may also raise an OS Notification)

/** The controller's message to a tab (posted to one client, or to all via clients.matchAll). */
export type ControllerEvent =
  | { kind: 'version'; version: string; builtAt: string; state: 'active' | 'waiting' }
  | { kind: 'notification'; note: Notification }
  | { kind: 'reload' } // the controller asks tabs to reload after a flush

export const ENGINE_PENDING_LOG = 200 // activity entries the engine keeps for a late-joining tab to replay
