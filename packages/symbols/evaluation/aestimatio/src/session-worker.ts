// Runs INSIDE the worker `openSession` (./node.ts) spawns. Unlike ./worker.ts, this
// worker holds ONE `ComputeEngine` for its whole lifetime, so `:=` bindings a call makes
// persist for the next one — that's the whole point of a session. Node-only
// (`node:worker_threads`) — its own build entry, never imported by `./index.ts`.

import { parentPort, workerData } from "node:worker_threads";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { evaluateCooperatively } from "./cooperative-evaluate.ts";
import { declareAestimatio } from "./declare.ts";

interface SessionWorkerData {
  /** Module URL whose `configure(ce)` declares the libraries the host engine has. Applied
   * once, at startup — a session's engine configuration does not change mid-session. */
  readonly setup?: string;
}

interface EvaluateRequest {
  readonly id: number;
  readonly json: unknown;
  /** The host's `timeMs`, tried cooperatively here first (./cooperative-evaluate.ts). A
   * call that stops this way keeps the session's bindings; only an uncooperative loop
   * that outruns the host's own (longer) hard-kill timer loses them. */
  readonly timeMs?: number;
}

interface EvaluateResponse {
  readonly id: number;
  /** `"started"`: this call has reached the front of the queue and is about to run
   * against the (already-configured) engine — the host arms its hard-kill timer from
   * here, not from when it sent the request. `"result"`: the actual answer. See
   * ./worker.ts's own comment; the same reasoning applies to a session's first call,
   * which can otherwise be delayed behind the worker's own cold start. */
  readonly kind: "started" | "result";
  readonly ok?: boolean;
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
    const { id, json, timeMs } = request;
    parentPort?.postMessage({ id, kind: "started" } satisfies EvaluateResponse);
    // Bound to the session's one persistent `ce`: a `:=` here is visible next call.
    parentPort?.postMessage({
      id,
      kind: "result",
      ...evaluateCooperatively(ce, json, timeMs),
    } satisfies EvaluateResponse);
  });
}

void main();
