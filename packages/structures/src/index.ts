import type { ComputeEngine } from "@cortex-js/compute-engine";
import { ensureAlgebraHeads } from "./algebra.ts";
import { declareGenericHeads } from "./generic.ts";
import { conformNumbers } from "./numbers.ts";
import { ensureOperationHeads } from "./operations.ts";
import { ensureProtocols } from "./protocols.ts";

export { type AlgebraFamily, declareAlgebra, ensureAlgebraHeads, type Product, registerProduct } from "./algebra.ts";
export { compare, type Conformance, conform, type Member, member } from "./conform.ts";
export {
  type Carrier,
  collectionCarrierOf,
  ensureOperationHeads,
  type Operation,
  OperationCollisionError,
  type OperationHead,
  operationOf,
  registerCarrier,
  registerCollectionCarrier,
  registerEquivalence,
  registerOperation,
} from "./operations.ts";
export { ancestry, ensureProtocols, PROTOCOLS, type Protocol, type ProtocolName } from "./protocols.ts";

/** The protocols, compute-engine's types' conformances, the generic heads over them, and the algebra heads. */
export function declareStructures(ce: ComputeEngine): void {
  ensureProtocols(ce);
  conformNumbers(ce);
  declareGenericHeads(ce);
  ensureAlgebraHeads(ce);
  ensureOperationHeads(ce);
}
