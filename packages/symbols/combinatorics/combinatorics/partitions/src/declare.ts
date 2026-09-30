// Partitions' own declare (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 5, A-94):
// its carriers (dominance order included, since it needs `integer_partition` declared), then the
// families they type. `declareCombinatorics` calls this alongside the other nine areas'.
import type { ComputeEngine } from "@cortex-js/compute-engine";
import { declareCarriers } from "@enumeratio/structures";
import { declareFamilies } from "../../collections/src/families/declare.ts";
import { numberKernel } from "../../collections/src/families/types.ts";
import { declareStatistics } from "../../src/statistics/declare.ts";
import { PARTITIONS_CARRIERS } from "./carrier-data.ts";
import { coreEntries, coreEpsilFamilies, partitionsEntries, tableauxPlaneEntries } from "./families/index.ts";
import { declareCarrierOrders } from "./orders.ts";
import { PARTITION_STATISTICS } from "./statistics.ts";

export function declarePartitions(ce: ComputeEngine): void {
  declareCarriers(ce, PARTITIONS_CARRIERS, { plurals: false });
  declareCarrierOrders(ce);
  // coreEntries then coreEpsilFamilies (not the other way) keeps core.ts's catalogue order:
  // PartitionsInBox is Epsil now but was always the last of core.ts's five.
  declareFamilies(ce, [
    ...coreEntries.map(numberKernel),
    ...coreEpsilFamilies,
    ...[...partitionsEntries, ...tableauxPlaneEntries].map(numberKernel),
  ]);
  // Its statistics, after its own carriers and families (step 6b).
  declareStatistics(ce, PARTITION_STATISTICS);
}
