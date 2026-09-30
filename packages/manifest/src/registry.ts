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

import { type Library, type Lookup, packagesFor, packagesNeeded, plan } from "./resolve.ts";

/** What a registry needs of an engine: compute-engine's `declare`, `assign` and `lookupDefinition`. */
export interface DeclaringEngine {
  declare(name: string, definition: never): unknown;
  assign(name: string, value: never): unknown;
  lookupDefinition(name: string): unknown;
}

/**
 * An Epsil definition: its signature, a `Function` its calls evaluate (array-form MathJSON),
 * and the pin of every non-system name its body uses, by qualified name.
 */
export interface Definition {
  readonly signature: string;
  readonly body: unknown;
  readonly requires?: Readonly<Record<string, string>>;
}

/** What declares a name: `head` is what the name refers to once declared. */
export type Resolution<Engine extends object> = { readonly head: string } & (
  | { readonly libraries: readonly Library<Engine>[] }
  | { readonly definition: Definition; readonly pin: string }
);

export interface Registry<Engine extends object> {
  /**
   * What declares `name` (`Mean`, or qualified `Statistics.Mean`), or undefined. With a `pin`,
   * only the definition with that pin; without, the latest. Libraries have no pin.
   */
  resolve(name: string, pin?: string): Resolution<Engine> | undefined | Promise<Resolution<Engine> | undefined>;
}

/** A package's namespace: `number-theory` is `NumberTheory`. */
export const namespaceOf = (pkg: string): string =>
  pkg.replace(/(^|-)([a-z0-9])/g, (_, _dash: string, c: string) => c.toUpperCase());

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
  };
}

/** JSON with object keys sorted, so equal content hashes equally. */
const canonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );

/** A definition's pin: `sha256-` and the hex digest of its signature, body and requires. */
export async function pinOf(definition: Definition): Promise<string> {
  const { signature, body, requires = {} } = definition;
  const bytes = new TextEncoder().encode(canonicalJson({ signature, body, requires }));
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes));
  return `sha256-${Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Epsil definitions as a registry, under one namespace: each name's versions, oldest first.
 * `ns.Name` resolves to the latest, `ns.Name` with a pin to that version, and the head is
 * `ns_Name_` and the pin's first hex digits (never written by anyone: `.` isn't legal in an
 * engine's symbol name, and two versions need two heads).
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
    async resolve(name, pin) {
      const [ns, member, ...rest] = name.split(".");
      if (ns !== namespace || member === undefined || rest.length > 0 || !Object.hasOwn(definitions, member))
        return undefined;
      const all = await versions(member);
      const found = pin === undefined ? all.at(-1) : all.find((v) => v.pin === pin);
      if (found === undefined) return undefined;
      return { head: `${namespace}_${member}_${found.pin.slice(7, 15)}`, ...found };
    },
  };
}

/** Registries in search-path order: the first that resolves a name has it. */
export function searchPath<Engine extends object>(...registries: readonly Registry<Engine>[]): Registry<Engine> {
  return {
    async resolve(name, pin) {
      for (const registry of registries) {
        const found = await registry.resolve(name, pin);
        if (found !== undefined) return found;
      }
      return undefined;
    },
  };
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

/** `json` with each qualified name `heads` has replaced by its head: a call by a call of it. */
function withHeads(json: unknown, heads: ReadonlyMap<string, string>): unknown {
  if (!Array.isArray(json)) return json;
  const name = qualifiedNameAt(json);
  const head = name === undefined ? undefined : heads.get(name);
  if (head !== undefined) return json[0] === "Field" ? head : [head, ...json.slice(3).map((a) => withHeads(a, heads))];
  return json.map((item) => withHeads(item, heads));
}

export interface Ensured {
  /** Libraries and definitions newly declared, in order. */
  readonly declared: readonly string[];
  /** Qualified names nothing resolved, or whose namespace is taken: held, not thrown. */
  readonly unresolved: readonly string[];
  /** The pin each qualified name the expression itself used resolved to: its lock entries. */
  readonly pins: Readonly<Record<string, string>>;
  /** Definitions refused, and why: a dependency not pinned, or its pin not found. */
  readonly errors: readonly string[];
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
}

/**
 * Resolve every name `json` uses and declare what resolves. A definition's body is declared
 * against its own pins: each qualified name it uses is resolved at the pin it `requires` (a
 * system name needs none) and replaced by that version's head, so what it calls can't change
 * under it. A definition never replaces a head the engine already has; a namespace is
 * declared once and reassigned as members join.
 */
export function createRegistryResolver<Engine extends DeclaringEngine>(
  registry: Registry<Engine>,
): RegistryResolver<Engine> {
  const states = new WeakMap<Engine, EngineState>();

  return {
    async ensure(ce, json, lock = {}) {
      const state = states.get(ce) ?? {
        asked: new Set(),
        libraries: new Set(),
        definitions: new Map(),
        namespaces: new Map(),
      };
      states.set(ce, state);
      const declared: string[] = [];
      const unresolved: string[] = [];
      const errors: string[] = [];
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
        const { signature, body, requires = {} } = found.definition;
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
        for (const used of plainNamesOf(body, new Set())) {
          const dependency = await registry.resolve(used);
          if (dependency !== undefined && "libraries" in dependency) await declareLibraries(dependency.libraries);
        }
        ce.declare(found.head, { signature, evaluate: withHeads(body, heads) } as never);
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
      return { declared, unresolved, pins, errors };
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
