// Every definition this package ships, across every carrier. One list, because the analyses
// that matter — coverage against the catalog, and the reduction down to the primitive
// frontier — are about the whole body of definitions rather than any one carrier.

import { DYCK_STATISTICS } from "../../lattice-paths/src/statistics.ts";
import { LATTICE_PATHS_FRONTIER } from "../../lattice-paths/src/statistics.frontier.ts";
import { PARTITION_STATISTICS } from "../../partitions/src/statistics.ts";
import { PARTITIONS_FRONTIER } from "../../partitions/src/statistics.frontier.ts";
import { SET_PARTITION_STATISTICS } from "../../set-partitions/src/statistics.ts";
import { SET_PARTITIONS_FRONTIER } from "../../set-partitions/src/statistics.frontier.ts";
import { PERMUTATION_STATISTICS } from "../../permutations/src/statistics.ts";
import { PERMUTATIONS_FRONTIER } from "../../permutations/src/statistics.frontier.ts";
import type { Definition, FrontierEntry } from "./types.ts";

export const ALL_STATISTICS: readonly Definition[] = [
  ...PERMUTATION_STATISTICS,
  ...PARTITION_STATISTICS,
  ...DYCK_STATISTICS,
  ...SET_PARTITION_STATISTICS,
];

/** Every area's frontier, concatenated — the union `statistics-coverage.test.ts` (catalog)
 *  and the drift tests check against. */
export const ALL_FRONTIER: readonly FrontierEntry[] = [
  ...PERMUTATIONS_FRONTIER,
  ...PARTITIONS_FRONTIER,
  ...LATTICE_PATHS_FRONTIER,
  ...SET_PARTITIONS_FRONTIER,
];
