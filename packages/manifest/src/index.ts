import { NOTATIONS } from "./generated/notations.ts";
import { SYMBOLS } from "./generated/symbols.ts";
import type { SymbolInfo } from "./types.ts";

export { canonicalOrder } from "./canonical.ts";
export type { DeclaredSymbol, FindStatId, Overload, SymbolAttribute, SymbolInfo } from "./types.ts";

/** Every head we know, by name. */
export { SYMBOLS };

/** Each package's notation entry (`package.json`'s `enumeratio.notation`), by manifest name:
 *  the specifier a host imports before it builds an engine. */
export { NOTATIONS };

/** The head called `name`, or undefined. */
export const symbolInfo = (name: string): SymbolInfo | undefined =>
  Object.hasOwn(SYMBOLS, name) ? SYMBOLS[name] : undefined;
export { CANONICAL, CARRIER_TYPES, DECLARERS } from "./declarers-data.ts";
export { HIERARCHY, type Layer, PACKAGES, type Placement } from "./hierarchy.ts";
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
export { type Declarable, type DefinitionAttribute, declarationOf } from "./declaration.ts";
export { notationSpecifier, type PackageField } from "./package-field.ts";
export { SYSTEM_VERSION } from "./system.ts";
