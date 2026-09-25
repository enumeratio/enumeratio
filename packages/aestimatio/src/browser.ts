// Browser-only isolated evaluation: a plain dedicated `Worker` running one evaluation,
// `terminate()` as the hard time kill — design/aestimatio.md §3; a reusable pool across
// calls; and a session (preferring `SharedWorker` so tabs can join one). Kept out of
// `./index.ts` so a Node bundle never pulls in a `Worker`/`self` entry point (mirrors
// `./node`).
//
// Memory is enforced only best-effort: browsers give a worker no memory cap to set, so
// this polls the *page's* memory (there is no per-worker reading either) and terminates
// past the bound. See `probeMemoryBytes`'s own comment for exactly what that measures
// and does not.

import { createPool } from "./pool.ts";

/** MathJSON for `declareAestimatio`'s `Aborted` symbol (see ./declare.ts's own comment). */
const ABORTED = "Aborted";

/**
 * The worker is asked to stop cooperatively at `timeMs` first (`./cooperative-evaluate.ts`,
 * via `ce.withTimeLimit`/`checkpoint()`) — this call's own hard kill only fires this much
 * later, giving that a chance to land first. When it does, the worker answers normally
 * (reused; a session keeps its bindings); the hard kill only ever catches a tight,
 * uncooperative loop the cooperative deadline couldn't reach.
 */
const COOPERATIVE_GRACE_MS = 200;

interface WorkerMessageEvent {
  readonly data: unknown;
}
interface WorkerErrorEvent {
  readonly message?: string;
}

/**
 * The subset of the DOM `Worker` this module needs. Kept local rather than pulling in
 * `lib.dom` (this package's tsconfig only has `node` types, so a Node consumer of
 * `./node`/`./worker` never sees browser globals it can't run) — and it doubles as the
 * seam a test injects a fake through.
 */
export interface WorkerLike {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: WorkerMessageEvent) => void) | null;
  onerror: ((event: WorkerErrorEvent) => void) | null;
}

export type WorkerFactory = (url: URL, options: { type: "module" }) => WorkerLike;

/** The subset of `MessagePort` a session or a `SharedWorker` connection needs. */
export interface MessagePortLike {
  postMessage(message: unknown): void;
  start?(): void;
  /** Only meaningful on a real `SharedWorker`'s port -- disconnects this tab's connection
   * without touching the shared worker or its other tabs. Used when poisoning a session
   * (see `openSession`'s own comment). */
  close?(): void;
  onmessage: ((event: WorkerMessageEvent) => void) | null;
}

/** The subset of `SharedWorker` a session needs. */
export interface SharedWorkerLike {
  readonly port: MessagePortLike;
}

export type SharedWorkerFactory = (
  url: URL,
  options: { name?: string; type: "module" },
) => SharedWorkerLike;

export interface EvaluateInWorkerOptions {
  /** Tried cooperatively inside the worker first, then hard-killed with `terminate()`
   * `COOPERATIVE_GRACE_MS` past this if that didn't stop it — see
   * `./cooperative-evaluate.ts`. */
  readonly timeMs?: number;
  /**
   * Best-effort only: there is no way to give a browser Worker a real memory cap. See
   * `probeMemoryBytes`.
   */
  readonly memoryBytes?: number;
  /** Module URL whose `configure(ce)` declares the libraries the host engine has. */
  readonly setup?: string;
  /** Aborting also terminates the worker, resolving `$Aborted` — same as a timeout. */
  readonly signal?: AbortSignal;
  /** How often to poll memory, in ms, when `memoryBytes` is set. Default 200. */
  readonly memoryPollMs?: number;
  /** Injectable for tests; defaults to the global `Worker`. */
  readonly createWorker?: WorkerFactory;
  /** Injectable for tests; defaults to `probeMemoryBytes`. */
  readonly measureMemory?: () => Promise<number | undefined>;
}

function globalWorkerFactory(): WorkerFactory {
  const ctor = (
    globalThis as {
      Worker?: new (url: URL, options: { type: "module" }) => WorkerLike;
    }
  ).Worker;
  if (ctor === undefined) {
    throw new Error(
      "evaluateInWorker: no global Worker in this environment -- pass createWorker (e.g. in a test)",
    );
  }
  return (url, options) => new ctor(url, options);
}

/**
 * Best-effort process memory, in bytes: `performance.measureUserAgentSpecificMemory()`
 * where it's available (cross-origin-isolated pages, per-origin, includes workers),
 * else Chromium's non-standard `performance.memory.usedJSHeapSize` (this document's
 * heap only, NOT the worker's), else `undefined` -- which means "cannot tell", never
 * "zero". Neither reading isolates the one evaluation from anything else running in
 * the page or its other workers, so a bound can trip on memory this call never touched,
 * or miss growth the browser hasn't accounted for yet. It is a guardrail, not a cap.
 */
export async function probeMemoryBytes(): Promise<number | undefined> {
  const perf = globalThis.performance as
    | {
        measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>;
        memory?: { usedJSHeapSize: number };
      }
    | undefined;
  if (typeof perf?.measureUserAgentSpecificMemory === "function") {
    try {
      return (await perf.measureUserAgentSpecificMemory()).bytes;
    } catch {
      return undefined;
    }
  }
  return perf?.memory?.usedJSHeapSize;
}

/**
 * Runs one evaluation of `json` in a fresh dedicated `Worker`, under the given
 * time/memory caps. Resolves to `$Aborted` (as MathJSON) rather than rejecting when the
 * worker times out, is memory-terminated, errors, or the caller's `signal` fires — same
 * contract as `./node`'s `evaluateIsolated`: a caller should not have to distinguish
 * "the answer is $Aborted" from "the call itself failed".
 *
 * Routed through the shared default pool, unless the caller injects `createWorker` or
 * `measureMemory` (as the tests do): that asks for control of this one call's worker, so it
 * gets its own. For pooling with injected fakes, use `createEvaluatorPool({ createWorker })`.
 */
export function evaluateInWorker(
  json: unknown,
  options: EvaluateInWorkerOptions = {},
): Promise<unknown> {
  if (options.createWorker !== undefined || options.measureMemory !== undefined) {
    return evaluateInWorkerOnce(json, options);
  }
  return getDefaultPool().evaluate(json, options);
}

function evaluateInWorkerOnce(
  json: unknown,
  options: EvaluateInWorkerOptions = {},
): Promise<unknown> {
  const { timeMs, memoryBytes, setup, signal, memoryPollMs = 200 } = options;
  const createWorker = options.createWorker ?? globalWorkerFactory();
  const measureMemory = options.measureMemory ?? probeMemoryBytes;
  // Loading `./browser-worker.ts` when this module is still its TypeScript source
  // (tests run against `../src/browser.ts` before a build) and `./browser-worker.mjs`
  // once packed — mirrors `./node`'s own `evaluateIsolated`.
  const ext = import.meta.url.endsWith(".ts") ? ".ts" : ".mjs";
  const workerUrl = new URL(`./browser-worker${ext}`, import.meta.url);

  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let memoryTimer: ReturnType<typeof setInterval> | undefined;
    const worker = createWorker(workerUrl, { type: "module" });

    const onAbort = (): void => finish(ABORTED);

    const finish = (value: unknown): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      if (memoryTimer !== undefined) clearInterval(memoryTimer);
      signal?.removeEventListener("abort", onAbort);
      worker.terminate();
      resolve(value);
    };

    if (signal?.aborted) {
      finish(ABORTED);
      return;
    }
    signal?.addEventListener("abort", onAbort);

    if (timeMs !== undefined) {
      timer = setTimeout(() => finish(ABORTED), timeMs + COOPERATIVE_GRACE_MS);
    }

    if (memoryBytes !== undefined) {
      memoryTimer = setInterval(() => {
        void measureMemory().then((bytes) => {
          if (bytes !== undefined && bytes > memoryBytes) finish(ABORTED);
        });
      }, memoryPollMs);
    }

    worker.onmessage = (event) => {
      const message = event.data as { ok: boolean; json?: unknown };
      finish(message.ok ? message.json : ABORTED);
    };
    // Covers a worker script error (a bad `setup` module, an uncaught exception).
    worker.onerror = () => finish(ABORTED);

    worker.postMessage({ json, setup, timeMs });
  });
}

// ---------------------------------------------------------------------------------------
// Pool: `./browser-worker.ts` instances reused across `evaluateInWorker` calls. Unlike
// Node, a browser Worker has no per-worker resource limit to key on, so this pool has a
// single "default" bucket -- see ./pool.ts's own comment on the key parameter.
// ---------------------------------------------------------------------------------------

export interface BrowserEvaluatorPoolOptions {
  /** Max concurrent workers. Default `navigator.hardwareConcurrency - 1`, floored at 1
   * (or 3, when `hardwareConcurrency` isn't reported). */
  readonly size?: number;
  /** Injectable for tests; defaults to the global `Worker`. */
  readonly createWorker?: WorkerFactory;
  /** Injectable for tests; defaults to `probeMemoryBytes`. */
  readonly measureMemory?: () => Promise<number | undefined>;
}

export interface BrowserEvaluatorPool {
  /** Runs one evaluation of `json` on a pooled worker. See `evaluateInWorker`, which
   * calls this on a shared default pool. */
  evaluate(json: unknown, options?: EvaluateInWorkerOptions): Promise<unknown>;
  /** Terminates every idle worker and drops the wait queue. */
  close(): void;
  /** Alias for `close`. */
  terminateAll(): void;
}

const DEFAULT_POOL_KEY = "default";

function defaultPoolSize(): number {
  const hardwareConcurrency = (globalThis as { navigator?: { hardwareConcurrency?: number } })
    .navigator?.hardwareConcurrency;
  return Math.max(1, (hardwareConcurrency ?? 4) - 1);
}

/**
 * A pool of dedicated `Worker`s reused across `evaluate` calls. A worker that answers
 * normally, or whose call was abandoned before it ever received one (an already-aborted
 * `signal`), is reused; one killed mid-flight for time, memory, or a script error is
 * replaced (terminated, a fresh one takes its slot) — it may still be running whatever it
 * was given, and there is no way in a browser to confirm it has actually stopped.
 */
export function createEvaluatorPool(
  options: BrowserEvaluatorPoolOptions = {},
): BrowserEvaluatorPool {
  const maxSize = Math.max(1, options.size ?? defaultPoolSize());
  const createWorker = options.createWorker ?? globalWorkerFactory();
  const measureMemory = options.measureMemory ?? probeMemoryBytes;
  const ext = import.meta.url.endsWith(".ts") ? ".ts" : ".mjs";
  const workerUrl = new URL(`./browser-worker${ext}`, import.meta.url);

  const pool = createPool<WorkerLike>({
    maxSize,
    create: () => createWorker(workerUrl, { type: "module" }),
    destroy: (worker) => worker.terminate(),
  });

  function evaluate(json: unknown, options: EvaluateInWorkerOptions = {}): Promise<unknown> {
    const { timeMs, memoryBytes, setup, signal, memoryPollMs = 200 } = options;
    return pool.acquire(DEFAULT_POOL_KEY).then(
      (worker) =>
        new Promise<unknown>((resolve) => {
          let settled = false;
          let timer: ReturnType<typeof setTimeout> | undefined;
          let memoryTimer: ReturnType<typeof setInterval> | undefined;

          const cleanup = (): void => {
            if (timer !== undefined) clearTimeout(timer);
            if (memoryTimer !== undefined) clearInterval(memoryTimer);
            signal?.removeEventListener("abort", onAbort);
            worker.onmessage = null;
            worker.onerror = null;
          };
          const finish = (value: unknown, disposition: "reused" | "replace"): void => {
            if (settled) return;
            settled = true;
            cleanup();
            pool.release(DEFAULT_POOL_KEY, worker, disposition);
            resolve(value);
          };
          const onAbort = (): void => finish(ABORTED, "replace");

          if (signal?.aborted) {
            // Never posted to -- the worker itself did nothing, safe to hand straight back.
            finish(ABORTED, "reused");
            return;
          }
          signal?.addEventListener("abort", onAbort);

          if (timeMs !== undefined) {
            timer = setTimeout(() => finish(ABORTED, "replace"), timeMs + COOPERATIVE_GRACE_MS);
          }

          if (memoryBytes !== undefined) {
            memoryTimer = setInterval(() => {
              void measureMemory().then((bytes) => {
                if (bytes !== undefined && bytes > memoryBytes) finish(ABORTED, "replace");
              });
            }, memoryPollMs);
          }

          worker.onmessage = (event) => {
            const message = event.data as { ok: boolean; json?: unknown };
            finish(message.ok ? message.json : ABORTED, "reused");
          };
          worker.onerror = () => finish(ABORTED, "replace");

          worker.postMessage({ json, setup, timeMs });
        }),
    );
  }

  return {
    evaluate,
    close: () => pool.close(),
    terminateAll: () => pool.close(),
  };
}

let defaultBrowserPool: BrowserEvaluatorPool | undefined;
function getDefaultPool(): BrowserEvaluatorPool {
  return (defaultBrowserPool ??= createEvaluatorPool());
}

// ---------------------------------------------------------------------------------------
// Session: one `./browser-session-worker.ts`, one `ComputeEngine`, held across `evaluate`
// calls. Prefers a `SharedWorker` (tabs can join the same named session); falls back to a
// dedicated `Worker` where `SharedWorker` isn't available. See design/aestimatio.md §5.
// ---------------------------------------------------------------------------------------

function globalSharedWorkerFactory(): SharedWorkerFactory | undefined {
  const ctor = (
    globalThis as { SharedWorker?: new (url: URL, options: unknown) => SharedWorkerLike }
  ).SharedWorker;
  if (ctor === undefined) return undefined;
  return (url, options) => new ctor(url, options);
}

export interface BrowserSessionOptions {
  /** Module URL whose `configure(ce)` declares the libraries the session's engine has. */
  readonly setup?: string;
  /** Joins (or starts) the `SharedWorker` session of this name — tabs that pass the same
   * `name` share one engine and its bindings. Ignored by the dedicated-`Worker` fallback,
   * which is inherently single-tab. */
  readonly name?: string;
  /** Injectable for tests; defaults to the global `SharedWorker` when present. */
  readonly createSharedWorker?: SharedWorkerFactory;
  /** Injectable for tests; defaults to the global `Worker`. Only used when `SharedWorker`
   * isn't available (or a test forces the fallback by omitting `createSharedWorker`). */
  readonly createWorker?: WorkerFactory;
}

export interface BrowserEvaluateSessionOptions {
  /** Tried cooperatively inside the worker/port first (`./cooperative-evaluate.ts`) -- a
   * call that stops that way keeps every bound name, including a SharedWorker's other
   * tabs'. Only past `timeMs + COOPERATIVE_GRACE_MS` does this hard-kill: on the
   * dedicated-`Worker` fallback that's `terminate()` (see `BrowserSession`'s own comment
   * on what that does to state); on a `SharedWorker` there is no safe way to kill a
   * context other tabs may be using, so THIS tab instead poisons its handle to the
   * shared session and switches to a private dedicated worker -- see `openSession`'s own
   * comment. */
  readonly timeMs?: number;
  /** Aborting rejects this call without touching the worker. */
  readonly signal?: AbortSignal;
}

export interface BrowserSessionEvaluateResult {
  readonly value: unknown;
  /** True exactly when THIS call's `timeMs` (past its grace) had to hard-kill: on the
   * dedicated-`Worker` fallback, its own worker; on a `SharedWorker`, THIS tab's handle
   * to it (poisoned and replaced with a private dedicated worker -- other tabs are
   * unaffected). Either way, bindings made before it are gone for the caller of THIS
   * session. `false` whenever a cooperative stop landed in time. */
  readonly reset: boolean;
}

export interface BrowserSession {
  evaluate(
    json: unknown,
    options?: BrowserEvaluateSessionOptions,
  ): Promise<BrowserSessionEvaluateResult>;
  /** Stops using the session. On a dedicated `Worker`, terminates it. On a `SharedWorker`,
   * this tab merely disconnects -- other tabs sharing it are unaffected. */
  close(): void;
}

function sessionWorkerUrl(): URL {
  const ext = import.meta.url.endsWith(".ts") ? ".ts" : ".mjs";
  return new URL(`./browser-session-worker${ext}`, import.meta.url);
}

/**
 * Opens a session (see `BrowserSessionOptions`/`BrowserEvaluateSessionOptions`'s own
 * comments for the per-call contract). On a `SharedWorker`, a call whose `timeMs` (plus
 * its grace) elapses without a cooperative answer can't be handled by killing anything --
 * other tabs may depend on that shared engine. Instead THIS TAB's handle to it is
 * abandoned (poisoned: its port is closed and dropped) and replaced with a private
 * dedicated `Worker` running the same `setup`, exactly as if `SharedWorker` had never
 * been available -- that call's own result still reports `reset: true`, since this tab's
 * bindings are gone either way, but the shared session itself, and every other tab still
 * using it, is untouched. Once poisoned, later hard kills on THIS session behave like the
 * ordinary dedicated-`Worker` fallback (kill, respawn, `reset: true`).
 */
export function openSession(options: BrowserSessionOptions = {}): BrowserSession {
  const { setup, name } = options;
  const url = sessionWorkerUrl();
  const sharedFactory =
    options.createSharedWorker ??
    (options.createWorker === undefined ? globalSharedWorkerFactory() : undefined);
  // Resolved lazily -- and only once -- so a session that never poisons/falls back never
  // touches the global `Worker` (which throws where there isn't one, e.g. this package's
  // own tests, or a SharedWorker-only environment).
  let dedicatedFactory: WorkerFactory | undefined;
  const getDedicatedFactory = (): WorkerFactory =>
    (dedicatedFactory ??= options.createWorker ?? globalWorkerFactory());

  let port: MessagePortLike;
  let dedicated = false; // true once started as (or poisoned into) the dedicated fallback
  let terminateCurrent: (() => void) | undefined; // undefined on a SharedWorker's port

  function spawnDedicated(): void {
    const worker = getDedicatedFactory()(url, { type: "module" });
    port = worker as unknown as MessagePortLike;
    terminateCurrent = () => worker.terminate();
    dedicated = true;
    port.postMessage({ setup });
  }

  if (sharedFactory !== undefined) {
    const shared = sharedFactory(url, { name, type: "module" });
    port = shared.port;
    port.start?.();
    // Every connection (a SharedWorker's per-tab port, or a dedicated worker acting as
    // its own one) starts with a handshake message carrying `setup` -- see
    // browser-session-worker.ts's own comment on why only the first one's setup sticks.
    port.postMessage({ setup });
  } else {
    spawnDedicated();
  }

  let nextId = 0;
  let closed = false;

  function evaluate(
    json: unknown,
    callOptions: BrowserEvaluateSessionOptions = {},
  ): Promise<BrowserSessionEvaluateResult> {
    if (closed) throw new Error("openSession: evaluate() called after close()");
    const { timeMs, signal } = callOptions;
    const id = nextId++;
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const currentPort = port;
      // Captured now, not read from the live `dedicated`/`terminateCurrent` when the
      // timer fires: a concurrent call could otherwise have already poisoned/respawned
      // the session by then, and this call's own kill decision is about the port IT sent
      // its message to, not whatever the session has moved on to since.
      const wasDedicated = dedicated;
      const terminateMine = terminateCurrent;

      const cleanup = (): void => {
        if (timer !== undefined) clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        if (currentPort.onmessage === onMessage) currentPort.onmessage = null;
      };
      const onAbort = (): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new DOMException("The evaluate() call was aborted.", "AbortError"));
      };
      const onMessage = (event: WorkerMessageEvent): void => {
        const m = event.data as { id: number; ok: boolean; json?: unknown };
        if (m.id !== id || settled) return;
        settled = true;
        cleanup();
        // A cooperative stop (m.json === "Aborted") arrives over THIS message path too --
        // the worker survived, so no reset either way.
        resolve({ value: m.ok ? m.json : ABORTED, reset: false });
      };

      currentPort.onmessage = onMessage;
      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener("abort", onAbort);

      if (timeMs !== undefined) {
        timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          signal?.removeEventListener("abort", onAbort);
          if (currentPort.onmessage === onMessage) currentPort.onmessage = null;
          if (wasDedicated) {
            // Kill it outright (the only reliable cancel for a tight, uncooperative
            // loop -- design/aestimatio.md §3) and start fresh for the next call.
            terminateMine?.();
            spawnDedicated();
          } else {
            // SharedWorker, and the cooperative deadline didn't save it: nothing here
            // is safe to kill on other tabs' behalf. Poison THIS tab's handle -- close
            // its port and abandon it -- and switch to a private dedicated worker
            // instead; other tabs keep the shared session untouched.
            currentPort.close?.();
            spawnDedicated();
          }
          resolve({ value: ABORTED, reset: true });
        }, timeMs + COOPERATIVE_GRACE_MS);
      }

      currentPort.postMessage({ id, json, timeMs });
    });
  }

  function close(): void {
    closed = true;
    terminateCurrent?.();
  }

  return { evaluate, close };
}
