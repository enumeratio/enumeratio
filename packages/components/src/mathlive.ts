// Lazy MathLive/compute-engine loaders. Each dynamic import becomes its own
// hashed chunk: fetched once, browser-cached, and deduped by the module registry
// so multiple elements on a page share a single instance. Read-only pages pull
// only the lighter `mathlive/ssr` markup chunk and never the editor.
//
// This module owns the whole MathLive integration (fonts, CSS, engine) so hosts
// depend on @enumeratio/components alone, not on mathlive or compute-engine.

import type { ComputeEngine } from "@cortex-js/compute-engine";

let assetsPromise: Promise<void> | undefined;
let markupPromise: Promise<(latex: string) => string> | undefined;
let engine: ComputeEngine | undefined;
let enginePromise: Promise<ComputeEngine> | undefined;

const configurators: ((ce: ComputeEngine) => void)[] = [];

/**
 * Load MathLive's stylesheet + fonts and disable its own font loader (its default
 * path 404s under bundling and hides the editor; the imported CSS provides the
 * faces instead). Idempotent.
 */
export function ensureMathliveAssets(): Promise<void> {
  assetsPromise ??= (async () => {
    await Promise.all([import("mathlive/fonts.css"), import("mathlive/static.css")]);
    const m = await import("mathlive");
    (
      m as unknown as { MathfieldElement: { fontsDirectory: string | null } }
    ).MathfieldElement.fontsDirectory = null;
  })();
  return assetsPromise;
}

/** Load + register MathLive's `<math-field>` editor (heavy) with fonts ready. */
export function loadEditor(): Promise<void> {
  return ensureMathliveAssets();
}

/** Load MathLive's DOM-free static markup renderer (light), CSS ready. */
export function loadMarkup(): Promise<(latex: string) => string> {
  markupPromise ??= ensureMathliveAssets()
    .then(() => import("mathlive/ssr"))
    .then((m) => m.convertLatexToMarkup);
  return markupPromise;
}

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
