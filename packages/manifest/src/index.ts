import { NOTATIONS } from "./generated/notations.ts";
import { SYMBOLS } from "./generated/symbols.ts";
import type { SymbolInfo } from "./types.ts";

export { canonicalOrder } from "./canonical.ts";
export type { DeclaredSymbol, Description, FindStatId, Overload, SymbolAttribute, SymbolInfo } from "./types.ts";
export {
  type DescribeOptions,
  describe,
  describedIn,
  describeNow,
  loadSummaries,
  matching,
  noteDescription,
  winningOverload,
} from "./describe.ts";

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
  type BuiltEngine,
  buildEngine,
  type BuildEngineOptions,
  DECLARE_ORDER,
  DECLARE_PREFERENCE,
  declarePlan,
  dependedLibraries,
  enginePlan,
  type EnginePlan,
  type EnginePlanOptions,
  type Importer,
  loadLibraries,
  type Reason,
  type StagedLibrary,
  type Step,
} from "./engine.ts";
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
  describeLibrarySymbol,
  type Ensured,
  type LibrarySymbolFacts,
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
export { type BoxTemplate, type LatexData, type NotationData, notationProblem, slotsOf } from "./notation-data.ts";
export {
  assembleManifest,
  type EngineHeads,
  type IndexedRecord,
  type IndexedSignature,
  type Manifest,
  type PackageIndex,
} from "./assemble.ts";
export { notationSpecifier, type PackageField } from "./package-field.ts";
export { SYSTEM_VERSION } from "./system.ts";
