// Runs INSIDE the worker `openSession` (./browser.ts) spawns -- either a dedicated
// `Worker` (this script IS the worker) or a `SharedWorker` (this script runs once, and
// each connecting tab arrives via `onconnect` with its own port). Either way, ONE
// `ComputeEngine` backs every port here, so `:=` bindings persist across `evaluate`
// calls -- and, on a `SharedWorker`, across the tabs sharing it. No `node:*` imports --
// its own build entry, never imported by `./index.ts`.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { evaluateCooperatively } from "./cooperative-evaluate.ts";
import { declareAestimatio } from "./declare.ts";

interface HandshakeRequest {
  /** Module URL whose `configure(ce)` declares the libraries the host engine has. Only
   * the FIRST connection's `setup` configures the (single, shared) engine -- later
   * connections join whatever is already running, same as later `evaluate` calls do. */
  readonly setup?: string;
}
interface EvaluateRequest {
  readonly id: number;
  readonly json: unknown;
  /** The host's `timeMs`, tried cooperatively here first — see ./cooperative-evaluate.ts.
   * A call that stops this way keeps every port's bindings, including a SharedWorker's
   * other tabs'; only an uncooperative loop needs the host's own hard kill. */
  readonly timeMs?: number;
}
interface EvaluateResponse {
  readonly id: number;
  readonly ok: boolean;
  readonly json?: unknown;
  readonly error?: string;
}

/** The subset of `MessagePort` (a `SharedWorker` connection) or `self` (a dedicated
 * `Worker`, which doubles as its own port) this needs. */
interface PortLike {
  postMessage(message: EvaluateResponse): void;
  onmessage: ((event: { data: HandshakeRequest | EvaluateRequest }) => void) | null;
  start?(): void;
}

let engine: Promise<ComputeEngine> | undefined;

async function configure(setup: string | undefined): Promise<ComputeEngine> {
  const ce = new ComputeEngine();
  declareAestimatio(ce);
  if (setup !== undefined) {
    const mod = (await import(/* @vite-ignore */ setup)) as {
      configure: (ce: ComputeEngine) => void;
    };
    mod.configure(ce);
  }
  return ce;
}

function attachEvaluateHandler(port: PortLike): void {
  port.onmessage = (event) => {
    const request = event.data as EvaluateRequest;
    void (engine as Promise<ComputeEngine>).then((ce) => {
      const { id, json, timeMs } = request;
      // Bound to the session's one persistent `ce`: a `:=` here is visible to the next
      // call, on this port and (on a SharedWorker) any other tab's port too.
      port.postMessage({ id, ...evaluateCooperatively(ce, json, timeMs) });
    });
  };
}

/** A connection's first message is always the `{ setup }` handshake -- `openSession`
 * sends it right after opening the port. */
function handleConnection(port: PortLike): void {
  port.onmessage = (first) => {
    const { setup } = first.data as HandshakeRequest;
    engine ??= configure(setup);
    attachEvaluateHandler(port);
  };
  port.start?.();
}

// `self` isn't a declared global under this package's tsconfig (no "dom" lib, so a Node
// consumer of the sibling ./node entry never sees browser globals it can't run) --
// `globalThis` is the same object in a worker and needs no such lib.
const scope = globalThis as unknown as PortLike & {
  onconnect?: (event: { ports: PortLike[] }) => void;
};

if ("onconnect" in scope) {
  // SharedWorker: each tab's connection gets its own port.
  scope.onconnect = (event) => handleConnection(event.ports[0]!);
} else {
  // Dedicated Worker: the global scope doubles as the one connection's port.
  handleConnection(scope);
}
