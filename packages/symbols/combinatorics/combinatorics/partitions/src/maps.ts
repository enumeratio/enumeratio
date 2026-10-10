// Combinatorial maps whose `from` carrier is `integer_partition` (step 6c: the area owning the
// carrier owns the map). See `../../src/map-helpers.ts` for the generic pieces.

import { forEach, type CombinatorialMap } from "../../src/map-helpers.ts";

export const PARTITIONS_MAPS: readonly CombinatorialMap[] = [
  {
    name: "TransposePartition",
    from: "integer_partition",
    to: "integer_partition",
    // Column i of the diagram has as many cells as there are parts of at least i. The empty
    // partition is its own case: `Max` of no parts is not a bound for `Range`.
    body: [
      "If",
      ["Equal", ["Length", "_raw"], 0],
      ["List"],
      forEach(
        ["Range", 1, ["Max", "_raw"], 1],
        ["Count", ["Filter", "_raw", ["Function", ["GreaterEqual", "p", "i"], "p"]]],
      ),
    ],
    summary: "The conjugate partition: column i of the Ferrers diagram becomes row i.",
    note: "Entry i of the result counts the parts that are at least i, so it is its own inverse and swaps the number of parts with the largest part. Combinatorica's TransposePartition; FindStat's Mp00044, \"conjugate\". Wolfram's Conjugate is the complex conjugate, not this map.",
  },
];
