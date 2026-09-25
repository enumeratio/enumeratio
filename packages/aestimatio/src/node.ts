// Node-only isolated evaluation: `MemoryConstrained`'s real enforcement, `evaluateIsolated`'s
// hard time kill (`terminate()`, the only cancel that always works against a tight loop —
// see design/aestimatio.md §3), a reusable worker pool, and a stateful session. Kept out of
// `./index.ts` so a browser bundle never sees `node:worker_threads`.

import { availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";
import { createPool } from "./pool.ts";

/** MathJSON for `declareAestimatio`'s `Aborted` symbol (Wolfram's `$Aborted` — see declare.ts). */
const ABORTED = "Aborted";

/**
 * The worker is asked to stop cooperatively at `timeMs` first (`./cooperative-evaluate.ts`,
 * via `ce.withTimeLimit`/`checkpoint()`) — this call's own hard kill only fires this much
 * later, giving that a chance to land first. When it does, the worker answers normally
 * (reused; a session keeps its bindings); the hard kill only ever catches a tight,
 * uncooperative loop the cooperative deadline couldn't reach.
 *
 * Generous on purpose: on a freshly spawned worker, `timeMs`'s own clock only starts once
 * `handle()` begins running INSIDE it, after `worker_threads` has spun up the thread and
 * imported `@cortex-js/compute-engine` -- measured at ~150-200ms cold, none of which the
 * cooperative deadline sees but all of which counts against this margin. A warm (reused)
 * worker pays none of that, so this only meaningfully delays killing a truly uncooperative
 * loop on a worker's first call.
 */
const COOPERATIVE_GRACE_MS = 500;

function workerUrl(name: string): URL {
  // Loading `./<name>.ts` when this module is still its TypeScript source (tests run
  // against `../src/node.ts` before a build) and `./<name>.mjs` once packed — the built
  // sibling `vp pack` produces alongside `dist/node.mjs`.
  const ext = import.meta.url.endsWith(".ts") ? ".ts" : ".mjs";
  return new URL(`./${name}${ext}`, import.meta.url);
}

// ---------------------------------------------------------------------------------------
// Pool: `./worker.ts` instances reused across `evaluate` calls.
// ---------------------------------------------------------------------------------------

/** The subset of `worker_threads.Worker` the pool needs — kept local so a fake worker in
 * tests doesn't have to implement the rest of `Worker`'s surface. */
export interface NodeWorkerLike {
  postMessage(message: unknown): void;
  terminate(): void | Promise<number>;
  unref(): void;
  ref(): void;
  on(event: "message", listener: (message: unknown) => void): void;
  once(event: "error" | "exit", listener: (...args: unknown[]) => void): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
}

export type NodeWorkerFactory = (
  url: URL,
  options: { resourceLimits?: { maxOldGenerationSizeMb: number } },
) => NodeWorkerLike;

const defaultWorkerFactory: NodeWorkerFactory = (url, options) =>
  new Worker(url, options) as unknown as NodeWorkerLike;

export interface EvaluatorPoolOptions {
  /** Max concurrent workers, across every memory-limit key combined. Default
   * `os.availableParallelism() - 1`, floored at 1. */
  readonly size?: number;
  /** Injectable for tests; defaults to spawning a real `worker_threads.Worker`. */
  readonly createWorker?: NodeWorkerFactory;
}

export interface EvaluateIsolatedOptions {
  /** Sized into the worker's `resourceLimits.maxOldGenerationSizeMb` — a real heap cap.
   * Workers are keyed by this (rounded) limit, since `resourceLimits` are fixed at spawn. */
  readonly memoryBytes?: number;
  /** Tried cooperatively inside the worker first, then hard-killed with `terminate()`
   * `COOPERATIVE_GRACE_MS` past this if that didn't stop it — see
   * `./cooperative-evaluate.ts`. */
  readonly timeMs?: number;
  /** Module URL whose `configure(ce)` declares the libraries the host engine has. */
  readonly setup?: string;
}

/** How one `evaluateDetailed` call came back — `evaluate()`'s richer sibling, distinguishing
 * a cooperative/hard-killed abort from an actual evaluation error (`runCases` needs both). */
export interface EvaluateDetail {
  readonly outcome: "Evaluated" | "Aborted" | "Error";
  /** Present when `outcome` is `"Evaluated"`. */
  readonly value?: unknown;
  /** Present when `outcome` is `"Error"`: the worker's exception message. */
  readonly reason?: string;
  /** Wall-clock milliseconds from this call's start (including any queue wait for a free
   * worker) to its result. */
  readonly ms: number;
}

export interface EvaluatorPool {
  /** Runs one evaluation of `json` on a pooled worker sized for `options.memoryBytes`. See
   * `evaluateIsolated`, which calls this on a shared default pool. */
  evaluate(json: unknown, options?: EvaluateIsolatedOptions): Promise<unknown>;
  /** Like `evaluate`, but keeps a real evaluation error (`outcome: "Error"`, with `reason`)
   * distinct from a timeout/memory abort (`outcome: "Aborted"`) instead of collapsing both
   * to `$Aborted` — what `runCases` (./run-cases.ts) needs to report each case honestly. */
  evaluateDetailed(json: unknown, options?: EvaluateIsolatedOptions): Promise<EvaluateDetail>;
  /** Terminates every idle worker and drops the wait queue. */
  close(): void;
  /** Alias for `close`. */
  terminateAll(): void;
}

function memoryKeyOf(memoryBytes: number | undefined): string {
  if (memoryBytes === undefined) return "default";
  return String(Math.max(1, Math.ceil(memoryBytes / (1024 * 1024))));
}

/**
 * A pool of `worker_threads` workers reused across `evaluate` calls, keyed by memory
 * limit (`resourceLimits` are fixed per worker at spawn, so a call asking for a
 * different `memoryBytes` gets a worker spawned with that limit — separate idle lists
 * per limit, one bounded `size` total). A worker killed for time or memory is replaced
 * (destroyed, a fresh one takes its slot); one that answers normally is reused.
 *
 * Idle workers are `unref()`d so a process that only ever calls `evaluateIsolated` a
 * few times can still exit — a worker is `ref()`d only while it holds a call.
 */
export function createEvaluatorPool(options: EvaluatorPoolOptions = {}): EvaluatorPool {
  const maxSize = Math.max(1, options.size ?? availableParallelism() - 1);
  const createWorker = options.createWorker ?? defaultWorkerFactory;
  const url = workerUrl("worker");
  let nextId = 0;

  const pool = createPool<NodeWorkerLike>({
    maxSize,
    create: (key) => {
      const mb = key === "default" ? undefined : Number(key);
      const worker = createWorker(url, {
        resourceLimits: mb === undefined ? undefined : { maxOldGenerationSizeMb: mb },
      });
      worker.unref();
      return worker;
    },
    destroy: (worker) => void worker.terminate(),
  });

  function evaluateDetailed(
    json: unknown,
    callOptions: EvaluateIsolatedOptions = {},
  ): Promise<EvaluateDetail> {
    const { memoryBytes, timeMs, setup } = callOptions;
    const key = memoryKeyOf(memoryBytes);
    const start = performance.now();
    const ms = (): number => performance.now() - start;
    return pool.acquire(key).then(
      (worker) =>
        new Promise<EvaluateDetail>((resolve) => {
          const id = nextId++;
          let settled = false;
          let timer: ReturnType<typeof setTimeout> | undefined;

          const cleanup = (): void => {
            if (timer !== undefined) clearTimeout(timer);
            worker.off("message", onMessage);
            worker.off("error", onError);
            worker.off("exit", onExit);
          };
          const finish = (detail: EvaluateDetail, disposition: "reused" | "replace"): void => {
            if (settled) return;
            settled = true;
            cleanup();
            if (disposition === "reused") worker.unref();
            pool.release(key, worker, disposition);
            resolve(detail);
          };
          const onMessage = (message: unknown): void => {
            const m = message as { id: number; ok: boolean; json?: unknown; error?: string };
            if (m.id !== id) return; // a stale reply from a request this call gave up on
            // `m.ok` is the only signal that matters here: a worker that answered — even
            // with `json: "Aborted"`, the ordinary value a cooperative deadline (this
            // call's own `timeMs`, or a `TimeConstrained` inside the expression) produces
            // — is "Evaluated". "Aborted" as an OUTCOME is reserved for a case that never
            // got an answer at all: the host's own hard kill below, or a worker crash.
            if (m.ok) finish({ outcome: "Evaluated", value: m.json, ms: ms() }, "reused");
            else finish({ outcome: "Error", reason: m.error, ms: ms() }, "reused");
          };
          // Covers ERR_WORKER_OUT_OF_MEMORY and any other in-worker crash — the worker is
          // gone, not merely slow, so this is always an abort, never a reportable "Error".
          const onError = (): void => finish({ outcome: "Aborted", ms: ms() }, "replace");
          const onExit = (): void => finish({ outcome: "Aborted", ms: ms() }, "replace");

          worker.on("message", onMessage);
          worker.once("error", onError);
          worker.once("exit", onExit);
          if (timeMs !== undefined) {
            timer = setTimeout(
              () => finish({ outcome: "Aborted", ms: ms() }, "replace"),
              timeMs + COOPERATIVE_GRACE_MS,
            );
          }
          worker.ref();
          worker.postMessage({ id, json, setup, timeMs });
        }),
    );
  }

  function evaluate(json: unknown, callOptions: EvaluateIsolatedOptions = {}): Promise<unknown> {
    return evaluateDetailed(json, callOptions).then((detail) =>
      detail.outcome === "Evaluated" ? detail.value : ABORTED,
    );
  }

  return {
    evaluate,
    evaluateDetailed,
    close: () => pool.close(),
    terminateAll: () => pool.close(),
  };
}

let defaultPool: EvaluatorPool | undefined;
function getDefaultPool(): EvaluatorPool {
  return (defaultPool ??= createEvaluatorPool());
}

/**
 * Runs one evaluation of `json` under the given time/memory caps, on a lazily-created
 * default pool (see `createEvaluatorPool`) so repeat calls reuse workers rather than
 * spawning a fresh one each time. Resolves to `$Aborted` (as MathJSON) rather than
 * rejecting when the worker times out, runs out of memory, or otherwise fails — an
 * isolated evaluation is run precisely because the input is not trusted to behave, so a
 * caller should not have to distinguish "the answer is $Aborted" from "the call itself
 * failed".
 */
export function evaluateIsolated(
  json: unknown,
  options: EvaluateIsolatedOptions = {},
): Promise<unknown> {
  return getDefaultPool().evaluate(json, options);
}

// ---------------------------------------------------------------------------------------
// Session: one `./session-worker.ts`, one `ComputeEngine`, held across `evaluate` calls —
// for a notebook evaluating off the caller's own thread. See design/aestimatio.md §5.
// ---------------------------------------------------------------------------------------

export type NodeSessionWorkerFactory = (
  url: URL,
  options: { workerData?: unknown },
) => NodeWorkerLike;

export interface SessionOptions {
  /** Module URL whose `configure(ce)` declares the libraries the session's engine has.
   * Applied once, when the session (or its post-reset replacement worker) starts. */
  readonly setup?: string;
  /** Injectable for tests; defaults to spawning a real `worker_threads.Worker`. */
  readonly createWorker?: NodeSessionWorkerFactory;
}

export interface EvaluateSessionOptions {
  /** Tried cooperatively inside the worker first (`./cooperative-evaluate.ts`) — a call
   * that stops that way keeps the session's bindings. Only past `timeMs +
   * COOPERATIVE_GRACE_MS` does this hard-kill the worker with `terminate()`; see
   * `Session`'s own comment on what THAT does to the session's state. */
  readonly timeMs?: number;
  /** Aborting rejects this call; unlike `timeMs`, it does not touch the worker — another
   * call, or the session itself, may still be using it. */
  readonly signal?: AbortSignal;
}

export interface SessionEvaluateResult {
  readonly value: unknown;
  /** True exactly when THIS call's `timeMs` killed the worker: `:=` bindings made before
   * it are gone, and a fresh worker (with a fresh engine) now backs the session. */
  readonly reset: boolean;
}

export interface Session {
  /** Evaluates `json` against the session's persistent engine — a `:=` binding it makes
   * is visible to the next `evaluate` call. */
  evaluate(json: unknown, options?: EvaluateSessionOptions): Promise<SessionEvaluateResult>;
  /** Terminates the session's worker. Further `evaluate` calls throw. */
  close(): void;
}

/**
 * Opens a session: one worker, one `ComputeEngine`, alive until `close()`. Unlike
 * `evaluateIsolated`'s per-call workers, state persists across `evaluate` calls — `a :=
 * 5` in one call is visible to `a^2` in the next.
 *
 * A `timeMs` kill on a runaway call terminates the worker outright (`terminate()` is the
 * only cancel that reliably stops a tight, uncooperative loop — design/aestimatio.md
 * §3): a fresh worker with a fresh engine takes over for the NEXT call, but everything
 * bound before the kill is gone. That call's own result reports `reset: true` rather
 * than silently continuing as if nothing happened.
 */
export function openSession(options: SessionOptions = {}): Session {
  const { setup } = options;
  const url = workerUrl("session-worker");
  const createWorker: NodeSessionWorkerFactory =
    options.createWorker ?? ((u, o) => new Worker(u, o) as unknown as NodeWorkerLike);
  const spawn = (): NodeWorkerLike => createWorker(url, { workerData: { setup } });
  let worker: NodeWorkerLike = spawn();
  let nextId = 0;
  let closed = false;

  function evaluate(
    json: unknown,
    callOptions: EvaluateSessionOptions = {},
  ): Promise<SessionEvaluateResult> {
    if (closed) throw new Error("openSession: evaluate() called after close()");
    const { timeMs, signal } = callOptions;
    const id = nextId++;
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const cleanup = (): void => {
        if (timer !== undefined) clearTimeout(timer);
        worker.off("message", onMessage);
        signal?.removeEventListener("abort", onAbort);
      };
      const onAbort = (): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new DOMException("The evaluate() call was aborted.", "AbortError"));
      };
      const onMessage = (message: unknown): void => {
        const m = message as { id: number; ok: boolean; json?: unknown };
        if (m.id !== id || settled) return;
        settled = true;
        cleanup();
        resolve({ value: m.ok ? m.json : ABORTED, reset: false });
      };

      worker.on("message", onMessage);
      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener("abort", onAbort);

      if (timeMs !== undefined) {
        timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          void worker.terminate();
          worker = spawn();
          resolve({ value: ABORTED, reset: true });
        }, timeMs + COOPERATIVE_GRACE_MS);
      }

      worker.postMessage({ id, json, timeMs });
    });
  }

  function close(): void {
    closed = true;
    void worker.terminate();
  }

  return { evaluate, close };
}

// ---------------------------------------------------------------------------------------
// Batch evaluation of many independent cases — see ./run-cases.ts. Re-exported here (never
// from ./index.ts) since it's Node-only, same as everything else in this module.
// ---------------------------------------------------------------------------------------

export type { Case, CaseResult, RunCasesOptions } from "./run-cases.ts";
export { runCases } from "./run-cases.ts";
