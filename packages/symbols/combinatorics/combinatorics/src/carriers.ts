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

import type { ComputeEngine } from "@cortex-js/compute-engine";
import { type Carrier, declareCarriers } from "@enumeratio/structures";
import { COMPOSITIONS_CARRIERS } from "../compositions/src/carrier-data.ts";
import { FINDSTAT_CARRIERS } from "../findstat/src/carrier-data.ts";
import { GRAPHS_CARRIERS } from "../graphs/src/carrier-data.ts";
import { LATTICE_PATHS_CARRIERS } from "../lattice-paths/src/carrier-data.ts";
import { declareCarrierOrders } from "../partitions/src/orders.ts";
import { PARTITIONS_CARRIERS } from "../partitions/src/carrier-data.ts";
import { PERMUTATIONS_CARRIERS } from "../permutations/src/carrier-data.ts";
import { SET_PARTITIONS_CARRIERS } from "../set-partitions/src/carrier-data.ts";
import { TABLEAUX_CARRIERS } from "../tableaux/src/carrier-data.ts";
import { TREES_CARRIERS } from "../trees/src/carrier-data.ts";
import { WORDS_CARRIERS } from "../words/src/carrier-data.ts";

/** Carriers with no combinatorics area of their own — none, currently; see `CARRIERS`' own doc. */
export const LEFTOVER_CARRIERS: readonly Carrier[] = [];

/** Every carrier combinatorics itself owns: the areas' own data, plus its findstat tooling
 *  records. Carriers other packages own (arithmetic, GlyphKind) are declared by THOSE
 *  packages' own `declareCarriers` call instead — see each host's declare order. */
export const CARRIERS: readonly Carrier[] = [
  ...PERMUTATIONS_CARRIERS,
  ...PARTITIONS_CARRIERS,
  ...COMPOSITIONS_CARRIERS,
  ...WORDS_CARRIERS,
  ...LATTICE_PATHS_CARRIERS,
  ...TREES_CARRIERS,
  ...SET_PARTITIONS_CARRIERS,
  ...TABLEAUX_CARRIERS,
  ...GRAPHS_CARRIERS,
  ...FINDSTAT_CARRIERS,
  ...LEFTOVER_CARRIERS,
];

/**
 * Declare every combinatorics carrier and its constructor on `ce`, via `@enumeratio/structures`'
 * generic `declareCarriers` — see the file comment for why `{ plurals: false }`.
 */
export function declareCombinatoricsCarriers(ce: ComputeEngine, carriers: readonly Carrier[] = CARRIERS): void {
  declareCarriers(ce, carriers, { plurals: false });
  // Partitions' dominance order needs the carrier declared first; combinatorics-specific, so
  // it stays a call here rather than in the generic structures machinery.
  if (carriers.some((carrier) => carrier.type === "integer_partition")) declareCarrierOrders(ce);
}
