// The shared compute-engine instance: created lazily on first use (its own chunk in a
// browser, deduped by the module registry so every element shares one), configured by
// whoever registered a library first. Base-level so the framework glue (`vue.ts`,
// `react.ts`) and the elements parse through the same engine.

import type { ComputeEngine } from "@cortex-js/compute-engine";

let engine: ComputeEngine | undefined;
let enginePromise: Promise<ComputeEngine> | undefined;

const configurators: ((ce: ComputeEngine) => void)[] = [];

/**
 * Register a configurator run against the shared compute-engine -- e.g. to declare
 * an extension library of heads. Applied immediately if the engine already exists,
 * otherwise when it is first created.
 */
export function configureEngine(fn: (ce: ComputeEngine) => void): void {
  configurators.push(fn);
  if (engine) fn(engine);
}

/**
 * A host may set `globalThis.__notatioEngineReady` to a promise that resolves once
 * it has declared all its extension libraries (via `configureEngine`). The shared
 * engine then waits for it before it is created, so the first evaluation already
 * sees every registered head — without this, a host that declares libraries from an
 * async import can lose the race and render before they land. Absent (tests, CLI,
 * plain hosts), engine creation proceeds immediately.
 */
type EngineGate = { __notatioEngineReady?: Promise<unknown> };

/** The shared compute-engine instance, created and configured on first use. */
export function loadEngine(): Promise<ComputeEngine> {
  enginePromise ??= (async () => {
    const gate = (globalThis as EngineGate).__notatioEngineReady;
    if (gate) await gate.catch(() => {});
    const { ComputeEngine } = await import("@cortex-js/compute-engine");
    engine = new ComputeEngine();
    for (const fn of configurators) fn(engine);
    return engine;
  })();
  return enginePromise;
}
