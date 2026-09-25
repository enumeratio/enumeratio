// Runs INSIDE a `worker_threads` Worker the Node pool (node.ts's `createEvaluatorPool`)
// spawns and reuses. Node-only (`node:worker_threads`) — this is why it is its own build
// entry, never imported by `./index.ts`.
//
// Stateless per message: each request gets a fresh `ComputeEngine`, so nothing a caller
// evaluates here can leak into the next caller's turn on this same (reused) worker. A
// session that DOES want state to persist across calls uses `./session-worker.ts`
// instead, one engine per worker for the worker's whole lifetime.

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

async function handle(request: WorkerRequest): Promise<void> {
  const { id, json, setup, timeMs } = request;
  const ce = new ComputeEngine();
  // The worker's engine must mean the same things the caller's does.
  declareAestimatio(ce);
  if (setup !== undefined) {
    const mod = (await import(setup)) as { configure: (ce: ComputeEngine) => void };
    mod.configure(ce);
  }
  parentPort?.postMessage({ id, kind: "started" } satisfies WorkerResponse);
  parentPort?.postMessage({
    id,
    kind: "result",
    ...evaluateCooperatively(ce, json, timeMs),
  } satisfies WorkerResponse);
}

parentPort?.on("message", (request: WorkerRequest) => {
  void handle(request);
});
