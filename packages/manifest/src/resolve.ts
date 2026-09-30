// An expression's code, resolved from the expression (https://github.com/enumeratio/enumeratio/wiki/Speculative-Lazy-Engine):
// the heads and symbols it names, the packages the manifest says declare them, and those
// packages' own dependencies, declared into an engine in the host's order. Loads nothing
// itself: a host lists its libraries and how to declare each.

import { CANONICAL, DECLARERS } from "./declarers-data.ts";
import { PACKAGES } from "./generated/packages.ts";
import { SYMBOLS } from "./generated/symbols.ts";
import type { SymbolInfo } from "./types.ts";

const ENGINE = "compute-engine";

/** One package a host can declare into an engine (any engine: the manifest loads no code). */
export interface Library<Engine extends object = never> {
  /** The package, as the manifest names it (`analytic`, `number-theory`). */
  readonly name: string;
  /** Declares the package into `ce`; async when it has to be imported first. */
  readonly declare: (ce: Engine) => unknown;
  /** Declared whenever anything is: a package whose effects reach heads it doesn't own. */
  readonly global?: boolean;
  /** Libraries it needs declared first beyond its package's own dependencies: what the host
   *  passes it (statistics takes combinatorics' carrier types). */
  readonly requires?: readonly string[];
  /** Names it adds to without redeclaring them, which declaring can't see: a registry a head
   *  reads (statistics' entries in `CombinatorialStat`'s table). */
  readonly names?: readonly string[];
}

/** Where a name's declaring packages are looked up: the manifest, unless told otherwise. */
export type Lookup = (name: string) => SymbolInfo | undefined;

const manifest: Lookup = (name) => (Object.hasOwn(SYMBOLS, name) ? SYMBOLS[name] : undefined);

/** Every head and symbol a MathJSON expression names. Strings in quotes are text, not names. */
export function namesOf(json: unknown, into: Set<string> = new Set()): Set<string> {
  if (typeof json === "string") {
    if (!/^'.*'$/s.test(json) && /^[A-Za-z_]/.test(json)) into.add(json);
  } else if (Array.isArray(json)) {
    for (const item of json) namesOf(item, into);
  } else if (json !== null && typeof json === "object") {
    const { fn, sym, dict } = json as { fn?: unknown; sym?: unknown; dict?: unknown };
    if (typeof sym === "string") into.add(sym);
    if (fn !== undefined) namesOf(fn, into);
    if (dict !== null && typeof dict === "object") for (const value of Object.values(dict)) namesOf(value, into);
  }
  return into;
}

/** What `json` names, and the heads those canonicalise to, transitively (`Lb` brings `Log`). */
export function reachedNames(json: unknown, canonical = CANONICAL): Set<string> {
  const names = namesOf(json);
  for (const name of names) for (const next of canonical[name] ?? []) names.add(next);
  return names;
}

/**
 * The packages that declare what `json` names: what declaring them found (`DECLARERS`), or the
 * records' overloads for a name that isn't there. A package whose only say in a head is rows on
 * carriers it declares (`on`: adeles' `Add` on `Adele`) doesn't count for it: its rows matter
 * only where one of those exists, and whatever makes one brings the package. Any other widening
 * counts: general ones (structures' `Floor(x, m)`, number-theory's `Fibonacci(1.5)`), and rows
 * on a carrier someone else declares (analytic's on compute-engine's `Interval`).
 */
export function packagesFor(json: unknown, lookup: Lookup = manifest, declarers = DECLARERS): Set<string> {
  const packages = new Set<string>();
  for (const name of reachedNames(json)) {
    const overloads = lookup(name)?.overloads ?? [];
    const declared = Object.hasOwn(declarers, name)
      ? declarers[name]!
      : overloads.map((overload) => overload.package).filter((pkg) => pkg !== ENGINE);
    for (const pkg of declared) {
      const own = overloads.filter((overload) => overload.package === pkg);
      const carries = (carrier: string): boolean => declarers[carrier]?.includes(pkg) === true;
      if (own.length > 0 && own.every((overload) => overload.on?.every(carries) === true)) continue;
      packages.add(pkg);
    }
  }
  return packages;
}

/** What `json` needs from `libraries`: `packagesFor`, and the libraries that claim its names. */
export function packagesNeeded(
  json: unknown,
  libraries: readonly Library<never>[],
  lookup: Lookup = manifest,
): Set<string> {
  const names = reachedNames(json);
  const packages = packagesFor(json, lookup);
  for (const library of libraries) if (library.names?.some((name) => names.has(name))) packages.add(library.name);
  return packages;
}

/**
 * The libraries to declare for `packages`: each one asked for, what it requires (the
 * manifest's `PACKAGES`, and its own `requires`), transitively, and every global one. In
 * `libraries`' order, except that a library comes after what it requires. A package with no
 * library is `missing`.
 */
export function plan<L extends Library<never>>(
  packages: Iterable<string>,
  libraries: readonly L[],
  requires: (name: string) => readonly string[] = (name) => PACKAGES[name]?.requires ?? [],
): { libraries: L[]; missing: string[] } {
  const known = new Map(libraries.map((library) => [library.name, library]));
  // Only what the host can declare: a runtime dependency like `engine` isn't a library.
  const needs = (library: L): string[] =>
    [...requires(library.name), ...(library.requires ?? [])].filter((dep) => known.has(dep));
  const wanted = new Set<string>();
  const missing = new Set<string>();
  const want = (name: string): void => {
    if (wanted.has(name)) return;
    const library = known.get(name);
    if (library === undefined) {
      missing.add(name);
      return;
    }
    wanted.add(name);
    for (const dep of needs(library)) want(dep);
  };
  for (const name of packages) want(name);
  if (wanted.size > 0) for (const library of libraries) if (library.global) want(library.name);

  // Depth-first in the host's order: each library's requirements before it.
  const ordered: L[] = [];
  const placed = new Set<string>();
  const place = (library: L): void => {
    if (placed.has(library.name)) return;
    placed.add(library.name);
    for (const dep of needs(library)) place(known.get(dep)!);
    ordered.push(library);
  };
  for (const library of libraries) if (wanted.has(library.name)) place(library);
  return { libraries: ordered, missing: [...missing].toSorted() };
}

/** Declares into an engine what its expressions need, once per library per engine. */
export interface Resolver<Engine extends object> {
  /** Declare what `json` needs into `ce`; the packages newly declared, and any with no library. */
  ensure(ce: Engine, json: unknown): Promise<{ declared: string[]; missing: string[] }>;
}

export function createResolver<Engine extends object>(
  libraries: readonly Library<Engine>[],
  lookup: Lookup = manifest,
): Resolver<Engine> {
  const declared = new WeakMap<Engine, Set<string>>();
  return {
    async ensure(ce, json) {
      const done = declared.get(ce) ?? new Set<string>();
      declared.set(ce, done);
      const { libraries: needed, missing } = plan(packagesNeeded(json, libraries, lookup), libraries);
      const fresh: string[] = [];
      // In order, one at a time: a library's declarations may read an earlier one's. Across
      // calls, a library a later expression needs lands after those already declared, even if
      // the host lists it earlier; a host whose order matters beyond `requires` ensures up front.
      for (const library of needed) {
        if (done.has(library.name)) continue;
        done.add(library.name);
        await library.declare(ce);
        fresh.push(library.name);
      }
      return { declared: fresh, missing };
    },
  };
}
