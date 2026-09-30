import type { ComputeEngine } from "@cortex-js/compute-engine";
import { ensureAlgebraHeads } from "./algebra.ts";
import { declareGenericHeads } from "./generic.ts";
import { conformNumbers } from "./numbers.ts";
import { ensureOperationHeads } from "./operations.ts";
import { ensureProtocols } from "./protocols.ts";

export { type AlgebraFamily, declareAlgebra, ensureAlgebraHeads, type Product, registerProduct } from "./algebra.ts";
export { compare, type Conformance, conform, type Member, member } from "./conform.ts";
export {
  allCarrierNames,
  type CarrierRegistration,
  carrierNameForType,
  collectionCarrierOf,
  ensureOperationHeads,
  type Operation,
  OperationCollisionError,
  type OperationHead,
  operationEpsil,
  type OperationEpsil,
  operationOf,
  registerCarrier,
  registerCollectionCarrier,
  registerEquivalence,
  registerOperation,
} from "./operations.ts";
export { ancestry, ensureProtocols, PROTOCOLS, type Protocol, type ProtocolName } from "./protocols.ts";
export {
  attachConversion,
  type Carrier,
  contentsOf,
  declareCarrierElement,
  declareCarrierPlurals,
  declareCarriers,
  type Shape,
  typeFor,
} from "./carriers.ts";
export { type Extension, extendBuiltin, PRIVATE_SUFFIX, privateNameFor, publicName } from "./extend.ts";
export {
  ALL_REPRESENTATIONS,
  canonicalFor,
  LATEX_REPRESENTATIONS,
  type Medium,
  type Representation,
  REPRESENTATIONS,
  representationsFor,
} from "./representation.ts";
export { applyComposition, declareCompose } from "./compose.ts";
export {
  declareRestricted,
  declareRestrictions,
  fillPredicate,
  RESTRICTIONS,
  RestrictionCollisionError,
  type Restriction,
} from "./restriction.ts";

/** The protocols, compute-engine's types' conformances, the generic heads over them, and the algebra heads. */
export function declareStructures(ce: ComputeEngine): void {
  ensureProtocols(ce);
  conformNumbers(ce);
  declareGenericHeads(ce);
  ensureAlgebraHeads(ce);
  ensureOperationHeads(ce);
}
