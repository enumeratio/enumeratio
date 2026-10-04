// An engine built from the library hierarchy: the libraries asked for, the base under every one
// of them, and what each requires, declared in the order the hierarchy gives. A host lists the
// libraries it wants; the order and the reason each is there come out of `HIERARCHY` and the
// libraries' own `package.json` (`enumeratio.declare`), not from a list the host keeps.
//
// Loads no code and imports no engine: the host says how to import a package and how to make an
// engine, so this sits in the manifest beside `plan`, which it builds on.

import { HIERARCHY, type Layer, PACKAGES } from "./hierarchy.ts";
import type { LibraryDeclares } from "./declares.ts";
import type { PackageField } from "./package-field.ts";
import { type Library, plan } from "./resolve.ts";

/** A library that declares in two steps: `main` with everyone's, `late` once every `main` has
 *  run. `declare` (what the resolver calls) is both, in that order. A library with a `late`
 *  and no `main` has nothing before it. */
export interface StagedLibrary<E extends object = never> extends Library<E> {
  readonly main?: (ce: E) => unknown;
  readonly late?: (ce: E) => unknown;
}

/** One declaration in an engine: a library's `main` or its `late`. */
export interface Step<L extends Library<never> = Library<never>> {
  readonly library: L;
  readonly phase: "main" | "late";
  readonly declare: (ce: never) => unknown;
}

/** Why a library is in an engine. */
export type Reason =
  | { readonly kind: "asked" }
  | { readonly kind: "base" }
  /** What it is there for: the planned libraries that require it directly. */
  | { readonly kind: "required"; readonly by: readonly string[] };

export interface EnginePlan<L extends Library<never> = Library<never>> {
  /** The libraries to declare, in order. */
  readonly order: readonly L[];
  /** Each declaration: every library's `main` in `order`, then every `late` in `order`. */
  readonly steps: readonly Step<L>[];
  /** Why each is in `order`, by name. */
  readonly reasons: Readonly<Record<string, Reason>>;
  /** Asked for, or required, with no library to declare. */
  readonly missing: readonly string[];
}

export interface EnginePlanOptions<L extends Library<never>> {
  /** The libraries to declare, by name; what they require comes with them. */
  readonly libraries: Iterable<string>;
  /** Every library the host can declare. `libraries` picks among them. */
  readonly available: readonly L[];
  /** Declared whatever `libraries` says (a library the host supplies itself, with no package). */
  readonly include?: readonly L[];
  /** Whether the base layer (`evaluation`, `boxes`, `structures`) comes too. Default true. */
  readonly base?: boolean;
  /** Order that isn't a requirement: `[first, later]` declares `first` before `later` when
   *  both are there, even where `first` extends `later` (the extension says what it may import,
   *  not that nothing may widen the base before it). A cycle fails. `DECLARE_ORDER` is the host's
   *  default and is empty. */
  readonly after?: readonly (readonly [first: string, later: string])[];
  /** What a library requires: what it extends in `HIERARCHY`, by default. */
  readonly requires?: (name: string) => readonly string[];
}

/**
 * Order that has to hold though no library requires it: `[first, later]` pairs that win over
 * `extends` where they disagree. Empty: heads two libraries both extend answer the same in any
 * order (each contribution is a row, a union widening or a layered handler), so nothing needs it.
 * What must come after every library, not just one, is a `late` step.
 */
export const DECLARE_ORDER: readonly (readonly [first: string, later: string])[] = [];

/**
 * Where libraries go when nothing above decides: the order the census declared them in when the
 * records' `overrides` were written, which each row's `overrides` still agree with. A library
 * not listed comes after these, in the order given.
 */
export const DECLARE_PREFERENCE: readonly string[] = [
  "evaluation",
  "boxes",
  "structures",
  "analytic",
  "hypercomplex",
  "geometric",
  "diagram",
  "residues",
  "numerals",
  "hecke",
  "incidence",
  "quiver",
  "hopf",
  "groupalgebra",
  "modular",
  "adeles",
  "braid",
  "number-theory",
  "combinatorics",
  "statistics",
  "polytope",
  "formats",
  "frontend",
];

/** `libraries` in preference order, the ones the list doesn't name keeping the order given, last. */
const preferred = <T extends { readonly name: string }>(libraries: readonly T[]): T[] => {
  const rank = (name: string): number => {
    const at = DECLARE_PREFERENCE.indexOf(name);
    return at < 0 ? DECLARE_PREFERENCE.length : at;
  };
  return libraries.toSorted((a, b) => rank(a.name) - rank(b.name));
};

/** Base-layer libraries among `names`, in `HIERARCHY` order. */
const baseOf = (names: Iterable<string>): string[] => {
  const present = new Set(names);
  return Object.keys(HIERARCHY).filter((name) => HIERARCHY[name]!.layer === "base" && present.has(name));
};

/** A library's own steps: `main` unless it has a `late` and no `main`, then its `late`. */
function stepsOf(library: Library<never>): { main?: (ce: never) => unknown; late?: (ce: never) => unknown } {
  const staged = library as StagedLibrary<never>;
  const { late } = staged;
  const main = late === undefined ? library.declare : staged.main;
  return { ...(main === undefined ? {} : { main }), ...(late === undefined ? {} : { late }) };
}

/**
 * The libraries an engine declares and the order, with the reason for each: `libraries`, the
 * base, `include`, and what they require, transitively. Every library comes after what it
 * requires (unless an `after` pair says otherwise) and every `after` pair holds. Among the
 * libraries free to go next, `DECLARE_PREFERENCE` says which goes first. The `late` steps follow
 * all the `main` ones, in the same order.
 */
export function enginePlan<L extends Library<never>>(options: EnginePlanOptions<L>): EnginePlan<L> {
  const {
    include = [],
    base = true,
    after = DECLARE_ORDER,
    requires = (name) => PACKAGES[name]?.requires ?? [],
  } = options;
  const asked = new Set([...options.libraries, ...include.map((l) => l.name)]);
  const known = [...options.available, ...include.filter((l) => !options.available.some((a) => a.name === l.name))];
  const bases = base ? baseOf(known.map((l) => l.name)) : [];
  const ranked = preferred(known);
  const { libraries: selected, missing } = plan([...asked, ...bases], ranked, requires);

  const chosen = new Set(selected.map((l) => l.name));
  const before = new Map<string, Set<string>>(selected.map((l) => [l.name, new Set()]));
  const needs = (library: L): string[] =>
    [...requires(library.name), ...(library.requires ?? [])].filter((dep) => chosen.has(dep));
  for (const library of selected) for (const dep of needs(library)) before.get(library.name)!.add(dep);
  // A pair is applied over the requirements, so one pair can't undo another.
  const pairs = after.filter(([first, later]) => chosen.has(first) && chosen.has(later));
  for (const [first, later] of pairs) before.get(first)!.delete(later);
  for (const [first, later] of pairs) before.get(later)!.add(first);

  // Kahn's, taking the preferred library of those ready: a cycle leaves nothing ready.
  const order: L[] = [];
  const left = ranked.filter((l) => chosen.has(l.name));
  while (left.length > 0) {
    const at = left.findIndex((l) => [...before.get(l.name)!].every((dep) => order.some((o) => o.name === dep)));
    if (at < 0) throw new Error(`declare order has a cycle among ${left.map((l) => l.name).join(", ")}`);
    order.push(left.splice(at, 1)[0]!);
  }

  const steps: Step<L>[] = [];
  for (const phase of ["main", "late"] as const) {
    for (const library of order) {
      const declare = stepsOf(library)[phase];
      if (declare !== undefined) steps.push({ library, phase, declare });
    }
  }
  const reasons: Record<string, Reason> = {};
  for (const library of order) {
    reasons[library.name] = asked.has(library.name)
      ? { kind: "asked" }
      : bases.includes(library.name)
        ? { kind: "base" }
        : { kind: "required", by: order.filter((other) => needs(other).includes(library.name)).map((o) => o.name) };
  }
  return { order, steps, reasons, missing };
}

export interface BuildEngineOptions<E extends object, L extends Library<E>> extends EnginePlanOptions<L> {
  /** A fresh engine: the host's own construction (its LaTeX dictionary, its notation). */
  readonly engine: () => E;
}

/** An engine, with the libraries declared into it and the plan it was built from. */
export interface BuiltEngine<E extends object, L extends Library<E> = Library<E>> {
  readonly engine: E;
  readonly plan: EnginePlan<L>;
}

/**
 * An engine with exactly the planned libraries declared into it, in order: `libraries`, the
 * base, `include`, and what each requires. A library nobody can declare (`missing`) is an
 * error: an engine that quietly lacks one answers every question about it wrongly.
 */
export function buildEngine<E extends object, L extends Library<E>>(
  options: BuildEngineOptions<E, L>,
): BuiltEngine<E, L> {
  const result = enginePlan(options);
  if (result.missing.length > 0) throw new Error(`no library to declare: ${result.missing.join(", ")}`);
  const engine = options.engine();
  declarePlan(engine, result);
  return { engine, plan: result };
}

/** Declares a plan's steps into `engine`, in order, except those of the libraries named in `skip`
 *  (what it already has: a worker's engine comes with `evaluation`). */
export function declarePlan<E extends object>(
  engine: E,
  { steps }: EnginePlan<Library<E>>,
  skip: Iterable<string> = [],
): void {
  const skipped = new Set(skip);
  for (const { library, declare } of steps) {
    if (skipped.has(library.name)) continue;
    const declared = (declare as (ce: E) => unknown)(engine);
    // A host's `declare` that has to import first is the resolver's, not an engine built here.
    if (declared instanceof Promise) throw new Error(`${library.name}: declare is asynchronous`);
  }
}

/** The libraries a host's `package.json` depends on, by name, from the layers given: what it
 *  declares is what it installs. Not all of them declare anything (`loadLibraries` skips those). */
export function dependedLibraries(
  pkg: { readonly dependencies?: Record<string, string>; readonly devDependencies?: Record<string, string> },
  layers: readonly Layer[] = ["base", "extension"],
  scope = "@enumeratio/",
): string[] {
  return Object.keys({ ...pkg.devDependencies, ...pkg.dependencies })
    .filter((dep) => dep.startsWith(scope))
    .map((dep) => dep.slice(scope.length))
    .filter((name) => layers.includes(HIERARCHY[name]?.layer as Layer));
}

/** What a host imports a package by: `import(specifier)`, or `import(specifier, { with: { type: "json" } })`. */
export type Importer = (specifier: string, options?: { readonly json: true }) => Promise<unknown>;

/** One export of a package, by the field's spelling (`declareAnalytic`, `./declare-carriers#declareFrontendCarriers`). */
async function exported(pkg: string, spec: string, load: Importer): Promise<(ce: never) => unknown> {
  const hash = spec.indexOf("#");
  const subpath = hash < 0 ? "" : spec.slice(0, hash).replace(/^\./, "");
  const name = hash < 0 ? spec : spec.slice(hash + 1);
  const module = (await load(`${pkg}${subpath}`)) as Record<string, unknown>;
  const declare = module[name];
  if (typeof declare !== "function") throw new Error(`${pkg}${subpath} exports no ${name}`);
  return declare as (ce: never) => unknown;
}

/** The exports a field names, as one function that calls them in order. */
async function declaring(pkg: string, field: string | readonly string[], load: Importer): Promise<(ce: never) => void> {
  const declares = await Promise.all([field].flat().map((spec) => exported(pkg, spec, load)));
  return (ce) => {
    for (const declare of declares) declare(ce);
  };
}

/**
 * The libraries named, from their packages: each one's `enumeratio.declare` (and `late`) read
 * from its own `package.json` and imported as that field says, in `DECLARE_PREFERENCE` order. A
 * name with neither is not a library and is skipped. Each one's `declares` too, unless told not
 * to (the build that writes them). The scope is ours; a host with another passes it.
 */
export async function loadLibraries<E extends object>(
  names: Iterable<string>,
  load: Importer,
  scope = "@enumeratio/",
  { declares: withDeclares = true }: { readonly declares?: boolean } = {},
): Promise<StagedLibrary<E>[]> {
  const libraries: StagedLibrary<E>[] = [];
  for (const { name } of preferred([...new Set(names)].map((name) => ({ name })))) {
    const pkg = `${scope}${name}`;
    const json = (await load(`${pkg}/package.json`, { json: true })) as { enumeratio?: PackageField };
    const field = json.enumeratio;
    if (field?.declare === undefined && field?.late === undefined) continue;
    const main =
      field.declare === undefined ? undefined : ((await declaring(pkg, field.declare, load)) as (ce: E) => void);
    const late = field.late === undefined ? undefined : ((await declaring(pkg, field.late, load)) as (ce: E) => void);
    const declares =
      withDeclares && field.declares !== undefined
        ? ((await load(`${pkg}/${field.declares.replace(/^\.\//, "")}`, { json: true })) as LibraryDeclares)
        : undefined;
    libraries.push({
      name,
      declare: (ce) => {
        main?.(ce);
        late?.(ce);
      },
      ...(main === undefined ? {} : { main }),
      ...(late === undefined ? {} : { late }),
      ...(field.names === undefined ? {} : { names: field.names }),
      ...(field.requires === undefined ? {} : { requires: field.requires }),
      ...(declares === undefined ? {} : { declares }),
    });
  }
  return libraries;
}
