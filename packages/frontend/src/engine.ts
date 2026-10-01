// The shared compute-engine instance: created lazily on first use (its own chunk in a
// browser, deduped by the module registry so every element shares one), configured by
// whoever registered a library first, or the libraries resolved per expression through a
// host resolver (`loadEngineFor`). Base-level, so every element parses through one engine.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import type { LatexDictionaryEntry } from "@cortex-js/compute-engine/latex-syntax";

let engine: ComputeEngine | undefined;
let enginePromise: Promise<ComputeEngine> | undefined;

const configurators: ((ce: ComputeEngine) => void)[] = [];
// The hosts' entries: the packages' notation, after ours when the engine is built.
const latexEntries: Partial<LatexDictionaryEntry>[] = [];

/**
 * Contribute LaTeX dictionary entries -- a library's notation, parsed and serialised --
 * to the shared engine. compute-engine only takes a dictionary at construction
 * (https://github.com/enumeratio/enumeratio/wiki/Upstreaming §3.7), so these must land before the engine exists: register
 * them where the libraries are declared, behind `__notatioEngineReady`. Appended to the
 * default dictionary, so an entry with an existing trigger takes precedence, and one with
 * an existing name replaces it.
 */
export function configureLatex(entries: readonly Partial<LatexDictionaryEntry>[]): void {
  if (engine) throw new Error("configureLatex: the engine exists; its dictionary is fixed");
  latexEntries.push(...entries);
}

/** `base` then `extra`, a named entry replacing any earlier one by that name -- in `base`
 *  or earlier in `extra` (two libraries may both redefine `Power`). */
export function mergeLatex<T extends { readonly name?: string }>(base: readonly T[], extra: readonly T[]): T[] {
  const last = new Map<string, number>();
  extra.forEach((e, i) => e.name !== undefined && last.set(e.name, i));
  const kept = extra.filter((e, i) => e.name === undefined || last.get(e.name) === i);
  return [...base.filter((e) => e.name === undefined || !last.has(e.name)), ...kept];
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
 * it has declared all its extension libraries (via `configureEngine`), or to a function
 * returning one, called when the engine is first wanted. The shared
 * engine then waits for it before it is created, so the first evaluation already
 * sees every registered head — without this, a host that declares libraries from an
 * async import can lose the race and render before they land. Absent (tests, CLI,
 * plain hosts), engine creation proceeds immediately.
 */
type EngineGate = {
  __notatioEngineReady?: Promise<unknown> | (() => Promise<unknown>);
  /** What every engine needs before it's built, whatever it declares: the notation. */
  __notatioEngineSetup?: () => Promise<unknown>;
  /** The host's resolver, set before any element mounts (as the gates are). */
  __notatioEngineResolver?: EngineResolver;
};

/**
 * What declares libraries into the engine, once each: those an expression names
 * (`@enumeratio/manifest`'s `createResolver`), or all of them.
 */
export interface EngineResolver {
  ensure(ce: ComputeEngine, json: unknown): Promise<unknown>;
  ensureAll(ce: ComputeEngine): Promise<unknown>;
}

let configured: EngineResolver | undefined;
let bare: Promise<ComputeEngine> | undefined;
const resolverOf = (): EngineResolver | undefined => configured ?? (globalThis as EngineGate).__notatioEngineResolver;

/**
 * Register the host's resolver: `loadEngineFor` then declares only the libraries each
 * expression names, instead of the host declaring every library before the first use.
 */
export function configureResolver(r: EngineResolver): void {
  configured = r;
}

/** The shared engine with the notation and configurators in, but not the host's gate. */
function createEngine(): Promise<ComputeEngine> {
  return (bare ??= (async () => {
    await (globalThis as EngineGate).__notatioEngineSetup?.().catch(() => {});
    const [{ ComputeEngine, LatexSyntax, LATEX_DICTIONARY }, { displayDictionary }] = await Promise.all([
      import("@cortex-js/compute-engine"),
      import("./display.ts"),
    ]);
    // The kernel's dictionary, so the page writes and reads LaTeX as a kernel does.
    engine = new ComputeEngine({
      latexSyntax: new LatexSyntax({ dictionary: displayDictionary(LATEX_DICTIONARY, latexEntries) }),
    });
    for (const fn of configurators) fn(engine);
    return engine;
  })());
}

/**
 * The shared engine, with the libraries `json` names declared: through the host's resolver
 * where there is one, else everything, as `loadEngine`.
 */
export async function loadEngineFor(json: unknown): Promise<ComputeEngine> {
  const resolver = resolverOf();
  if (resolver === undefined) return loadEngine();
  const ce = await createEngine();
  await resolver.ensure(ce, json);
  return ce;
}

/**
 * Declare what `json` names into `ce` (the shared engine), through the host's resolver;
 * whether anything new was declared. Without a resolver, `ce` already has everything.
 */
export async function ensureFor(ce: ComputeEngine, json: unknown): Promise<boolean> {
  const ensured = (await resolverOf()?.ensure(ce, json)) as { declared?: readonly unknown[] } | undefined;
  return (ensured?.declared?.length ?? 0) > 0;
}

/**
 * Parse with the shared engine, declare what the result names, and parse again where that
 * declared something (a head's own parse can depend on it being known). `parse` gets the
 * engine; what it returns carries the `json`.
 */
export async function parseFor<T extends { readonly json?: unknown }>(
  parse: (ce: ComputeEngine) => T,
): Promise<{ engine: ComputeEngine; parsed: T }> {
  if (resolverOf() === undefined) {
    const engine = await loadEngine();
    return { engine, parsed: parse(engine) };
  }
  const engine = await createEngine();
  const parsed = parse(engine);
  return { engine, parsed: (await ensureFor(engine, parsed.json)) ? parse(engine) : parsed };
}

/** The shared engine before anything is resolved into it, for a caller that resolves itself. */
export function loadBareEngine(): Promise<ComputeEngine> {
  return resolverOf() === undefined ? loadEngine() : createEngine();
}

/** The shared compute-engine instance, created and configured on first use. */
export function loadEngine(): Promise<ComputeEngine> {
  enginePromise ??= (async () => {
    // With a resolver, everything goes through it, so a library is declared once either way.
    const resolver = resolverOf();
    if (resolver !== undefined) {
      const ce = await createEngine();
      await resolver.ensureAll(ce);
      return ce;
    }
    // A function gate is called only now: a page that never needs this engine never loads
    // the libraries it would declare.
    const ready = (globalThis as EngineGate).__notatioEngineReady;
    const gate = typeof ready === "function" ? ready() : ready;
    if (gate) await gate.catch(() => {});
    return createEngine();
  })();
  return enginePromise;
}
