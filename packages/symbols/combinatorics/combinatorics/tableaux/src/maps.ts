// Combinatorial maps whose `from` carrier is a tableaux carrier (conventions as in
// `permutations/src/maps.ts`).

import { at, bind, forEach, type CombinatorialMap, type MathJSON } from "../../src/map-helpers.ts";
import { inverseRsk } from "./families/rsk-pairs.ts";

/** The rows of one tableau of the pair: a pair's contents are two `StandardTableau(rows)`, and
 *  `At` doesn't see through the constructor, but a lambda argument does. */
const rowsOf = (side: number): MathJSON => ["Apply", ["Function", ["At", "tb", 1], "tb"], ["At", "_raw", side]];

/** Rows must be nonempty and weakly shrinking: the carrier also holds the odd tableaux other families draw. */
const tableauGuard: MathJSON = [
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
];

/** The number of entries. */
const cells: MathJSON = ["Length", ["Flatten", "_raw"]];

/** The row holding entry v. */
const rowOfEntry = (v: MathJSON): MathJSON => [
  "IndexWhere",
  "_raw",
  // `Element` errors on the empty row the odd tableaux carry, so an empty row holds nothing by definition.
  ["Function", ["If", ["Equal", ["Length", "r"], 0], "False", ["Element", v, "r"]], "r"],
];

/** Whether entry i is a descent: i + 1 sits in a lower row. */
const descentAt = (i: MathJSON): MathJSON => ["Greater", rowOfEntry(["Add", i, 1]), rowOfEntry(i)];

/** The composition of n whose cut set is the entries i in 2 .. n - 1 satisfying `cut` (a predicate of i). */
const compositionCutWhere = (cut: MathJSON): MathJSON => [
  "If",
  ["Equal", cells, 0],
  ["List"],
  bind(
    "bounds",
    [
      "Join",
      ["List", 0],
      [
        "Fold",
        ["Function", ["If", cut, ["Join", "acc", ["List", "i"]], "acc"], "acc", "i"],
        ["List"],
        ["Range", 2, ["Subtract", cells, 1], 1],
      ],
      ["List", cells],
    ],
    forEach(
      ["Range", 1, ["Subtract", ["Length", "bounds"], 1], 1],
      ["Subtract", at(["Add", "q", 1], "bounds"), at("q", "bounds")],
      "q",
    ),
    "list<integer>",
  ),
];

export const TABLEAUX_MAPS: readonly CombinatorialMap[] = [
  {
    name: "TableauShape",
    from: "standard_tableau",
    to: "integer_partition",
    body: forEach(["Range", 1, ["Length", "_raw"], 1], ["Length", at("i")]),
    summary: "The shape of a standard tableau: its row lengths.",
    note: "Lossy: the entries are forgotten, so it is not a constructor overload.",
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
    guard: tableauGuard,
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
  {
    name: "TableauDescentWord",
    from: "standard_tableau",
    to: "binary_word",
    body: forEach(["Range", 1, ["Subtract", cells, 1], 1], ["If", descentAt("i"), 1, 0]),
    guard: tableauGuard,
    summary: "Letter i is 1 when entry i + 1 sits in a lower row than entry i.",
    note: "FindStat's Mp00134. The word is one letter shorter than the tableau has entries.",
  },
  {
    name: "ReadingWord",
    from: "standard_tableau",
    to: "permutation",
    body: [
      "Flatten",
      forEach(["Range", 1, ["Length", "_raw"], 1], at(["Subtract", ["Add", ["Length", "_raw"], 1], "i"])),
    ],
    guard: tableauGuard,
    summary: "The rows read left to right, from the bottom row up, as a permutation.",
    note: "FindStat's Mp00081, the row reading word. Injective; RskInsertion of it is the tableau back again.",
  },
  {
    name: "PeakComposition",
    from: "standard_tableau",
    to: "composition",
    body: compositionCutWhere(["And", descentAt("i"), ["Not", descentAt(["Subtract", "i", 1])]]),
    guard: tableauGuard,
    summary: "The composition cut at the peaks: entries i that are descents after an ascent.",
    note: "FindStat's Mp00294. An entry is a descent when the next one sits in a lower row.",
  },
  {
    name: "ValleyComposition",
    from: "standard_tableau",
    to: "composition",
    body: compositionCutWhere(["And", descentAt(["Subtract", "i", 1]), ["Not", descentAt("i")]]),
    guard: tableauGuard,
    summary: "The composition cut at the valleys: entries i that are ascents after a descent.",
    note: "FindStat's Mp00295.",
  },
];
