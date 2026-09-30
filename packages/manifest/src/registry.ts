// Names resolved through registries (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup §3–§4):
// an engine gets only what an expression names, and nothing lists every name up front. A
// registry is asked about one name at a time, and answers with the libraries that declare it
// or an Epsil definition to declare. Qualified names (`Statistics.Mean`) are namespaces: a
// namespace is a record of functions, so `Statistics.Mean(x)` evaluates as the field call
// Epsil already parses it to, and nothing about `.` changes.

import { type Library, type Lookup, packagesFor, packagesNeeded, plan } from "./resolve.ts";

/** What a registry needs of an engine: compute-engine's `declare`, `assign` and `lookupDefinition`. */
export interface DeclaringEngine {
  declare(name: string, definition: never): unknown;
  assign(name: string, value: never): unknown;
  lookupDefinition(name: string): unknown;
}

/** An Epsil definition: a head, its signature, and a `Function` its calls evaluate. */
export interface Definition {
  readonly signature: string;
  readonly body: unknown;
}

/** What declares a name: `head` is what the name refers to once declared. */
export type Resolution<Engine extends object> = { readonly head: string } & (
  | { readonly libraries: readonly Library<Engine>[] }
  | { readonly definition: Definition }
);

export interface Registry<Engine extends object> {
  /** What declares `name` (`Mean`, or qualified `Statistics.Mean`), or undefined. */
  resolve(name: string): Resolution<Engine> | undefined | Promise<Resolution<Engine> | undefined>;
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

/**
 * Epsil definitions as a registry, under one namespace: `ns.Name` resolves to the head
 * `ns_Name` (never written by anyone: `.` isn't legal in an engine's symbol name).
 */
export function definitionRegistry<Engine extends object>(
  namespace: string,
  definitions: Readonly<Record<string, Definition>>,
): Registry<Engine> {
  return {
    resolve(name) {
      const [ns, member, ...rest] = name.split(".");
      if (ns !== namespace || member === undefined || rest.length > 0 || !Object.hasOwn(definitions, member))
        return undefined;
      return { head: `${namespace}_${member}`, definition: definitions[member]! };
    },
  };
}

/** Registries in search-path order: the first that resolves a name has it. */
export function searchPath<Engine extends object>(...registries: readonly Registry<Engine>[]): Registry<Engine> {
  return {
    async resolve(name) {
      for (const registry of registries) {
        const found = await registry.resolve(name);
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

/** Every qualified name `json` uses: `MemberCall(N, "m", …)` and `Field(N, "m")` over a chain of names. */
export function qualifiedNamesOf(json: unknown, into: Set<string> = new Set()): Set<string> {
  if (!Array.isArray(json)) return into;
  if ((json[0] === "MemberCall" && json.length >= 3) || (json[0] === "Field" && json.length === 3)) {
    const base = pathOf(json[1]);
    const member = memberOf(json[2]);
    if (base !== undefined && member !== undefined) into.add(`${base}.${member}`);
  }
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

export interface Ensured {
  /** Libraries and definitions newly declared, in order. */
  readonly declared: readonly string[];
  /** Qualified names nothing resolved, or whose namespace is taken: held, not thrown. */
  readonly unresolved: readonly string[];
}

/** Declares into an engine what its expressions name, through a registry. */
export interface RegistryResolver<Engine extends DeclaringEngine> {
  ensure(ce: Engine, json: unknown): Promise<Ensured>;
}

interface EngineState {
  readonly asked: Set<string>;
  readonly libraries: Set<string>;
  readonly namespaces: Map<string, Map<string, string>>;
}

/**
 * Resolve every name `json` uses, declare what resolves, and close over the names each
 * declared definition's body uses in turn. A definition never replaces a head the engine
 * already has; a namespace is declared once and reassigned as members join it.
 */
export function createRegistryResolver<Engine extends DeclaringEngine>(
  registry: Registry<Engine>,
): RegistryResolver<Engine> {
  const states = new WeakMap<Engine, EngineState>();
  return {
    async ensure(ce, json) {
      const state = states.get(ce) ?? { asked: new Set(), libraries: new Set(), namespaces: new Map() };
      states.set(ce, state);
      const declared: string[] = [];
      const unresolved: string[] = [];
      const queue = [...qualifiedNamesOf(json), ...plainNamesOf(json, new Set())];
      while (queue.length > 0) {
        const name = queue.shift()!;
        if (state.asked.has(name)) continue;
        state.asked.add(name);
        const qualified = name.includes(".");
        const found = await registry.resolve(name);
        if (found === undefined) {
          if (qualified) unresolved.push(name);
          continue;
        }
        if ("libraries" in found) {
          for (const library of found.libraries) {
            if (state.libraries.has(library.name)) continue;
            state.libraries.add(library.name);
            await library.declare(ce);
            declared.push(library.name);
          }
        } else if (ce.lookupDefinition(found.head) === undefined) {
          const { signature, body } = found.definition;
          ce.declare(found.head, { signature, evaluate: body } as never);
          declared.push(found.head);
          queue.push(...qualifiedNamesOf(body), ...plainNamesOf(body, new Set()));
        }
        if (qualified && !bind(ce, state, name, found.head)) unresolved.push(name);
      }
      return { declared, unresolved };
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
