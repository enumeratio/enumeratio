// Combinatorics' own carrier declaration (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4
// steps 1 and 4): the aggregated carrier list, and the thin per-package call over
// `@enumeratio/structures`' generic `declareCarriers` that every other carrier-owning package
// (number-theory, residues, numerals, hypercomplex, frontend) also has. Unlike those, this one
// still opts OUT of `declareCarriers`' default plural folding (`{ plurals: false }`): a
// combinatorics carrier's plural (`Permutations`, `DyckPaths`, …) is routinely the name a REAL
// collection family (`declareCollections`) declares right after this runs, and that family's
// own `ce.declare` would throw "already declared" if a bare `set<...>` symbol had already
// claimed the name here. `declareCarrierPlurals`/`declareCarrierElement` mint that later,
// called directly by each host at its own position in its own declare order.

import type { Engine } from "@enumeratio/engine";
import { type Carrier, declareCarriers } from "@enumeratio/structures";
import { CARRIERS } from "./carrier-list.ts";
import { declareCarrierOrders } from "../partitions/src/orders.ts";

export { CARRIERS, LEFTOVER_CARRIERS } from "./carrier-list.ts";

/**
 * Declare every combinatorics carrier and its constructor on `ce`, via `@enumeratio/structures`'
 * generic `declareCarriers` — see the file comment for why `{ plurals: false }`.
 */
export function declareCombinatoricsCarriers(ce: Engine, carriers: readonly Carrier[] = CARRIERS): void {
  declareCarriers(ce, carriers, { plurals: false });
  // Partitions' dominance order needs the carrier declared first; combinatorics-specific, so
  // it stays a call here rather than in the generic structures machinery.
  if (carriers.some((carrier) => carrier.type === "integer_partition")) declareCarrierOrders(ce);
}
