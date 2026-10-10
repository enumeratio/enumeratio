// The engines the collectors and tests both need — and nothing else.
//
// This file exists because `collect-provenance.ts` writes a file at import time, and the
// provenance test used to import it just to reach `declaredEngine`. Every test run then
// rewrote the generated data and dirtied the tree. Side effects belong in the script that
// is meant to have them; shared setup belongs here.

import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import type { PackageNotation } from "@enumeratio/boxes";
import {
  buildEngine,
  declarePlan,
  dependedLibraries,
  enginePlan,
  type Importer,
  type Library,
  loadLibraries,
  NOTATIONS,
  type StagedLibrary,
} from "@enumeratio/manifest";
import { declareCatalog, ENUMERATIO } from "@enumeratio/catalog";
import { declareGraphics } from "@enumeratio/formats";
import { declareCompose, declareRestricted } from "@enumeratio/structures";
import { OWN_ENGINE } from "../src/node.ts";

// The libraries are the ones this package depends on (it can import each, so each specifier
// resolves from here); what each declares, and in what order, is the manifest's to say. Not an
// OWN_ENGINE package (src/node.ts): its heads override compute-engine's own, and the scan evaluates
// them in their own engine (own-engines.ts) instead.
const importer: Importer = (specifier, options) =>
  options?.json
    ? import(/* @vite-ignore */ specifier, { with: { type: "json" } }).then((m: { default: unknown }) => m.default)
    : import(/* @vite-ignore */ specifier);

const own = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as Parameters<
  typeof dependedLibraries
>[0];
/** Every library this package depends on, with `@enumeratio/evaluation`: what the engines are built from. */
export const AVAILABLE = await loadLibraries<ComputeEngine>(
  dependedLibraries(own).filter((name) => !OWN_ENGINE.has(name)),
  importer,
);
const NAMES = AVAILABLE.map((library) => library.name);

// Note: GlyphKind (frontend's own carrier) is deliberately NOT declared in this engine --
// wiring it in would make @enumeratio/reference depend on @enumeratio/frontend, which already
// devDeps reference for its own tests, a real build cycle. GlyphKind's reference entry states its
// `library` directly (read, not derived from this engine -- see `declaredLibrary` in
// provenance.ts), so this only affects its `provenance` classification, and it is a stub with
// no examples either way.

// `Restricted` and `Compose` are structures' over combinatorics' maps, so they follow combinatorics
// (as in census's engine), and their examples run here. `formats` is a presentation library, so
// not in the plan by default; its graphics heads (`Plot`, `Slider`, … held inert, and the
// `Histogram` widening of compute-engine's head) join alone, last, as in every host. Lowering a
// drawn value to boxes needs `@enumeratio/frontend`, which sits above this package: its
// `tests/example-boxes.test.ts` does that for the examples that carry a `boxes` shape.
const late = (
  name: string,
  declare: (ce: ComputeEngine) => void,
  requires: string[],
): StagedLibrary<ComputeEngine> => ({
  name,
  declare,
  late: declare,
  requires,
});
/** The host-supplied libraries: declared into an engine whatever resolves, once what they need is there. */
export const EXTRAS = [
  late("restricted", declareRestricted, ["combinatorics"]),
  late("compose", declareCompose, ["restricted"]),
  late("graphics", declareGraphics, []),
  // The catalog resolves what the engine declared before it (`Resource("Subsets", 3)` is `Subsets(3)`).
  late("catalog", (ce) => void declareCatalog(ce, { bless: [ENUMERATIO] }), ["compose"]),
];

/** The engine's plan: every library this package depends on, the base, and what each requires. */
export const PLAN = enginePlan({ libraries: NAMES, available: AVAILABLE, include: EXTRAS });

/**
 * The same libraries by package, for the resolver (`@enumeratio/manifest`'s `createResolver`).
 * Without `@enumeratio/evaluation`: every host runs it first, so the resolver never declares it.
 */
export const LIBRARIES: readonly Library<ComputeEngine>[] = AVAILABLE.filter(
  (library) => library.name !== "evaluation",
);

/** Every package's notation entry, as the manifest lists them. Imported from here because this
 *  package depends on every library, so each specifier resolves. */
export const packageNotations = (): Promise<PackageNotation[]> =>
  Promise.all(
    Object.values(NOTATIONS).map(
      async (specifier) => ((await import(specifier)) as { notation: PackageNotation }).notation,
    ),
  );

/**
 * The engine with every library declared. Without `graphics`, it is the one whose definitions
 * decide what the oracle takes for a free symbol (`collect-defined-names.ts`): the oracle sends
 * the heads formats holds inert as written, Wolfram's own (`Plot`) by name and the rest
 * (`Chart`, `Knob`, `CollectionTable`) as free functions. Counting them defined would leave the
 * latter unmapped, and a scan would drop the answers recorded for them.
 */
export const declaredEngine = ({ graphics = true }: { readonly graphics?: boolean } = {}): ComputeEngine =>
  buildEngine({
    libraries: NAMES,
    available: AVAILABLE,
    include: graphics ? EXTRAS : EXTRAS.filter((extra) => extra.name !== "graphics"),
    engine: () => new ComputeEngine(),
  }).engine;

/**
 * `configure(ce)` for `@enumeratio/evaluation/node`'s isolated evaluator (`evaluateIsolated`,
 * `openSession`, `runCases`'s `setup` option): declares every library the reference engine
 * declares, so a case evaluated in a worker means the same thing it would in-process. Not
 * `declaredEngine`'s plan verbatim -- the worker's own engine already declares
 * `@enumeratio/evaluation` before running `setup` (see `worker.ts`/`session-worker.ts`), and
 * redeclaring throws: "already declared in this scope".
 */
export function configure(ce: ComputeEngine): void {
  declarePlan(ce, PLAN, ["evaluation"]);
}
