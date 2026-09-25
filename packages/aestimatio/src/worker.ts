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
   * doesn't stop the call in time. */
  readonly timeMs?: number;
}

interface WorkerResponse {
  readonly id: number;
  readonly ok: boolean;
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
  parentPort?.postMessage({
    id,
    ...evaluateCooperatively(ce, json, timeMs),
  } satisfies WorkerResponse);
}

parentPort?.on("message", (request: WorkerRequest) => {
  void handle(request);
});
