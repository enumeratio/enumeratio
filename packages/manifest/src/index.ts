import { SYMBOLS } from "./generated/symbols.ts";
import type { SymbolInfo } from "./types.ts";

export { canonicalOrder } from "./canonical.ts";
export type { DeclaredSymbol, FindStatId, Overload, SymbolAttribute, SymbolInfo } from "./types.ts";

/** Every head we know, by name. */
export { SYMBOLS };

/** The head called `name`, or undefined. */
export const symbolInfo = (name: string): SymbolInfo | undefined =>
  Object.hasOwn(SYMBOLS, name) ? SYMBOLS[name] : undefined;
export { DECLARERS } from "./declarers-data.ts";
export { PACKAGES } from "./generated/packages.ts";
export {
  createResolver,
  type Library,
  type Lookup,
  namesOf,
  packagesFor,
  packagesNeeded,
  plan,
  type Resolver,
} from "./resolve.ts";
export {
  createRegistryResolver,
  type DeclaringEngine,
  type Definition,
  definitionRegistry,
  type Ensured,
  manifestRegistry,
  namespaceOf,
  qualifiedNamesOf,
  type Registry,
  type RegistryResolver,
  type Resolution,
  searchPath,
} from "./registry.ts";
