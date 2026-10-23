// Combinatorial maps whose `from` carrier is a tableaux carrier (conventions as in
// `permutations/src/maps.ts`).

import { at, bind, forEach, type CombinatorialMap, type MathJSON } from "../../src/map-helpers.ts";
import { inverseRsk } from "./families/rsk-pairs.ts";

/** The rows of one tableau of the pair: a pair's contents are two `StandardTableau(rows)`, and
 *  `At` doesn't see through the constructor, but a lambda argument does. */
const rowsOf = (side: number): MathJSON => ["Apply", ["Function", ["At", "tb", 1], "tb"], ["At", "_raw", side]];

export const TABLEAUX_MAPS: readonly CombinatorialMap[] = [
  {
    name: "IntegerPartition",
    convert: true,
    from: "standard_tableau",
    to: "integer_partition",
    body: forEach(["Range", 1, ["Length", "_raw"], 1], ["Length", at("i")]),
    summary: "The shape of a standard tableau: its row lengths.",
    findstat: ["Mp00083"],
  },
  {
    name: "TransposeTableau",
    from: "standard_tableau",
    to: "standard_tableau",
    // Column j collects entry j of every row long enough to have one.
    body: [
      "If",
      ["Equal", ["Length", "_raw"], 0],
      ["List"],
      forEach(
        ["Range", 1, ["Length", at(1)], 1],
        [
          "Map",
          ["Function", at("j", at("r")), "r"],
          [
            "Filter",
            ["Range", 1, ["Length", "_raw"], 1],
            ["Function", ["GreaterEqual", ["Length", at("r")], "j"], "r"],
          ],
        ],
        "j",
      ),
    ],
    // Rows must be nonempty and weakly shrinking: the carrier also holds the odd tableaux other families draw.
    guard: [
      "And",
      ["Equal", ["Count", ["Filter", "_raw", ["Function", ["Equal", ["Length", "r"], 0], "r"]]], 0],
      [
        "Equal",
        [
          "Count",
          [
            "Filter",
            ["Range", 1, ["Subtract", ["Length", "_raw"], 1], 1],
            ["Function", ["Less", ["Length", at("i")], ["Length", at(["Add", "i", 1])]], "i"],
          ],
        ],
        0,
      ],
    ],
    summary: "The conjugate tableau: rows and columns exchanged.",
    note: "Its shape is the conjugate of the original's, so it is TransposePartition on shapes.",
  },
  {
    name: "ToPermutation",
    from: "standard_tableau_pair",
    to: "permutation",
    body: bind(
      "pp",
      rowsOf(1),
      bind("qq", rowsOf(2), inverseRsk("pp", "qq", ["Count", ["Flatten", "pp"]]) as MathJSON, "list<list<integer>>"),
      "list<list<integer>>",
    ),
    summary: "The permutation an RSK pair comes from: inverse RSK.",
    note: "Unbumps the cell holding n in Q, then n − 1, and so on, each time reading a letter off the first row of P.",
  },
];
