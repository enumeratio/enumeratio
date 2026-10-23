// Combinatorial maps whose `from` carrier is `set_partition`, `restricted_growth_string`,
// `set_composition` or `surjection` — all set-partitions-owned carriers (step 6c).

import {
  at,
  bind,
  blocksOf,
  descending,
  forEach,
  type CombinatorialMap,
  type MathJSON,
  positions,
  reversedWord,
  rotatedLeft,
  rotatedRight,
  size,
} from "../../src/map-helpers.ts";

/** A set partition's restricted growth string, labels from `base`: position i carries the index
 *  of its block, blocks in the order they are kept. */
const growthStringOf = (blocks: MathJSON, base = 0): MathJSON => [
  "Map",
  ["Function", ["Add", base - 1, ["IndexWhere", blocks, ["Function", ["Element", "i", "b"], "b"]]], "i"],
  ["Range", 1, ["Length", ["Flatten", blocks]], 1],
];

/** The smallest later position sharing i's label in the restricted growth string, or i
 *  itself when none does — i.e. i's successor within its own block. */
const nextInBlock = (i: MathJSON): MathJSON => {
  const later: MathJSON = ["Filter", ["Range", ["Add", i, 1], size, 1], ["Function", ["Equal", at("k"), at(i)], "k"]];
  return ["If", ["Greater", ["Length", later], 0], ["Min", later], i];
};

/** `expr` with every `from` symbol renamed `to`. */
const rename = (expr: MathJSON, from: string, to: string): MathJSON =>
  expr === from ? to : Array.isArray(expr) ? (expr as readonly MathJSON[]).map((x) => rename(x, from, to)) : expr;

/** The set partition with each element v replaced by `image`(v): every block sorted again, and the blocks
 *  put back in order of their least elements. */
const relabeled = (image: MathJSON): MathJSON =>
  bind(
    "moved",
    forEach(
      ["Range", 1, ["Length", "_raw"], 1],
      ["Sort", forEach(["Range", 1, ["Length", at("i")], 1], bind("v", at("j", at("i")), image), "j")],
      "i",
    ),
    [
      "Map",
      ["Function", ["At", "moved", ["IndexWhere", "moved", ["Function", ["Equal", ["At", "b", 1], "m"], "b"]]], "m"],
      ["Sort", ["Map", ["Function", ["At", "b", 1], "b"], "moved"]],
    ],
    "list<list<integer>>",
  );

export const SET_PARTITIONS_MAPS: readonly CombinatorialMap[] = [
  {
    name: "Complement",
    from: "set_partition",
    to: "set_partition",
    // Each element i becomes n + 1 - i. A block read from its end is ascending again, and the blocks are
    // re-sorted (by least element) since the relabeling reverses their order.
    body: bind(
      "flipped",
      forEach(
        ["Range", 1, ["Length", "_raw"], 1],
        forEach(
          ["Range", 1, ["Length", at("i")], 1],
          [
            "Subtract",
            ["Add", ["Length", ["Flatten", "_raw"]], 1],
            at(["Subtract", ["Add", ["Length", at("i")], 1], "j"], at("i")),
          ],
          "j",
        ),
      ),
      [
        "Map",
        [
          "Function",
          ["At", "flipped", ["IndexWhere", "flipped", ["Function", ["Equal", ["At", "b", 1], "m"], "b"]]],
          "m",
        ],
        ["Sort", ["Map", ["Function", ["At", "b", 1], "b"], "flipped"]],
      ],
      "list<list<integer>>",
    ),
    summary: "Each element i replaced by n + 1 - i: the set partition seen from the other end.",
  },
  {
    name: "BlockSizePartition",
    from: "set_partition",
    to: "integer_partition",
    body: descending(forEach(["Range", 1, ["Length", "_raw"], 1], ["Length", at("i")])),
    summary: "The partition of n a set partition's block sizes form, largest first.",
    note: "Lossy: which elements share a block is forgotten, so it is not a constructor overload.",
  },
  {
    name: "BlockSizeComposition",
    from: "set_partition",
    to: "composition",
    body: forEach(["Range", 1, ["Length", "_raw"], 1], ["Length", at("i")]),
    summary: "The block sizes of a set partition, its blocks taken in order of their least elements.",
    note: "FindStat's Mp00128. Lossy: which elements share a block is forgotten, so it is not a constructor overload.",
  },
  {
    name: "IncreasingRotation",
    from: "set_partition",
    to: "set_partition",
    // Add 1 to every element but the largest, which becomes 1.
    body: relabeled(["Add", ["Mod", "v", ["Length", ["Flatten", "_raw"]]], 1]),
    summary: "Every element raised by one, cyclically: the largest becomes 1.",
    note: 'FindStat\'s Mp00091 ("rotate increasing"). The inverse is DecreasingRotation, and its n-th power is the identity.',
  },
  {
    name: "DecreasingRotation",
    from: "set_partition",
    to: "set_partition",
    // Subtract 1 from every element but 1, which becomes the largest.
    body: relabeled(["If", ["Greater", "v", 1], ["Subtract", "v", 1], ["Length", ["Flatten", "_raw"]]]),
    summary: "Every element lowered by one, cyclically: 1 becomes the largest.",
    note: 'FindStat\'s Mp00176 ("rotate decreasing"). The inverse is IncreasingRotation.',
  },
  {
    name: "BinaryWord",
    convert: true,
    from: "finset",
    to: "binary_word",
    // A Finset's contents are `Tuple(n, members)`.
    body: [
      "Map",
      ["Function", ["If", ["Element", "i", ["At", "_raw", 2]], 1, 0], "i"],
      ["Range", 1, ["At", "_raw", 1], 1],
    ],
    summary: "A subset of 1..n as its characteristic word: letter i is 1 when i is a member.",
    note: "Not order-preserving: Subsets lists subsets by size, then lex, while BinaryWords(n) through Finset(word) gives them in their characteristic words' order.",
  },
  {
    name: "RestrictedGrowthString",
    convert: true,
    from: "set_partition",
    to: "restricted_growth_string",
    body: growthStringOf("_raw"),
    summary: "A set partition's restricted growth string: each position labelled with its block's index, from 0.",
    note: "An order isomorphism: the k-th set partition of n, in the order SetPartitions lists them, goes to the k-th restricted growth string of length n. So everything defined on one carrier is available on the other through it.",
  },
  {
    name: "SetPartition",
    convert: true,
    from: "restricted_growth_string",
    to: "set_partition",
    body: blocksOf("_raw", 0),
    summary: "The set partition a restricted growth string labels: block j holds the positions labelled j.",
    note: "The inverse of RestrictedGrowthString(partition), and order-preserving in the same way.",
  },
  {
    name: "Surjection",
    convert: true,
    from: "set_composition",
    to: "surjection",
    body: growthStringOf("_raw", 1),
    summary: "A set composition as a surjection: each position labelled with its block's index, from 1.",
  },
  {
    name: "SetComposition",
    convert: true,
    from: "surjection",
    to: "set_composition",
    body: blocksOf("_raw", 1),
    summary: "The set composition a surjection labels: block j holds the positions labelled j.",
  },
  {
    name: "ArcRepresentation",
    from: "set_partition",
    to: "endofunction",
    // Read through the restricted growth string: position i's block label. A block's members
    // are in ascending order by position, so "the next element in i's block" is just the
    // smallest later position sharing i's label — a function on 1..n, which is exactly what
    // an endofunction IS. The arcs of the standard representation are the pairs (i, f(i)) with
    // f(i) != i; a position last in its block is a fixed point.
    body: bind(
      "aw",
      growthStringOf("_raw"),
      rename(forEach(positions, nextInBlock("i")), "_raw", "aw"),
      "list<integer>",
    ),
    summary: "Each position linked to the next in its block, or to itself when last.",
    note: "The statistics frontier calls this the arc representation: within each block, consecutive elements (b1,b2), (b2,b3), .... Encoding it as an endofunction rather than a bare list of pairs keeps it a typed carrier — Crossings, Nestings and CrossingNestingTotal (@enumeratio/statistics) read the arcs off this without needing a carrier of their own.",
  },
  {
    name: "Reverse",
    from: "set_composition",
    to: "set_composition",
    body: reversedWord,
    summary: "The blocks in the opposite order.",
    note: "FindStat's Mp00288.",
  },
  {
    name: "Complement",
    from: "set_composition",
    to: "set_composition",
    body: bind(
      "elements",
      ["Length", ["Flatten", "_raw"]],
      forEach(
        positions,
        [
          "Sort",
          forEach(["Range", 1, ["Length", at("i")], 1], ["Subtract", ["Add", "elements", 1], at("j", at("i"))], "j"),
        ],
        "i",
      ),
      "integer",
    ),
    summary: "Each element i replaced by n + 1 - i, the blocks staying in their order.",
    note: "FindStat's Mp00289.",
  },
  {
    name: "CyclicShift",
    from: "set_composition",
    to: "set_composition",
    body: rotatedLeft,
    summary: "The first block moved to the end.",
    note: "FindStat's Mp00292.",
  },
  {
    name: "InverseCyclicShift",
    from: "set_composition",
    to: "set_composition",
    body: rotatedRight,
    summary: "The last block moved to the front.",
    note: "FindStat's Mp00291.",
  },
];
