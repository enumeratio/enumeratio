// Runs INSIDE the worker thread `evaluateIsolated` spawns. Node-only (`node:worker_threads`)
// — this is why it is its own build entry, never imported by `./index.ts`.

import { parentPort, workerData } from "node:worker_threads";
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

async function main(): Promise<void> {
  const { json, setup } = workerData as WorkerRequest;
  const ce = new ComputeEngine();
  // The worker's engine must mean the same things the caller's does.
  declareAestimatio(ce);
  if (setup !== undefined) {
    const mod = (await import(setup)) as { configure: (ce: ComputeEngine) => void };
    mod.configure(ce);
  }
  const respond = (response: WorkerResponse): void => parentPort?.postMessage(response);
  try {
    const result = ce.box(json as never).evaluate();
    respond({ ok: true, json: result.json });
  } catch (e) {
    respond({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

void main();
