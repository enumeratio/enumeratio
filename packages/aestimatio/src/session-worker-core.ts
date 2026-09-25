// The reusable half of a session worker: everything `./browser-session-worker.ts`
// (aestimatio's own worker ENTRY -- a build target, run standalone) does, factored out
// so a consumer that needs its OWN bundled worker entry can import `startSessionWorker`
// and supply `configure` directly, as an already-imported function, instead of a URL
// for this code to `import()` at runtime.
//
// That distinction matters for exactly one reason: a bundler's worker plugin (Vite's
// `new Worker(new URL('./x.ts', import.meta.url), { type: 'module' })` literal, and
// its `?worker`/`?sharedworker` suffix) only ever emits what the worker entry itself
// statically imports. A `setup` URL resolved at runtime via `import(/* @vite-ignore */
// setup)` is invisible to that analysis -- in a plain dev server, Vite serves whatever
// path is asked for, so this "just works"; in a production build, the URL points at
// nothing the build ever emitted as a real JS module (worse, if something ELSE happens
// to make the bundler treat that path as an asset, e.g. a `.ts` extension read as
// MPEG-TS, the worker's `import()` gets back a non-JS MIME type and fails outright).
// `startSessionWorker(configure)` sidesteps the whole question: `configure` is close
// enough at hand when the worker entry itself is written (a site's own worker file, not
// a library that can't know a consumer's directory layout) that it can just be imported
// like anything else.
//
// No `node:*` imports -- shared by both `./browser-session-worker.ts` (aestimatio's own
// entry) and a consumer's own bundled worker entry.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { evaluateCooperatively } from "./cooperative-evaluate.ts";
import { declareAestimatio } from "./declare.ts";

/** Declares whatever libraries the host's own engine has, into the session's. */
export type ConfigureFn = (ce: ComputeEngine) => void | Promise<void>;

export interface HandshakeRequest {
  /** Module URL whose `configure(ce)` declares the libraries the host engine has --
   * ignored when `startSessionWorker` was given its own `configure` directly (see this
   * module's own comment on why a bundled worker entry should do exactly that). Only
   * the FIRST connection's `setup`/`configure` configures the (single, shared) engine
   * -- later connections join whatever is already running, same as later `evaluate`
   * calls do. */
  readonly setup?: string;
}
export interface EvaluateRequest {
  readonly id: number;
  readonly json: unknown;
  /** The host's `timeMs`, tried cooperatively here first — see ./cooperative-evaluate.ts.
   * A call that stops this way keeps every port's bindings, including a SharedWorker's
   * other tabs'; only an uncooperative loop needs the host's own hard kill. */
  readonly timeMs?: number;
}
export interface EvaluateResponse {
  readonly id: number;
  /** `"started"`: the (already-configured) engine is about to run THIS call — the host
   * arms its hard-kill timer from here, not from when it sent the request. See
   * ./worker.ts's own comment; the same reasoning applies to a session's first call on a
   * cold worker, or the first connection to a `SharedWorker` still configuring.
   * `"result"`: the actual answer. */
  readonly kind: "started" | "result";
  readonly ok?: boolean;
  readonly json?: unknown;
  readonly error?: string;
}

/** The subset of `MessagePort` (a `SharedWorker` connection) or `self` (a dedicated
 * `Worker`, which doubles as its own port) this needs. */
export interface PortLike {
  postMessage(message: EvaluateResponse): void;
  onmessage: ((event: { data: HandshakeRequest | EvaluateRequest }) => void) | null;
  start?(): void;
}

/** Builds the session's one persistent engine: aestimatio's own declarations, then
 * `configure`'s (the host's own libraries), if given. */
async function buildEngine(configure?: ConfigureFn): Promise<ComputeEngine> {
  const ce = new ComputeEngine();
  declareAestimatio(ce);
  if (configure) await configure(ce);
  return ce;
}

/** `setup` as a `ConfigureFn` -- today's URL-based path, for a plain dev server or a
 * caller with no bundler-literal constraints of its own. */
function urlConfigure(setup: string): ConfigureFn {
  return async (ce) => {
    const mod = (await import(/* @vite-ignore */ setup)) as { configure: ConfigureFn };
    await mod.configure(ce);
  };
}

/**
 * Runs a session worker's whole message loop against `configure` (or, absent that, a
 * connection's own `{ setup }` handshake URL) -- the body `./browser-session-worker.ts`
 * runs standalone, factored out so a consumer can call this from its OWN bundled worker
 * entry instead (this module's own comment explains why).
 */
export function startSessionWorker(configure?: ConfigureFn): void {
  let engine: Promise<ComputeEngine> | undefined;

  function attachEvaluateHandler(port: PortLike): void {
    port.onmessage = (event) => {
      const request = event.data as EvaluateRequest;
      void (engine as Promise<ComputeEngine>).then(
        (ce) => {
          const { id, json, timeMs } = request;
          port.postMessage({ id, kind: "started" });
          // Bound to the session's one persistent `ce`: a `:=` here is visible to the
          // next call, on this port and (on a SharedWorker) any other tab's port too.
          port.postMessage({ id, kind: "result", ...evaluateCooperatively(ce, json, timeMs) });
        },
        (error: unknown) => {
          // `configure` itself failed (a bad `setup` import, a declare that threw) --
          // answer with a genuine error instead of leaving this call to hang until the
          // host's own spawn-timeout gives up on a worker that, from its own point of
          // view, already started just fine.
          port.postMessage({
            id: request.id,
            kind: "result",
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          });
        },
      );
    };
  }

  /** A connection's first message is always the `{ setup }` handshake -- `openSession`
   * sends it right after opening the port. */
  function handleConnection(port: PortLike): void {
    port.onmessage = (first) => {
      const { setup } = first.data as HandshakeRequest;
      engine ??= buildEngine(configure ?? (setup !== undefined ? urlConfigure(setup) : undefined));
      attachEvaluateHandler(port);
    };
    port.start?.();
  }

  // `self` isn't a declared global under this package's tsconfig (no "dom" lib, so a
  // Node consumer of the sibling ./node entry never sees browser globals it can't run)
  // -- `globalThis` is the same object in a worker and needs no such lib.
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
}
