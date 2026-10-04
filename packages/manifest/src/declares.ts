// What declaring a library finds (https://github.com/enumeratio/enumeratio/wiki/Speculative-Per-Package-Repos
// §4.1): each library's build writes its own (scripts/collect-declares.ts), and a host puts the
// resolver's tables together from the libraries it has. The manifest reads records and loads no
// code, so a head whose record doesn't say which package declares it is only known here.

import { ENGINE_CANONICAL } from "./generated/canonical.ts";

/** A library's `declares.json`: what declaring it into an engine over what it requires finds. */
export interface LibraryDeclares {
  /** The names it declares, redefines or adds overload rows to. */
  readonly names: readonly string[];
  /** Each of those that canonicalises to other heads (`Lb(x)` is `Log(x, 2)`), with the heads. */
  readonly canonical?: Readonly<Record<string, readonly string[]>>;
  /** The carrier types it mints (`ce.declareType`). */
  readonly types?: readonly string[];
}

/** The resolver's tables, for the libraries a host has. */
export interface DeclarerTables {
  /** Each name, the libraries that declare or redefine it, in the host's order. */
  readonly declarers: Readonly<Record<string, readonly string[]>>;
  /** The heads each head canonicalises to, which an expression needs too. */
  readonly canonical: Readonly<Record<string, readonly string[]>>;
  /** The carrier types each library mints: a row on one of a package's own types doesn't need
   *  it loaded until something makes such a value. */
  readonly carrierTypes: Readonly<Record<string, readonly string[]>>;
}

export const NO_DECLARERS: DeclarerTables = { declarers: {}, canonical: ENGINE_CANONICAL, carrierTypes: {} };

/** The tables from each library's `declares`, in `libraries`' order, over compute-engine's own
 *  canonical forms. A library without any is left to the records' overloads. */
export function assembleDeclarers(
  libraries: readonly { readonly name: string; readonly declares?: LibraryDeclares }[],
): DeclarerTables {
  const declarers: Record<string, string[]> = {};
  const canonical: Record<string, readonly string[]> = { ...ENGINE_CANONICAL };
  const carrierTypes: Record<string, string[]> = {};
  for (const { name, declares } of libraries) {
    if (declares === undefined) continue;
    for (const head of declares.names) (declarers[head] ??= []).push(name);
    for (const [head, reached] of Object.entries(declares.canonical ?? {}))
      canonical[head] = [...new Set([...(canonical[head] ?? []), ...reached])];
    for (const type of declares.types ?? []) (carrierTypes[type] ??= []).push(name);
  }
  return { declarers, canonical, carrierTypes };
}
