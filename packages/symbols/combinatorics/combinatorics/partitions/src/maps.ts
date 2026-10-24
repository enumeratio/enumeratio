// Combinatorial maps whose `from` carrier is `integer_partition` (step 6c: the area owning the
// carrier owns the map). See `../../src/map-helpers.ts` for the generic pieces.

import { at, bind, descending, forEach, type CombinatorialMap, positions } from "../../src/map-helpers.ts";

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
  {
    name: "RemoveFirstPart",
    from: "integer_partition",
    to: "integer_partition",
    body: forEach(["Range", 2, ["Length", "_raw"], 1], at("i")),
    summary: "The partition without its largest part: its first row removed.",
    note: "FindStat's Mp00202. Lossy: the largest part is forgotten.",
  },
  {
    name: "BulgarianSolitaire",
    from: "integer_partition",
    to: "integer_partition",
    // Every part loses one cell (the first column), and the removed column becomes a part of its own.
    body: bind(
      "moved",
      ["Flatten", ["List", forEach(positions, ["Subtract", at("i"), 1]), ["List", ["Length", "_raw"]]]],
      ["Filter", descending("moved"), ["Function", ["Greater", "x", 0], "x"]],
      "list<integer>",
    ),
    summary: "A move of Bulgarian solitaire: the first column of the Ferrers diagram becomes a new row.",
    note: "FindStat's Mp00308. Not injective; the fixed points are the staircase partitions.",
  },
  {
    name: "OddPartsWord",
    from: "integer_partition",
    to: "binary_word",
    body: forEach(positions, ["Mod", at("i"), 2]),
    summary: "The binary word marking which parts are odd, the parts taken largest first.",
    note: "FindStat's Mp00317. Lossy: only the parts' parity is kept.",
  },
];
