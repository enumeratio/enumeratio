export { contentsOf, declareDomainElement, declareDomainPlurals, declareDomains } from "./declare.ts";
export { type CombinatorialMap, declareMaps, evaluateDefinition, type Law, MAPS } from "./map.ts";
export { checkLaws, type LawFailure } from "./laws.ts";
export { UNDEFINED_MAPS, type UndefinedMap } from "./frontier-maps.ts";
export { DOMAINS, LEFTOVER_DOMAINS } from "./domain-data.ts";
export type { Domain, Shape } from "@enumeratio/structures";
// Generic carrier machinery moved to @enumeratio/structures (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 1) — re-exported here so nothing importing
// `@enumeratio/combinatorics/domains` for these has to change.
export {
  applyComposition,
  declareCompose,
  type Extension,
  extendBuiltin,
  PRIVATE_SUFFIX,
  privateNameFor,
  publicName,
  ALL_REPRESENTATIONS,
  canonicalFor,
  LATEX_REPRESENTATIONS,
  type Medium,
  type Representation,
  REPRESENTATIONS,
  representationsFor,
  declareRestricted,
  declareRestrictions,
  fillPredicate,
  RESTRICTIONS,
  RestrictionCollisionError,
  type Restriction,
} from "@enumeratio/structures";
// Area-owned carrier code, re-exported from its new home (step 2).
export {
  afterInserting,
  bumpedFrom,
  insertionShape,
  insertionTableau,
  rowAfterInserting,
} from "../../tableaux/src/tableau.ts";
