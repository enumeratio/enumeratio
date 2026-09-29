// Carrier domains for the partitions area (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 4). Hand-maintained: split from the retired domains/scripts/extract.ts
// generator, one-time, from the last generated domain-data.ts. Families for this area move
// here in step 5.

import type { Domain } from "@enumeratio/structures";

export const PARTITIONS_DOMAINS: readonly Domain[] = [
  {
    name: "CorePartition",
    type: "core_partition",
    shape: "list<integer>",
    id: "core_partition",
    plural: "CorePartitions",
  },
  {
    name: "IntegerPartition",
    type: "integer_partition",
    shape: "list<integer>",
    id: "integer_partition",
    plural: "IntegerPartitions",
  },
  {
    name: "MultiplicativePartition",
    type: "multiplicative_partition",
    shape: "list<integer>",
    id: "multiplicative_partition",
    plural: "MultiplicativePartitions",
  },
  {
    name: "SkewPartition",
    type: "skew_partition",
    shape: "tuple<list<integer>, list<integer>>",
    id: "skew_partition",
    plural: "SkewPartitions",
  },
  {
    name: "TotalPartition",
    type: "total_partition",
    shape: "list<integer>",
    id: "total_partition",
    plural: "TotalPartitions",
  },
];
