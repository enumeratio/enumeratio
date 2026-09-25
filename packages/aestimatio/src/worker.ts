// Runs INSIDE a `worker_threads` Worker the Node pool (node.ts's `createEvaluatorPool`)
// spawns and reuses. Node-only (`node:worker_threads`) — this is why it is its own build
// entry, never imported by `./index.ts`.
//
// Stateless per CALL, not per engine: this worker keeps one configured `ComputeEngine` per
// `setup` URL for its whole lifetime (`engineFor` below) — declaring a whole library set on
// every single message was the dominant cost of running many small cases through the pool
// (see `@enumeratio/reference`'s `entries.test.ts`, which does exactly that). Only the
// DECLARATIONS survive across calls: each call still runs in its own `pushScope()`/
// `popScope()` (`handle` below), so a `:=` or other binding one caller makes is gone before
// the next caller on this same (reused) worker ever sees it. A session that wants bindings
// to PERSIST across calls uses `./session-worker.ts` instead. A worker that gets hard-killed
// is destroyed outright and the pool spawns a fresh process for the next call, so there is
// never a stale cache to worry about — this only ever caches within one worker's own life.

import { parentPort } from "node:worker_threads";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { evaluateCooperatively } from "./cooperative-evaluate.ts";
import { declareAestimatio } from "./declare.ts";

interface WorkerRequest {
  readonly id: number;
  readonly json: unknown;
  /** Module URL whose `configure(ce)` declares the libraries the host engine has. */
  readonly setup?: string;
  /** The host's `timeMs`, evaluated cooperatively here first — see
   * ./cooperative-evaluate.ts. The host's own hard kill fires only if THIS deadline
   * doesn't stop the call in time, and only starting once it sees this call's `"started"`
   * (node.ts's own comment on why). */
  readonly timeMs?: number;
}

interface WorkerResponse {
  readonly id: number;
  /** `"started"`: engine construction and `setup` import for THIS call are done and
   * `evaluateCooperatively` is about to run — the host arms its hard-kill timer from
   * here, not from when it sent the request, so a slow spawn/import never eats into the
   * deadline it wasn't given a chance to see. `"result"`: the actual answer. */
  readonly kind: "started" | "result";
  readonly ok?: boolean;
  readonly json?: unknown;
  readonly error?: string;
}

/** One configured engine per `setup` URL (`undefined` keys the no-`setup` case), built and
 * declared into ONCE, then reused for every later call this worker serves with that same
 * `setup`. */
const engines = new Map<string | undefined, ComputeEngine>();

async function engineFor(setup: string | undefined): Promise<ComputeEngine> {
  const cached = engines.get(setup);
  if (cached !== undefined) return cached;
  const ce = new ComputeEngine();
  // The worker's engine must mean the same things the caller's does.
  declareAestimatio(ce);
  if (setup !== undefined) {
    const mod = (await import(setup)) as { configure: (ce: ComputeEngine) => void };
    mod.configure(ce);
  }
  engines.set(setup, ce);
  return ce;
}

async function handle(request: WorkerRequest): Promise<void> {
  const { id, json, setup, timeMs } = request;
  const ce = await engineFor(setup);
  parentPort?.postMessage({ id, kind: "started" } satisfies WorkerResponse);
  // A fresh scope for THIS call only: any `:=`/`Assign` (or other binding) it makes lands
  // here, never in the engine's shared base scope where `engineFor`'s declarations live —
  // popped in `finally` whether the call succeeds, fails, or is cooperatively aborted, so
  // the next call on this (reused) worker starts clean regardless of how this one ended.
  ce.pushScope();
  try {
    parentPort?.postMessage({
      id,
      kind: "result",
      ...evaluateCooperatively(ce, json, timeMs),
    } satisfies WorkerResponse);
  } finally {
    ce.popScope();
  }
}

parentPort?.on("message", (request: WorkerRequest) => {
  void handle(request);
});
