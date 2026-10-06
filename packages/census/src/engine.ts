// Every library we ship, declared into one engine.
//
// This package exists for this function. Questions about the namespace as a whole — what do
// we add, what does it collide with, what can Wolfram do that we cannot — are only
// answerable against a COMPLETE engine, and a library missing from the engine is a library
// those questions pass over in silence. The catalog half (collections, domains, statistics)
// was missing from the reference package's engine for a long time, and the checks there
// were quietly not covering `Subsets`, `Area`, `Order`, `Composition` or `Word` at all.
//
// It is its own package rather than a file in `reference` because reference is a
// DEPENDENCY of collections (which types its entries against it), so reference cannot
// depend back on collections without a cycle the task graph rejects. Nothing depends on
// this package, which is what lets it depend on everything. That is also what completes the
// engine: it declares every library it depends on, in the order the manifest's hierarchy
// gives (`enginePlan`), so a new library is in once it is a dependency.

import { readFileSync } from "node:fs";
import { ComputeEngine, LATEX_DICTIONARY } from "@cortex-js/compute-engine";
import { combineNotation, type PackageNotation, registerNotation } from "@enumeratio/boxes";
import { declareAnalytic } from "@enumeratio/analytic";
import { ENUMERATIO, declareCatalog } from "@enumeratio/catalog";
import { displayLatexSyntax } from "@enumeratio/frontend/display";
import {
  buildEngine,
  dependedLibraries,
  enginePlan,
  type Importer,
  loadLibraries,
  NOTATIONS,
  type StagedLibrary,
} from "@enumeratio/manifest";
import { declareCompose, declareRestricted, declareRestrictions, RESTRICTIONS } from "@enumeratio/structures";

type Declare = (ce: ComputeEngine) => void;

const importer: Importer = (specifier, options) =>
  options?.json
    ? import(/* @vite-ignore */ specifier, { with: { type: "json" } }).then((m: { default: unknown }) => m.default)
    : import(/* @vite-ignore */ specifier);

const own = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as Parameters<
  typeof dependedLibraries
>[0];

/**
 * Every library this package depends on, whatever its layer, each with its `declare`. Analytic
 * declares without its fractals here, as it always has: `Julia` and `Mandelbrot` have no typed
 * records yet, and `tests/manifest.test.ts` holds every head the census declares to one.
 */
const AVAILABLE = (
  await loadLibraries<ComputeEngine>(dependedLibraries(own, ["base", "extension", "presentation", "tooling"]), importer)
).map((library) =>
  library.name === "analytic" ? { ...library, declare: declareAnalytic, main: declareAnalytic } : library,
);

/** A step the census adds that is no package's own: what it adds is `package`'s contribution. */
type Extra = StagedLibrary<ComputeEngine> & { readonly package?: string };

/** A step after every library's own, and after what it `requires`. */
const late = (name: string, declare: (ce: ComputeEngine) => void, requires: string[], pkg?: string): Extra => ({
  name,
  declare,
  late: declare,
  requires,
  ...(pkg === undefined ? {} : { package: pkg }),
});

/**
 * What the census declares beyond what the libraries declare themselves. The restricted heads and
 * `Compose` are structures' over combinatorics' maps, so they follow combinatorics and count as
 * its contribution; the catalog blesses what everything before it declared.
 */
const EXTRAS: readonly Extra[] = [
  late(
    "restrictions",
    (ce) => {
      declareRestricted(ce);
      declareRestrictions(ce, RESTRICTIONS);
    },
    ["combinatorics"],
    "combinatorics",
  ),
  late("compose", declareCompose, ["restrictions"], "combinatorics"),
  late("catalog", (ce) => declareCatalog(ce, { bless: [ENUMERATIO] }), ["restrictions", "compose"]),
];

const NAMES = AVAILABLE.map((library) => library.name);

/** The declarations, in order, with why each library is there. */
export const PLAN = enginePlan({ libraries: NAMES, available: AVAILABLE, include: EXTRAS });

/**
 * Every declaration with the package that owns it, in order. The package is the directory
 * name, as the manifest names packages: what a step adds or re-signs is that package's
 * contribution (https://github.com/enumeratio/enumeratio/wiki/Manifest).
 */
export const PACKAGE_DECLARATIONS: readonly (readonly [pkg: string, declare: Declare])[] = PLAN.steps.map(
  ({ library, declare }) => [(library as Extra).package ?? library.name, declare as Declare] as const,
);

/** Every declaration, in order. */
export const DECLARATIONS: readonly Declare[] = PACKAGE_DECLARATIONS.map(([, declare]) => declare);

/** Every package's notation entry, by manifest name, as the manifest lists them. */
export const NOTATION_ENTRIES: Readonly<Record<string, PackageNotation>> = Object.fromEntries(
  await Promise.all(
    Object.entries(NOTATIONS).map(
      async ([name, specifier]) =>
        [name, ((await import(specifier)) as { notation: PackageNotation }).notation] as const,
    ),
  ),
);

/** Every package's notation as one. */
export const NOTATION = combineNotation(Object.values(NOTATION_ENTRIES));

/** An engine with everything we ship declared on it, and every package's notation. */
export const fullEngine = (): ComputeEngine =>
  buildEngine({
    libraries: NAMES,
    available: AVAILABLE,
    include: EXTRAS,
    engine: () => {
      const ce = new ComputeEngine({
        latexSyntax: displayLatexSyntax(LATEX_DICTIONARY, NOTATION.latex),
      });
      registerNotation(ce, NOTATION.traditional);
      return ce;
    },
  }).engine;

/**
 * Every name bound in an engine's scope chain.
 *
 * compute-engine exposes no public enumeration of its symbol table, so this reaches for the
 * lexical scope it walks internally. That is the one unsupported thing here, and it is
 * worth it: the alternative is trusting a hand-maintained list of what we declare, which is
 * exactly the thing that goes stale.
 */
export function bindings(ce: ComputeEngine): Set<string> {
  const internal = ce as unknown as {
    context: { lexicalScope: Scope };
  };
  const names = new Set<string>();
  let scope: Scope | undefined = internal.context.lexicalScope;
  while (scope !== undefined) {
    for (const name of scope.bindings.keys()) names.add(name);
    scope = scope.parent;
  }
  return names;
}

interface Scope {
  readonly bindings: Map<string, unknown>;
  readonly parent?: Scope;
}

/** What declaring our libraries ADDS to a bare engine — the census proper. */
export function declaredNames(): string[] {
  const bare = bindings(new ComputeEngine());
  return [...bindings(fullEngine())].filter((name) => !bare.has(name)).toSorted();
}

/** What declaring our libraries ADDS as values (not operators): each name with its type and
 *  whether it is a constant. These are the nullary symbols, as opposed to heads. */
export function declaredValues(): { name: string; type: string; isConstant: boolean }[] {
  const ce = fullEngine();
  const bare = bindings(new ComputeEngine());
  const found = new Map<string, { name: string; type: string; isConstant: boolean }>();
  let scope: Scope | undefined = (ce as unknown as { context: { lexicalScope: Scope } }).context.lexicalScope;
  while (scope !== undefined) {
    for (const [name, def] of scope.bindings) {
      const { operator, value } = def as {
        operator?: unknown;
        value?: { type?: { toString(): string }; isConstant?: boolean };
      };
      if (bare.has(name) || found.has(name) || operator !== undefined || value === undefined) continue;
      found.set(name, { name, type: String(value.type), isConstant: value.isConstant === true });
    }
    scope = scope.parent;
  }
  return [...found.values()].toSorted((a, b) => (a.name < b.name ? -1 : 1));
}
