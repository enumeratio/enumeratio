// Every definition this package ships, across every carrier. One list, because the analyses
// that matter — coverage against the catalog, and the reduction down to the primitive
// frontier — are about the whole body of definitions rather than any one carrier.

import { DYCK_STATISTICS } from "./dyck.ts";
import { PARTITION_STATISTICS } from "./partition.ts";
import { SET_PARTITION_STATISTICS } from "./setpartition.ts";
import { PERMUTATION_STATISTICS } from "./permutation.ts";
import type { Definition } from "./types.ts";

export const ALL_STATISTICS: readonly Definition[] = [
  ...PERMUTATION_STATISTICS,
  ...PARTITION_STATISTICS,
  ...DYCK_STATISTICS,
  ...SET_PARTITION_STATISTICS,
];
