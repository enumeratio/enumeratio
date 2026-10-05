// Set partitions' own declare (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 5, A-94).
import type { Engine } from "@enumeratio/engine";
import { declareCarriers } from "@enumeratio/structures";
import { declareFamilies } from "../../collections/src/families/declare.ts";
import { liftFamily } from "../../collections/src/families/epsil.ts";
import { declareStatistics } from "../../src/statistics/declare.ts";
import { SET_PARTITIONS_CARRIERS } from "./carrier-data.ts";
import { coreEntries, coreSurjectionsEntries, matchingsEntries, pathsPartitionsEntries } from "./families/index.ts";
import { SET_PARTITION_STATISTICS } from "./statistics.ts";

export function declareSetPartitions(ce: Engine): void {
  declareCarriers(ce, SET_PARTITIONS_CARRIERS, { plurals: false });
  declareFamilies(
    ce,
    [...coreSurjectionsEntries, ...coreEntries, ...pathsPartitionsEntries, ...matchingsEntries].map(liftFamily),
  );
  // Its statistics, after its own carriers and families (step 6b).
  declareStatistics(ce, SET_PARTITION_STATISTICS);
}
