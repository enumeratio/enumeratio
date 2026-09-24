// The shared compute-engine instance: created lazily on first use (its own chunk in a
// browser, deduped by the module registry so every element shares one), configured by
// whoever registered a library first. Base-level so the framework glue (`vue.ts`,
// `react.ts`) and the elements parse through the same engine.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import type { LatexDictionaryEntry } from "@cortex-js/compute-engine/latex-syntax";
import { NOTATIO_LATEX } from "./latex.ts";

let engine: ComputeEngine | undefined;
let enginePromise: Promise<ComputeEngine> | undefined;

const configurators: ((ce: ComputeEngine) => void)[] = [];
const latexEntries: Partial<LatexDictionaryEntry>[] = [...NOTATIO_LATEX];

/**
 * Contribute LaTeX dictionary entries -- a library's notation, parsed and serialised --
 * to the shared engine. compute-engine only takes a dictionary at construction
 * (design/upstreaming.md §3.7), so these must land before the engine exists: register
 * them where the libraries are declared, behind `__notatioEngineReady`. Appended to the
 * default dictionary, so an entry with an existing trigger takes precedence, and one with
 * an existing name replaces it.
 */
export function configureLatex(entries: readonly Partial<LatexDictionaryEntry>[]): void {
  if (engine) throw new Error("configureLatex: the engine exists; its dictionary is fixed");
  latexEntries.push(...entries);
}

/** `base` then `extra`, a named entry in `extra` replacing the one `base` has by that name. */
export function mergeLatex<T extends { readonly name?: string }>(
  base: readonly T[],
  extra: readonly T[],
): T[] {
  const renamed = new Set(extra.map((e) => e.name).filter((n) => n !== undefined));
  return [...base.filter((e) => e.name === undefined || !renamed.has(e.name)), ...extra];
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
    const { ComputeEngine, LatexSyntax, LATEX_DICTIONARY } =
      await import("@cortex-js/compute-engine");
    engine = new ComputeEngine({
      latexSyntax: new LatexSyntax({ dictionary: mergeLatex(LATEX_DICTIONARY, latexEntries) }),
    });
    for (const fn of configurators) fn(engine);
    return engine;
  })();
  return enginePromise;
}
