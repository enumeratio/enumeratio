import { SYMBOLS } from "./generated/symbols.ts";
import type { SymbolInfo } from "./types.ts";

export { canonicalOrder } from "./canonical.ts";
export type { DeclaredSymbol, FindStatId, Overload, SymbolAttribute, SymbolInfo } from "./types.ts";

/** Every head we know, by name. */
export { SYMBOLS };

/** The head called `name`, or undefined. */
export const symbolInfo = (name: string): SymbolInfo | undefined =>
  Object.hasOwn(SYMBOLS, name) ? SYMBOLS[name] : undefined;
export { CANONICAL, CARRIER_TYPES, DECLARERS } from "./declarers-data.ts";
export { PACKAGES } from "./generated/packages.ts";
export {
  createResolver,
  type Library,
  type Lookup,
  namesOf,
  packagesFor,
  packagesNeeded,
  plan,
  reachedNames,
  type Resolver,
} from "./resolve.ts";
export {
  combineRegistries,
  createRegistryResolver,
  type DeclaringEngine,
  type Definition,
  definitionRegistry,
  type Ensured,
  type Example,
  type InstallCheck,
  manifestRegistry,
  namespaceOf,
  pinnedHead,
  pinOf,
  qualifiedNamesOf,
  type Registry,
  type RegistryResolver,
  type Resolution,
  type SearchPath,
  type SearchPathConflict,
  SearchPathError,
  type SearchPathOptions,
  searchPath,
  withHeads,
} from "./registry.ts";
export {
  type FetchJson,
  npmRegistry,
  type NpmRegistryOptions,
  type SymbolIndex,
  symbolIndexOf,
  type SymbolPackageField,
} from "./npm-registry.ts";
