// Node-only isolated evaluator: `MemoryConstrained`'s real enforcement, and `evaluateIsolated`'s
// hard time kill (`terminate()`, the only cancel that always works against a tight loop — see
// design/aestimatio.md §3). Kept out of `./index.ts` so a browser bundle never sees
// `node:worker_threads`.

import { Worker } from "node:worker_threads";

export interface EvaluateIsolatedOptions {
  /** Sized into the worker's `resourceLimits.maxOldGenerationSizeMb` — a real heap cap. */
  readonly memoryBytes?: number;
  /** Hard-killed with `terminate()` after this many milliseconds. */
  readonly timeMs?: number;
  /** Module URL whose `configure(ce)` declares the libraries the host engine has. */
  readonly setup?: string;
}

/** MathJSON for `declareAestimatio`'s `Aborted` symbol (Wolfram's `$Aborted` — see declare.ts). */
const ABORTED = "Aborted";

/**
 * Runs one evaluation of `json` in a fresh `worker_threads` Worker, under the given
 * time/memory caps. Resolves to `$Aborted` (as MathJSON) rather than rejecting when the
 * worker times out, runs out of memory, or otherwise fails — an isolated evaluation is run
 * precisely because the input is not trusted to behave, so a caller should not have to
 * distinguish "the answer is $Aborted" from "the call itself failed".
 */
export function evaluateIsolated(
  json: unknown,
  options: EvaluateIsolatedOptions = {},
): Promise<unknown> {
  const { memoryBytes, timeMs, setup } = options;
  // Loading `./worker.ts` when this module is still its TypeScript source (tests run
  // against `../src/node.ts` before a build) and `./worker.mjs` once packed — the built
  // sibling `vp pack` produces alongside `dist/node.mjs`.
  const ext = import.meta.url.endsWith(".ts") ? ".ts" : ".mjs";
  const workerUrl = new URL(`./worker${ext}`, import.meta.url);
  const maxOldGenerationSizeMb =
    memoryBytes === undefined ? undefined : Math.max(1, Math.ceil(memoryBytes / (1024 * 1024)));

  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const worker = new Worker(workerUrl, {
      workerData: { json, setup },
      resourceLimits: maxOldGenerationSizeMb === undefined ? undefined : { maxOldGenerationSizeMb },
    });
    const finish = (value: unknown): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      void worker.terminate();
      resolve(value);
    };
    if (timeMs !== undefined) timer = setTimeout(() => finish(ABORTED), timeMs);
    worker.once("message", (message: { ok: boolean; json?: unknown }) => {
      finish(message.ok ? message.json : ABORTED);
    });
    // Covers ERR_WORKER_OUT_OF_MEMORY and any other in-worker crash.
    worker.once("error", () => finish(ABORTED));
    worker.once("exit", () => finish(ABORTED));
  });
}
