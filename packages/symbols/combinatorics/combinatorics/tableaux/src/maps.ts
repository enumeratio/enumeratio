// Combinatorial maps whose `from` carrier is a tableaux carrier (conventions as in
// `permutations/src/maps.ts`).

import { at, bind, forEach, type CombinatorialMap, type MathJSON } from "../../src/map-helpers.ts";
import { inverseRsk } from "./families/rsk-pairs.ts";
import { evacuationRows, inversePromotionRows, promotionRows } from "./promotion.ts";
import { afterInserting } from "./tableau.ts";

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

const upTo = (count: MathJSON): MathJSON => ["Range", 1, count, 1];
const entryOf = (list: MathJSON, index: MathJSON): MathJSON => ["At", list, index];
/** The position of v in `list`. */
const positionOf = (list: MathJSON, v: MathJSON): MathJSON => [
  "IndexWhere",
  list,
  ["Function", ["Equal", "z", v], "z"],
];
/** `list` with the entries at positions a and b exchanged. */
const exchanged = (list: MathJSON, a: MathJSON, b: MathJSON): MathJSON =>
  forEach(
    upTo(["Length", list]),
    ["If", ["Equal", "q", a], entryOf(list, b), ["If", ["Equal", "q", b], entryOf(list, a), entryOf(list, "q")]],
    "q",
  );

/** Two lists of `cells` entries end to end, as a fresh list: a `Join` of lazy lists stays lazy, and an accumulator must not. */
const appended = (first: MathJSON, second: MathJSON): MathJSON =>
  forEach(
    upTo(["Multiply", 2, cells]),
    ["If", ["LessEqual", "j", cells], entryOf(first, "j"), entryOf(second, ["Subtract", "j", cells])],
    "j",
  );

/** Whether the two lists have the same descent positions. */
const sameDescents = (first: MathJSON, second: MathJSON): MathJSON => [
  "Equal",
  [
    "Count",
    [
      "Filter",
      upTo(["Subtract", cells, 1]),
      [
        "Function",
        [
          "Not",
          [
            "Equal",
            ["If", ["Greater", entryOf(first, "e"), entryOf(first, ["Add", "e", 1])], 1, 0],
            ["If", ["Greater", entryOf(second, "e"), entryOf(second, ["Add", "e", 1])], 1, 0],
          ],
        ],
        "e",
      ],
    ],
  ],
  0,
];

/** One t-action. The state is the labelling P then the tableau T, each by cell in reading order. P goes to P with its
 *  first column descent d exchanged with d + 1; T has the two cells' entries exchanged unless that leaves the descents
 *  of the linear extension unchanged. */
const tableauAction: MathJSON = bind(
  "ra_p",
  forEach(upTo(cells), entryOf("ra_acc", "q"), "q"),
  bind(
    "ra_t",
    forEach(upTo(cells), entryOf("ra_acc", ["Add", "q", cells]), "q"),
    bind(
      "ra_d",
      [
        "Min",
        [
          "Join",
          [
            "Filter",
            upTo(["Subtract", cells, 1]),
            [
              "Function",
              [
                "Less",
                entryOf("ra_col", positionOf("ra_p", ["Add", "d", 1])),
                entryOf("ra_col", positionOf("ra_p", "d")),
              ],
              "d",
            ],
          ],
          ["List", cells],
        ],
      ],
      [
        "If",
        ["Equal", "ra_d", cells],
        "ra_acc",
        bind(
          "ra_a",
          positionOf("ra_p", "ra_d"),
          bind(
            "ra_b",
            positionOf("ra_p", ["Add", "ra_d", 1]),
            bind(
              "ra_q",
              exchanged("ra_p", "ra_a", "ra_b"),
              bind(
                "ra_s",
                [
                  "If",
                  sameDescents(
                    forEach(upTo(cells), entryOf("ra_p", positionOf("ra_t", "e")), "e"),
                    forEach(upTo(cells), entryOf("ra_q", positionOf("ra_t", "e")), "e"),
                  ),
                  "ra_t",
                  exchanged("ra_t", "ra_a", "ra_b"),
                ],
                appended("ra_q", "ra_s"),
                "list<integer>",
              ),
              "list<integer>",
            ),
            "integer",
          ),
          "integer",
        ),
      ],
      "integer",
    ),
    "list<integer>",
  ),
  "list<integer>",
);

/** Start from the natural labelling P = 1, 2, … and act by t_d at its first column descent d until it has none, carrying
 *  the tableau along. P's column descents depend on P alone, and n² steps are more than it needs. */
const rowDescentsToColumnDescents: MathJSON = [
  "If",
  ["Less", cells, 2],
  "_raw",
  bind(
    "ra_col",
    ["Flatten", forEach(upTo(["Length", "_raw"]), forEach(upTo(["Length", at("r")]), "c", "c"), "r")],
    bind(
      "ra_row",
      ["Flatten", forEach(upTo(["Length", "_raw"]), forEach(upTo(["Length", at("r")]), "r", "c"), "r")],
      bind(
        "ra_end",
        [
          "Fold",
          ["Function", tableauAction, "ra_acc", "ra_step"],
          appended(upTo(cells), ["Flatten", "_raw"]),
          upTo(["Multiply", cells, cells]),
        ],
        forEach(
          upTo(["Length", "_raw"]),
          forEach(
            ["Filter", upTo(cells), ["Function", ["Equal", entryOf("ra_row", "c"), "r"], "c"]],
            entryOf("ra_end", ["Add", "c", cells]),
            "c",
          ),
          "r",
        ),
        "list<integer>",
      ),
      "list<integer>",
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
  {
    name: "Evacuation",
    from: "standard_tableau",
    to: "standard_tableau",
    body: bind("ev_t", "_raw", evacuationRows("ev_t"), "list<list<integer>>"),
    guard: tableauGuard,
    summary:
      "Schützenberger's evacuation (involution): remove the entry 1, slide the rest in, and give the cell that empties the largest label, until nothing is left.",
    note: "FindStat's Mp00085. Computed as the insertion tableau of the reading word reversed and complemented; the same shape, and an involution.",
  },
  {
    name: "TableauPromotion",
    from: "standard_tableau",
    to: "standard_tableau",
    body: bind("pm_t", "_raw", promotionRows("pm_t"), "list<list<integer>>"),
    guard: tableauGuard,
    summary:
      "Promotion: replace the largest entry by a hole, slide it to the corner at the origin, and add one to every entry.",
    note: "FindStat's Mp00155, the inverse of InverseTableauPromotion. The hole is walked through the rows entry by entry, as jeu de taquin does.",
  },
  {
    name: "InverseTableauPromotion",
    from: "standard_tableau",
    to: "standard_tableau",
    body: bind("pm_t", "_raw", inversePromotionRows("pm_t"), "list<list<integer>>"),
    guard: tableauGuard,
    summary:
      "Inverse promotion: replace the entry 1 by n + 1, slide it out to the rim, and subtract one from every entry.",
    note: "FindStat's Mp00153, the inverse of TableauPromotion. The hole is walked through the rows entry by entry, as jeu de taquin does.",
  },
  {
    name: "Catabolism",
    from: "standard_tableau",
    to: "standard_tableau",
    // Column-inserting the removed row's entries, largest first, into what is left is row-inserting the row followed by
    // the reading word of what is left (a letter put in front of a word's tableau is column-inserted into it).
    body: [
      "If",
      ["Equal", cells, 0],
      ["List"],
      bind(
        "cb_word",
        [
          "Flatten",
          forEach(
            ["Range", 1, ["Length", "_raw"], 1],
            at(["If", ["Equal", "r", 1], 1, ["Subtract", ["Add", ["Length", "_raw"], 2], "r"]]),
            "r",
          ),
        ],
        ["Fold", ["Function", afterInserting("a", "b"), "a", "b"], ["List"], "cb_word"],
        "list<integer>",
      ),
    ],
    guard: tableauGuard,
    summary: "Remove the first row and column-insert its entries back into the rest, largest first.",
    note: "FindStat's Mp00106. Not injective: a row and a column of the same size both give the row.",
  },
  {
    name: "RowDescentsToColumnDescents",
    from: "standard_tableau",
    to: "standard_tableau",
    body: rowDescentsToColumnDescents,
    guard: tableauGuard,
    summary: "A standard tableau of the same shape whose column descents are the original's row descents.",
    note: "FindStat's Mp00226, a bijection. From the natural labelling of the shape, d and d + 1 are exchanged at each column descent d, the tableau following by the same exchange unless that keeps its descents.",
  },
  {
    name: "RowSetPartition",
    from: "standard_tableau",
    to: "set_partition",
    body: "_raw",
    guard: tableauGuard,
    summary: "The set partition whose blocks are the rows of the tableau.",
    note: "FindStat's Mp00284. Injective on the tableaux of a given shape; the shape is the sequence of block sizes.",
  },
];
