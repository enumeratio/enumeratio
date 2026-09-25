// Runs INSIDE the worker `openSession` (./node.ts) spawns. Unlike ./worker.ts, this
// worker holds ONE `ComputeEngine` for its whole lifetime, so `:=` bindings a call makes
// persist for the next one — that's the whole point of a session. Node-only
// (`node:worker_threads`) — its own build entry, never imported by `./index.ts`.

import { parentPort, workerData } from "node:worker_threads";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareAestimatio } from "./declare.ts";

interface SessionWorkerData {
  /** Module URL whose `configure(ce)` declares the libraries the host engine has. Applied
   * once, at startup — a session's engine configuration does not change mid-session. */
  readonly setup?: string;
}

interface EvaluateRequest {
  readonly id: number;
  readonly json: unknown;
}

interface EvaluateResponse {
  readonly id: number;
  readonly ok: boolean;
  readonly json?: unknown;
  readonly error?: string;
}

async function main(): Promise<void> {
  const { setup } = (workerData ?? {}) as SessionWorkerData;
  const ce = new ComputeEngine();
  declareAestimatio(ce);
  if (setup !== undefined) {
    const mod = (await import(setup)) as { configure: (ce: ComputeEngine) => void };
    mod.configure(ce);
  }
  // Messages sent before this listener attaches (the caller can `postMessage` right after
  // spawning) are queued by the port, not lost — safe to configure asynchronously above.
  parentPort?.on("message", (request: EvaluateRequest) => {
    const { id, json } = request;
    const respond = (partial: Omit<EvaluateResponse, "id">): void =>
      parentPort?.postMessage({ id, ...partial });
    try {
      // Bound to the session's one persistent `ce`: a `:=` here is visible next call.
      const result = ce.box(json as never).evaluate();
      respond({ ok: true, json: result.json });
    } catch (e) {
      respond({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });
}

void main();
