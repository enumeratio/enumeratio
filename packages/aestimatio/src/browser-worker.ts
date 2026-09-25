// Runs INSIDE the dedicated Worker `evaluateInWorker` (./browser.ts) spawns. No
// `node:*` imports — this is why it is its own build entry, never imported by
// `./index.ts` (see that file's own comment on `./node`/`./worker` for the same reason).

import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareAestimatio } from "./declare.ts";

interface WorkerRequest {
  readonly json: unknown;
  /** Module URL whose `configure(ce)` declares the libraries the host engine has. */
  readonly setup?: string;
}

interface WorkerResponse {
  readonly ok: boolean;
  readonly json?: unknown;
  readonly error?: string;
}

/** The subset of `DedicatedWorkerGlobalScope` this needs — kept local, no "dom" lib. */
interface WorkerScope {
  postMessage(message: WorkerResponse): void;
  addEventListener(type: "message", listener: (event: { data: WorkerRequest }) => void): void;
}

// `self` isn't a declared global under this package's tsconfig (no "dom" lib, so a Node
// consumer of the sibling ./node entry never sees browser globals it can't run) --
// `globalThis` is the same object in a worker and needs no such lib.
const scope = globalThis as unknown as WorkerScope;

async function handle(request: WorkerRequest): Promise<void> {
  const { json, setup } = request;
  const ce = new ComputeEngine();
  // The worker's engine must mean the same things the caller's does.
  declareAestimatio(ce);
  if (setup !== undefined) {
    const mod = (await import(/* @vite-ignore */ setup)) as {
      configure: (ce: ComputeEngine) => void;
    };
    mod.configure(ce);
  }
  try {
    const result = ce.box(json as never).evaluate();
    scope.postMessage({ ok: true, json: result.json });
  } catch (e) {
    scope.postMessage({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

scope.addEventListener("message", (event) => {
  void handle(event.data);
});
