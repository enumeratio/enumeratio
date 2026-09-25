// Browser-only isolated evaluator: a plain dedicated `Worker` running one evaluation,
// `terminate()` as the hard time kill — design/aestimatio.md §3. Kept out of `./index.ts`
// so a Node bundle never pulls in a `Worker`/`self` entry point (mirrors `./node`).
//
// Memory is enforced only best-effort: browsers give a worker no memory cap to set, so
// this polls the *page's* memory (there is no per-worker reading either) and terminates
// past the bound. See `probeMemoryBytes`'s own comment for exactly what that measures
// and does not.

/** MathJSON for `declareAestimatio`'s `Aborted` symbol (see ./declare.ts's own comment). */
const ABORTED = "Aborted";

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

export interface EvaluateInWorkerOptions {
  /** Hard-killed with `terminate()` after this many milliseconds. */
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
 * "the answer is $Aborted" from "the call itself failed". One worker per call; a
 * reusable pool is future work (design/aestimatio.md §5's `SharedWorker` session).
 */
export function evaluateInWorker(
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

    if (timeMs !== undefined) timer = setTimeout(() => finish(ABORTED), timeMs);

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

    worker.postMessage({ json, setup });
  });
}
