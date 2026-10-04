// Names resolved through registries (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup §3–§4):
// an engine gets only what an expression names, and nothing lists every name up front. A
// registry is asked about one name at a time, and answers with the libraries that declare it
// or an Epsil definition to declare. Qualified names (`Statistics.Mean`) are namespaces: a
// namespace is a record of functions, so `Statistics.Mean(x)` evaluates as the field call
// Epsil already parses it to, and nothing about `.` changes.
//
// System symbols (our packages, compute-engine's) are unpinned: they move with the system.
// A definition is identified by its content hash, its pin; what its body uses beyond the
// system it names qualified and pinned (`requires`), so a dependency can't change under it.
// Its body is declared against those pins, not against whatever a namespace holds, so two
// versions of one name can live in one engine.

import { type DefinitionAttribute, declarationOf } from "./declaration.ts";
import type { NotationData } from "./notation-data.ts";
import { describe, namespaceOf, noteDescription } from "./describe.ts";
import { SYMBOLS } from "./generated/symbols.ts";
import { type Library, type Lookup, packagesFor, packagesNeeded, plan } from "./resolve.ts";
import type { Description } from "./types.ts";

/** What a registry needs of an engine: compute-engine's `declare`, `assign` and `lookupDefinition`. */
export interface DeclaringEngine {
  declare(name: string, definition: never): unknown;
  assign(name: string, value: never): unknown;
  lookupDefinition(name: string): unknown;
}

/**
 * An Epsil definition: its signature, a `Function` its calls evaluate (array-form MathJSON),
 * and the pin of every non-system name its body uses, by qualified name. Its options are the
 * signature's optional named parameters, with their defaults here (`declaration.ts`).
 */
export interface Definition {
  readonly signature: string;
  readonly body: unknown;
  readonly requires?: Readonly<Record<string, string>>;
  readonly attributes?: readonly DefinitionAttribute[];
  readonly defaults?: Readonly<Record<string, unknown>>;
  /** Its examples, for `definitionRegistry`; not part of the pin. */
  readonly examples?: readonly Example[];
  /** How it's written; not part of the pin, since a change to it never changes a value. */
  readonly notation?: NotationData;
  /** Its record's summary; not part of the pin. */
  readonly summary?: string;
}

/** One of a definition's examples, as a record's are: what `expr` evaluates to. */
export interface Example {
  readonly id: string;
  readonly expr: unknown;
  readonly expected: unknown;
  /** Relative, for a float result; exact otherwise. */
  readonly tolerance?: number;
}

/**
 * What declares a name: `head` is what the name refers to once declared. A definition may
 * bring its examples, loaded only when it is checked; they aren't part of its pin.
 */
export type Resolution<Engine extends object> = { readonly head: string } & (
  | { readonly libraries: readonly Library<Engine>[] }
  | {
      readonly definition: Definition;
      readonly pin: string;
      readonly examples?: () => Promise<readonly Example[]>;
    }
);

export interface Registry<Engine extends object> {
  /**
   * What declares `name` (`Mean`, or qualified `Statistics.Mean`), or undefined. With a `pin`,
   * only the definition with that pin; without, the latest. Libraries have no pin.
   */
  resolve(name: string, pin?: string): Resolution<Engine> | undefined | Promise<Resolution<Engine> | undefined>;
  /** The names a namespace offers, or undefined where this registry doesn't serve it: its index. */
  names?(namespace: string): readonly string[] | undefined | Promise<readonly string[] | undefined>;
  /**
   * What is known about `name` from the index alone, or undefined where this registry doesn't
   * serve it: no definition fetched, no install check run.
   */
  describe?(name: string): Description | undefined | Promise<Description | undefined>;
}

export { namespaceOf };

/**
 * Our packages as a registry: a head resolves to the libraries that declare it (every one that
 * widens it, as `packagesNeeded` counts them) and what they require. `Pkg.Head` resolves only
 * where `Pkg`'s package declares `Head`, to the same global head.
 */
export function manifestRegistry<Engine extends object>(
  libraries: readonly Library<Engine>[],
  lookup?: Lookup,
): Registry<Engine> {
  const byNamespace = new Map(libraries.map((l) => [namespaceOf(l.name), l.name]));
  return {
    resolve(name) {
      const parts = name.split(".");
      if (parts.length > 2) return undefined;
      const head = parts.at(-1)!;
      const packages = packagesNeeded([head], libraries, lookup);
      if (parts.length === 2) {
        const pkg = byNamespace.get(parts[0]!);
        const declares = pkg !== undefined && (packagesFor([head], lookup).has(pkg) || packages.has(pkg));
        if (!declares) return undefined;
      }
      if (packages.size === 0) return undefined;
      return { head, libraries: plan(packages, libraries).libraries };
    },
    async describe(name) {
      const dot = name.indexOf(".");
      if (dot > 0 && !byNamespace.has(name.slice(0, dot))) return undefined;
      const described = await describe(name);
      return described.kind === "unknown" ? undefined : described;
    },
  };
}

/** JSON with object keys sorted, so equal content hashes equally. */
const canonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );

/**
 * A definition's pin: `sha256-` and the hex digest of what it evaluates by: its signature, body,
 * requires, and its attributes and defaults where it has them (so a definition without them pins
 * as it always has).
 */
export async function pinOf(definition: Definition): Promise<string> {
  const { signature, body, requires = {}, attributes, defaults } = definition;
  const content = {
    signature,
    body,
    requires,
    ...(attributes?.length ? { attributes: attributes.toSorted() } : {}),
    ...(defaults !== undefined && Object.keys(defaults).length > 0 ? { defaults } : {}),
  };
  const bytes = new TextEncoder().encode(canonicalJson(content));
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes));
  return `sha256-${Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The head a pinned definition is declared as: `ns_Name_` and the pin's first hex digits
 * (never written by anyone: `.` isn't legal in an engine's symbol name, and two versions need
 * two heads).
 */
export const pinnedHead = (namespace: string, member: string, pin: string): string =>
  `${namespace}_${member}_${pin.slice(7, 15)}`;

/**
 * Epsil definitions as a registry, under one namespace: each name's versions, oldest first.
 * `ns.Name` resolves to the latest, `ns.Name` with a pin to that version, each under its
 * `pinnedHead`.
 */
export function definitionRegistry<Engine extends object>(
  namespace: string,
  definitions: Readonly<Record<string, Definition | readonly Definition[]>>,
): Registry<Engine> {
  const pinned = new Map<string, Promise<{ definition: Definition; pin: string }[]>>();
  const versions = (member: string) => {
    let found = pinned.get(member);
    if (found === undefined) {
      const list = definitions[member]!;
      const all = Array.isArray(list) ? (list as readonly Definition[]) : [list as Definition];
      found = Promise.all(all.map(async (definition) => ({ definition, pin: await pinOf(definition) })));
      pinned.set(member, found);
    }
    return found;
  };
  return {
    names: (ns) => (ns === namespace ? Object.keys(definitions) : undefined),
    async resolve(name, pin) {
      const [ns, member, ...rest] = name.split(".");
      if (ns !== namespace || member === undefined || rest.length > 0 || !Object.hasOwn(definitions, member))
        return undefined;
      const all = await versions(member);
      const found = pin === undefined ? all.at(-1) : all.find((v) => v.pin === pin);
      if (found === undefined) return undefined;
      const { examples } = found.definition;
      return {
        head: pinnedHead(namespace, member, found.pin),
        ...found,
        ...(examples === undefined ? {} : { examples: async () => examples }),
      };
    },
    async describe(name) {
      const [ns, member, ...rest] = name.split(".");
      if (ns !== namespace || member === undefined || rest.length > 0 || !Object.hasOwn(definitions, member))
        return undefined;
      const { definition, pin } = (await versions(member)).at(-1)!;
      const { body } = definition;
      const names = Array.isArray(body) && body[0] === "Function" ? body.slice(2) : [];
      const params = names.every((n): n is string => typeof n === "string") ? names : undefined;
      return describeLibrarySymbol(name, { ...definition, params, examples: definition.examples?.length }, pin);
    },
  };
}

/** What describes a library symbol: its index entry, or a definition less its body. */
export interface LibrarySymbolFacts {
  readonly signature: string;
  readonly summary?: string;
  readonly requires?: Readonly<Record<string, string>>;
  readonly params?: readonly string[];
  readonly defaults?: Readonly<Record<string, unknown>>;
  readonly attributes?: readonly DefinitionAttribute[];
  /** How many examples it has. */
  readonly examples?: number;
  readonly notation?: NotationData;
}

/** A library symbol's description: `ns.Name` at `pin`, declared as its `pinnedHead`. */
export function describeLibrarySymbol(name: string, facts: LibrarySymbolFacts, pin: string): Description {
  const { signature, summary, params, defaults, attributes, requires, examples, notation } = facts;
  const triggers = (notation?.latex ?? []).map((e) => e.trigger);
  const dot = name.lastIndexOf(".");
  const namespace = name.slice(0, dot);
  return {
    name,
    kind: "function",
    ...(summary === undefined ? {} : { description: summary }),
    signature,
    ...(params?.length ? { params } : {}),
    ...(defaults !== undefined && Object.keys(defaults).length > 0 ? { defaults } : {}),
    ...(attributes?.length ? { attributes } : {}),
    ...(examples ? { examples } : {}),
    ...(triggers.length > 0 ? { triggers } : {}),
    namespace,
    pin,
    ...(requires !== undefined && Object.keys(requires).length > 0 ? { requires } : {}),
    head: pinnedHead(namespace, name.slice(dot + 1), pin),
  };
}

/** Several registries as one: the first that resolves a name (or serves a namespace) has it. */
export function combineRegistries<Engine extends object>(...registries: readonly Registry<Engine>[]): Registry<Engine> {
  return {
    async resolve(name, pin) {
      for (const registry of registries) {
        const found = await registry.resolve(name, pin);
        if (found !== undefined) return found;
      }
      return undefined;
    },
    async names(namespace) {
      for (const registry of registries) {
        const found = await registry.names?.(namespace);
        if (found !== undefined) return found;
      }
      return undefined;
    },
    async describe(name) {
      for (const registry of registries) {
        const found = await registry.describe?.(name);
        if (found !== undefined) return found;
      }
      return undefined;
    },
  };
}

export interface SearchPathOptions {
  /** Namespaces whose names may be written bare, in order. */
  readonly use: readonly string[];
  /** A bare name two used namespaces share: the namespace it means. */
  readonly prefer?: Readonly<Record<string, string>>;
  /** Names left qualified-only: one two namespaces share, or one the system already has. */
  readonly exclude?: readonly string[];
  /** Whether the system has a name: the manifest's, which covers compute-engine's heads too. */
  readonly isSystem?: (name: string) => boolean;
}

/** A bare name the search path can't settle: two namespaces offer it, or the system has it. */
export interface SearchPathConflict {
  readonly name: string;
  readonly namespaces: readonly string[];
  readonly system: boolean;
}

export class SearchPathError extends Error {
  readonly conflicts: readonly SearchPathConflict[];

  constructor(conflicts: readonly SearchPathConflict[]) {
    const lines = conflicts.map(
      (c) => `${c.name}: ${[...(c.system ? ["the system"] : []), ...c.namespaces].join(", ")}`,
    );
    super(`search path: ${conflicts.length} name(s) need prefer or exclude\n  ${lines.join("\n  ")}`);
    this.conflicts = conflicts;
  }
}

/** Which namespace each bare name means. */
export interface SearchPath {
  /** `Sq` as `ada.Sq`, or undefined for a name the path doesn't bring in. */
  qualify(name: string): string | undefined;
}

/**
 * The names `use`'s namespaces bring into bare use, settled when the path is set up rather
 * than when an expression meets them: a name two namespaces share must be preferred or
 * excluded, and a name the system has can only be excluded (a namespace never shadows the
 * system). Anything unsettled throws a `SearchPathError` listing every conflict.
 */
export async function searchPath<Engine extends object>(
  registry: Registry<Engine>,
  options: SearchPathOptions,
): Promise<SearchPath> {
  const { use, prefer = {}, exclude = [], isSystem = (name) => Object.hasOwn(SYMBOLS, name) } = options;
  const offered = new Map<string, string[]>();
  for (const namespace of use) {
    const names = await registry.names?.(namespace);
    if (names === undefined) throw new Error(`search path: no registry serves the namespace ${namespace}`);
    for (const name of names) offered.set(name, [...(offered.get(name) ?? []), namespace]);
  }
  const excluded = new Set(exclude);
  const bare = new Map<string, string>();
  const conflicts: SearchPathConflict[] = [];
  for (const [name, namespaces] of offered) {
    if (excluded.has(name)) continue;
    const system = isSystem(name);
    const chosen = prefer[name];
    if (!system && namespaces.length === 1 && chosen === undefined) bare.set(name, namespaces[0]!);
    else if (!system && chosen !== undefined && namespaces.includes(chosen)) bare.set(name, chosen);
    else conflicts.push({ name, namespaces, system });
  }
  if (conflicts.length > 0) throw new SearchPathError(conflicts);
  return {
    qualify: (name) => {
      const namespace = bare.get(name);
      return namespace === undefined ? undefined : `${namespace}.${name}`;
    },
  };
}

/** `json` with each head the path brings in written qualified: `Sq(3)` as `ada.Sq(3)`. Symbols stay. */
function qualifyHeads(json: unknown, path: SearchPath): unknown {
  if (!Array.isArray(json)) return json;
  const [head, ...args] = json;
  const qualified = typeof head === "string" ? path.qualify(head) : undefined;
  const ops = args.map((a) => qualifyHeads(a, path));
  if (qualified === undefined) return [qualifyHeads(head, path), ...ops];
  const dot = qualified.lastIndexOf(".");
  return ["MemberCall", qualified.slice(0, dot), `'${qualified.slice(dot + 1)}'`, ...ops];
}

/**
 * MathJSON in its short form: `{ fn }` as its array, `{ sym }` a string, `{ str }` quoted, `{ num }`
 * a number where it reads back exactly. Epsil's parser gives the long form, with source offsets.
 */
export function shortForm(json: unknown): unknown {
  if (Array.isArray(json)) return json.map(shortForm);
  if (json === null || typeof json !== "object") return json;
  const { fn, sym, str, num } = json as { fn?: unknown; sym?: unknown; str?: unknown; num?: unknown };
  if (Array.isArray(fn)) return fn.map(shortForm);
  if (typeof sym === "string") return sym;
  if (typeof str === "string") return `'${str}'`;
  if (typeof num === "string") return String(Number(num)) === num ? Number(num) : { num };
  return json;
}

const isSymbol = (json: unknown): json is string => typeof json === "string" && !/^'.*'$/s.test(json);
const memberOf = (json: unknown): string | undefined =>
  typeof json === "string" && /^'.*'$/s.test(json) ? json.slice(1, -1) : undefined;

/** `a` or `Field(a, "b")` as `a` / `a.b`, if it is a chain of names. */
function pathOf(json: unknown): string | undefined {
  if (isSymbol(json)) return json;
  if (Array.isArray(json) && json[0] === "Field" && json.length === 3) {
    const base = pathOf(json[1]);
    const member = memberOf(json[2]);
    return base === undefined || member === undefined ? undefined : `${base}.${member}`;
  }
  return undefined;
}

/** `MemberCall(N, "m", …)` / `Field(N, "m")` over a chain of names, as `N.m`. */
function qualifiedNameAt(json: unknown): string | undefined {
  if (!Array.isArray(json)) return undefined;
  if ((json[0] === "MemberCall" && json.length >= 3) || (json[0] === "Field" && json.length === 3)) {
    const base = pathOf(json[1]);
    const member = memberOf(json[2]);
    if (base !== undefined && member !== undefined) return `${base}.${member}`;
  }
  return undefined;
}

/** Every qualified name `json` uses: `MemberCall(N, "m", …)` and `Field(N, "m")` over a chain of names. */
export function qualifiedNamesOf(json: unknown, into: Set<string> = new Set()): Set<string> {
  if (!Array.isArray(json)) return into;
  const name = qualifiedNameAt(json);
  if (name !== undefined) into.add(name);
  for (const item of json) qualifiedNamesOf(item, into);
  return into;
}

/** Plain names: heads and symbols, whatever their spelling (`{ fn }`, `{ sym }`) in MathJSON. */
function plainNamesOf(json: unknown, into: Set<string>): Set<string> {
  if (typeof json === "string") {
    if (isSymbol(json) && /^[\p{L}_$]/u.test(json)) into.add(json);
  } else if (Array.isArray(json)) for (const item of json) plainNamesOf(item, into);
  else if (json !== null && typeof json === "object") {
    const { fn, sym } = json as { fn?: unknown; sym?: unknown };
    if (typeof sym === "string") into.add(sym);
    if (fn !== undefined) plainNamesOf(fn, into);
  }
  return into;
}

const NONE: ReadonlySet<string> = new Set();

/**
 * `json` with each qualified name `heads` has replaced by its head: a call by a call of it. A
 * name given to a `describeOnly` head (`About(ada.Sq)`) stays as written, or it would describe
 * the pinned head.
 */
export function withHeads(
  json: unknown,
  heads: ReadonlyMap<string, string>,
  describeOnly: ReadonlySet<string> = NONE,
): unknown {
  if (!Array.isArray(json)) return json;
  const name = qualifiedNameAt(json);
  const head = name === undefined ? undefined : heads.get(name);
  if (head !== undefined)
    return json[0] === "Field" ? head : [head, ...json.slice(3).map((a) => withHeads(a, heads, describeOnly))];
  if (typeof json[0] === "string" && describeOnly.has(json[0]))
    return [json[0], ...json.slice(1).map((a) => (pathOf(a) === undefined ? withHeads(a, heads, describeOnly) : a))];
  return json.map((item) => withHeads(item, heads, describeOnly));
}

/**
 * `json` less the names given to a `describeOnly` head, which go in `described`: what is left
 * is what to resolve. Only an argument that is a name (`Sin`, `ada.Sq`) is described; any
 * other (`About(Sin(x))`) resolves as usual.
 */
function withoutDescribed(json: unknown, describeOnly: ReadonlySet<string>, described: Set<string>): unknown {
  if (!Array.isArray(json)) return json;
  if (typeof json[0] === "string" && describeOnly.has(json[0])) {
    const rest: unknown[] = [];
    for (const arg of json.slice(1)) {
      const name = pathOf(arg);
      if (name === undefined) rest.push(withoutDescribed(arg, describeOnly, described));
      else described.add(name);
    }
    return [json[0], ...rest];
  }
  return json.map((item) => withoutDescribed(item, describeOnly, described));
}

export interface Ensured {
  /**
   * The expression to evaluate: the one given, with the search path's bare heads qualified, and
   * a call by namespace lowered to its head where the namespace would lose something: a
   * definition with attributes, or a call by named argument. compute-engine evaluates a field
   * callee's arguments, and sees no parameter names on it.
   */
  readonly expression: unknown;
  /** Libraries and definitions newly declared, in order. */
  readonly declared: readonly string[];
  /** Qualified names nothing resolved, or whose namespace is taken: held, not thrown. */
  readonly unresolved: readonly string[];
  /** The pin each qualified name the expression itself used resolved to: its lock entries. */
  readonly pins: Readonly<Record<string, string>>;
  /** Definitions refused, and why: a dependency not pinned, its pin not found, or (enforced) an example failing. */
  readonly errors: readonly string[];
  /** Definitions checked in this call whose examples failed, by name: the failures. */
  readonly failed: Readonly<Record<string, readonly string[]>>;
  /** Names given to a `describeOnly` head, described and not declared, by name. */
  readonly described: Readonly<Record<string, Description>>;
}

/** Install checking: a definition's examples run in a scratch engine before it is declared. */
export interface InstallCheck<Engine extends DeclaringEngine> {
  /** A fresh engine to check in, with what the host always declares. */
  readonly engine: () => Engine;
  /** `enforce` (the default) refuses a definition whose examples fail; `flag` declares it and reports them. */
  readonly mode?: "enforce" | "flag";
}

export interface CheckedValue {
  readonly json: unknown;
  isSame(other: CheckedValue): boolean;
  N(): { readonly re: number; readonly im: number };
}

/** Whether `got` is `expected`: the same expression, or within `tolerance` where both are numbers. */
export function agrees(got: CheckedValue, expected: CheckedValue, tolerance = 0): boolean {
  if (got.isSame(expected)) return true;
  if (tolerance === 0) return false;
  const [a, b] = [got.N(), expected.N()];
  const close = (x: number, y: number): boolean =>
    Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= tolerance * Math.max(1, Math.abs(y));
  return close(a.re, b.re) && close(a.im, b.im);
}

/** Declares into an engine what its expressions name, through a registry. */
export interface RegistryResolver<Engine extends DeclaringEngine> {
  /** `lock` pins the expression's own qualified names; unpinned ones take the latest. */
  ensure(ce: Engine, json: unknown, lock?: Readonly<Record<string, string>>): Promise<Ensured>;
}

interface EngineState {
  readonly asked: Set<string>;
  readonly libraries: Set<string>;
  /** Heads declared from definitions, by pin: `false` while its dependencies are resolving. */
  readonly definitions: Map<string, boolean>;
  readonly namespaces: Map<string, Map<string, string>>;
  /** Heads whose definitions carry attributes: called by head, not through their namespace. */
  readonly attributed: Set<string>;
}

/** Whether `json` calls `name` (`MemberCall(N, "m", …)`) with a named argument. */
const callsByName = (json: unknown, name: string): boolean =>
  Array.isArray(json) &&
  ((json[0] === "MemberCall" &&
    qualifiedNameAt(json) === name &&
    json.slice(3).some((a) => Array.isArray(a) && a[0] === "NamedArgument")) ||
    json.some((item) => callsByName(item, name)));

/**
 * Resolve every name `json` uses and declare what resolves. A definition's body is declared
 * against its own pins: each qualified name it uses is resolved at the pin it `requires` (a
 * system name needs none) and replaced by that version's head, so what it calls can't change
 * under it. A definition never replaces a head the engine already has; a namespace is
 * declared once and reassigned as members join.
 */
export function createRegistryResolver<Engine extends DeclaringEngine>(
  registry: Registry<Engine>,
  {
    path,
    check,
    notation,
    system,
    describeOnly: describing = [],
  }: {
    path?: SearchPath;
    check?: InstallCheck<Engine>;
    /** Register a declared definition's notation, under the head it's declared as (boxes' `compileNotation`). */
    notation?: (ce: Engine, head: string, data: NotationData) => void;
    /**
     * The host's own resolver (`createResolver` over its catalogue): declares the packages a
     * definition's body names before the definition is, in the install check's engine too, so
     * a library can build on the system's heads and not only compute-engine's.
     */
    system?: (ce: Engine, json: unknown) => Promise<unknown>;
    /**
     * Heads that describe a name rather than use it (`About`, `Information`): a name given to
     * one is described through `registry.describe`, and noted on the engine for the head to
     * read (`describedIn`), never declared or lowered.
     */
    describeOnly?: readonly string[];
  } = {},
): RegistryResolver<Engine> {
  const describeOnly = new Set(describing);
  const states = new WeakMap<Engine, EngineState>();
  // Each pin's failures, checked once for every engine this resolver serves.
  const checked = new Map<string, Promise<readonly string[]>>();
  const scratch =
    check === undefined ? undefined : createRegistryResolver(registry, system === undefined ? {} : { system });

  /** Run a definition's examples in a fresh engine, its name locked to its pin. */
  const failuresOf = async (name: string, found: { pin: string; examples?: () => Promise<readonly Example[]> }) => {
    const ce = check!.engine();
    const lock = { [name]: found.pin };
    const failures: string[] = [];
    for (const example of (await found.examples?.()) ?? []) {
      const { expression, errors } = await scratch!.ensure(ce, example.expr, lock);
      if (errors.length > 0) {
        failures.push(`${example.id}: ${errors.join("; ")}`);
        continue;
      }
      try {
        const box = (json: unknown) => (ce as unknown as { box(j: unknown): { evaluate(): CheckedValue } }).box(json);
        const got = box(expression).evaluate();
        const expected = box(example.expected).evaluate();
        if (!agrees(got, expected, example.tolerance))
          failures.push(`${example.id}: ${JSON.stringify(got.json)}, expected ${JSON.stringify(expected.json)}`);
      } catch (error) {
        failures.push(`${example.id}: throws ${(error as Error).message}`);
      }
    }
    return failures;
  };

  return {
    async ensure(ce, given, lock = {}) {
      const short = shortForm(given);
      const written = path === undefined ? short : qualifyHeads(short, path);
      const describedNames = new Set<string>();
      const json = describeOnly.size === 0 ? written : withoutDescribed(written, describeOnly, describedNames);
      const state = states.get(ce) ?? {
        asked: new Set(),
        libraries: new Set(),
        definitions: new Map(),
        namespaces: new Map(),
        attributed: new Set(),
      };
      states.set(ce, state);
      const declared: string[] = [];
      const unresolved: string[] = [];
      const errors: string[] = [];
      const failed: Record<string, readonly string[]> = {};
      const pins: Record<string, string> = {};

      const declareLibraries = async (libraries: readonly Library<Engine>[]): Promise<void> => {
        for (const library of libraries) {
          if (state.libraries.has(library.name)) continue;
          state.libraries.add(library.name);
          await library.declare(ce);
          declared.push(library.name);
        }
      };

      /** Declare a definition after what its body uses; false if a dependency failed. */
      const declareDefinition = async (
        name: string,
        found: Resolution<Engine> & { definition: Definition; pin: string },
      ): Promise<boolean> => {
        const done = state.definitions.get(found.pin);
        if (done !== undefined) return true;
        if (ce.lookupDefinition(found.head) !== undefined) return true;
        state.definitions.set(found.pin, false);
        const declaredIt = await declareChecked(name, found);
        if (!declaredIt) state.definitions.delete(found.pin);
        return declaredIt;
      };

      const declareChecked = async (
        name: string,
        found: Resolution<Engine> & { definition: Definition; pin: string },
      ): Promise<boolean> => {
        const { body, requires = {} } = found.definition;
        const heads = new Map<string, string>();
        for (const used of qualifiedNamesOf(body)) {
          const pin = requires[used];
          const dependency = await registry.resolve(used, pin);
          if (dependency === undefined) {
            errors.push(`${name}: ${used}${pin === undefined ? "" : `@${pin}`} doesn't resolve`);
            return false;
          }
          if ("libraries" in dependency) await declareLibraries(dependency.libraries);
          else if (pin === undefined) {
            errors.push(`${name}: ${used} isn't a system name, and has no pin in requires`);
            return false;
          } else if (!(await declareDefinition(used, dependency))) return false;
          heads.set(used, dependency.head);
        }
        if (system !== undefined) await system(ce, body);
        for (const used of plainNamesOf(body, new Set())) {
          const dependency = await registry.resolve(used);
          if (dependency !== undefined && "libraries" in dependency) await declareLibraries(dependency.libraries);
        }
        if (check !== undefined) {
          let failures = checked.get(found.pin);
          if (failures === undefined) {
            failures = failuresOf(name, found);
            checked.set(found.pin, failures);
          }
          const failing = await failures;
          if (failing.length > 0) {
            failed[name] = failing;
            if (check.mode !== "flag") {
              errors.push(`${name}: ${failing.length} example(s) fail`);
              return false;
            }
          }
        }
        ce.declare(found.head, declarationOf(found.definition, withHeads(body, heads)) as never);
        if (found.definition.attributes?.length) state.attributed.add(found.head);
        if (found.definition.notation !== undefined) notation?.(ce, found.head, found.definition.notation);
        state.definitions.set(found.pin, true);
        declared.push(found.head);
        return true;
      };

      for (const name of qualifiedNamesOf(json)) {
        if (state.namespaces.get(name.slice(0, name.lastIndexOf(".")))?.has(name.slice(name.lastIndexOf(".") + 1)))
          continue;
        const found = await registry.resolve(name, lock[name]);
        if (found === undefined) {
          unresolved.push(name);
          continue;
        }
        if ("libraries" in found) await declareLibraries(found.libraries);
        else {
          if (!(await declareDefinition(name, found))) continue;
          pins[name] = found.pin;
        }
        if (!bind(ce, state, name, found.head)) unresolved.push(name);
      }
      for (const name of plainNamesOf(json, new Set())) {
        if (state.asked.has(name)) continue;
        state.asked.add(name);
        const found = await registry.resolve(name);
        if (found !== undefined && "libraries" in found) await declareLibraries(found.libraries);
      }
      const lowered = new Map<string, string>();
      for (const name of qualifiedNamesOf(json)) {
        const dot = name.lastIndexOf(".");
        const head = state.namespaces.get(name.slice(0, dot))?.get(name.slice(dot + 1));
        if (head !== undefined && (state.attributed.has(head) || callsByName(json, name))) lowered.set(name, head);
      }
      const expression = lowered.size === 0 ? written : withHeads(written, lowered, describeOnly);
      const described: Record<string, Description> = {};
      for (const name of describedNames) {
        const found = (await registry.describe?.(name)) ?? (await describe(name));
        noteDescription(ce, found);
        described[name] = found;
      }
      return { expression, declared, unresolved, pins, errors, failed, described };
    },
  };
}

/**
 * Put `head` in its namespace's record, declared the first time and reassigned after. False
 * where the namespace's name is already something else's (a variable, a head), or nested.
 */
function bind<Engine extends DeclaringEngine>(ce: Engine, state: EngineState, name: string, head: string): boolean {
  const parts = name.split(".");
  if (parts.length !== 2) return false;
  const [namespace, member] = parts as [string, string];
  const fresh = !state.namespaces.has(namespace);
  if (fresh && ce.lookupDefinition(namespace) !== undefined) return false;
  const members = state.namespaces.get(namespace) ?? new Map<string, string>();
  members.set(member, head);
  state.namespaces.set(namespace, members);
  const value = ["Dictionary", ...[...members].map(([m, h]) => ["Tuple", `'${m}'`, h])];
  if (fresh) ce.declare(namespace, { type: "dictionary<function>", value } as never);
  else ce.assign(namespace, value as never);
  return true;
}
