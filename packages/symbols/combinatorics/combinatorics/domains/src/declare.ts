// Combinatorics' own thin wrapper over the generic carrier machinery, which now lives in
// @enumeratio/structures (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step
// 1): `declareCarriers`/`declareCarrierPlurals`/`declareCarrierElement` mint the type, the
// held constructor and the plural/Element machinery for whatever carrier data they are given.
// This module supplies combinatorics' own data (`DOMAINS`, from `domain-data.ts`) and keeps
// the names every host already calls (`declareDomains` and friends) so nothing importing
// `@enumeratio/combinatorics/domains` has to change.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import {
  contentsOf,
  type Domain,
  declareCarrierElement,
  declareCarrierPlurals,
  declareCarriers,
} from "@enumeratio/structures";
import { declareDomainOrders } from "../../partitions/src/orders.ts";
import { DOMAINS } from "./domain-data.ts";

/**
 * Declare every combinatorics carrier and its constructor on `ce`. Does NOT declare the
 * plural type-space names — `declareDomainPlurals` does that; see its own doc for why it has
 * to run later, after whatever else in the engine declares a collection family.
 */
export function declareDomains(ce: ComputeEngine, domains: readonly Domain[] = DOMAINS): void {
  declareCarriers(ce, domains);
  // Partitions' dominance order needs the carrier declared first; combinatorics-specific, so
  // it stays a call here rather than in the generic structures machinery.
  if (domains.some((domain) => domain.type === "integer_partition")) declareDomainOrders(ce);
}

/** Mint every combinatorics carrier's plural type-space name — see `declareCarrierPlurals`. */
export function declareDomainPlurals(ce: ComputeEngine, domains: readonly Domain[] = DOMAINS): void {
  declareCarrierPlurals(ce, domains);
}

/** Layer `Element(x, <plural>)` membership for every combinatorics carrier — see
 *  `declareCarrierElement`. */
export function declareDomainElement(ce: ComputeEngine, domains: readonly Domain[] = DOMAINS): void {
  declareCarrierElement(ce, domains);
}

export { contentsOf };
