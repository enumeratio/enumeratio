import type { ComputeEngine } from "@cortex-js/compute-engine";
import { declareCarrierElement, declareCarrierPlurals, declareCarriers } from "@enumeratio/structures";
import { FRONTEND_CARRIERS } from "./carrier-data.ts";

export { FRONTEND_CARRIERS };

/** This package's own carrier (`GlyphKind`) — see carrier-data.ts. Not part of
 *  `@enumeratio/frontend`'s usual per-symbol declarations, since nothing here computes with
 *  it yet; a host assembling every library it ships calls this alongside the rest. Types and
 *  constructors only; plurals are `declareFrontendCarrierPlurals`, a separate call — see
 *  @enumeratio/number-theory's `declareNumberTheory` for why. */
export function declareFrontendCarriers(ce: ComputeEngine): void {
  declareCarriers(ce, FRONTEND_CARRIERS);
}

/** `GlyphKind`'s plural type-space name and `Element` membership. */
export function declareFrontendCarrierPlurals(ce: ComputeEngine): void {
  declareCarrierPlurals(ce, FRONTEND_CARRIERS);
  declareCarrierElement(ce, FRONTEND_CARRIERS);
}
