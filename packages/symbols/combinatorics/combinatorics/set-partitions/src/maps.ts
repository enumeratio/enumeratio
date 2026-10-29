// Combinatorial maps whose `from` carrier is `set_partition`, `restricted_growth_string`,
// `set_composition` or `surjection` — all set-partitions-owned carriers (step 6c).

import {
  at,
  bind,
  blocksOf,
  descending,
  forEach,
  lets,
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

const upTo = (k: MathJSON): MathJSON => ["Range", 1, k, 1];
const elements: MathJSON = ["Length", ["Flatten", "_raw"]];

/** The block of the set partition `_raw` that holds the element e. */
const blockOf = (e: MathJSON): MathJSON => [
  "At",
  "_raw",
  ["IndexWhere", "_raw", ["Function", ["Element", e, "b"], "b"]],
];

/** The next larger element in e's block, 0 for the largest. */
const successorInBlock = (e: MathJSON): MathJSON =>
  bind(
    "sb_block",
    blockOf(e),
    [
      "If",
      ["Greater", ["Count", ["Filter", "sb_block", ["Function", ["Greater", "y", e], "y"]]], 0],
      ["Min", ["Filter", "sb_block", ["Function", ["Greater", "y", e], "y"]]],
      0,
    ],
    "list<integer>",
  );

/** Mp00171: the number of crossings of the arc (or half-arc) ending at each element, the arcs joining consecutive
 *  block elements, the half-arcs coming from the closers (block maxima) to infinity. */
const intertwiningWord: MathJSON = lets(
  [
    ["iw_next", forEach(upTo(elements), successorInBlock("e"), "e"), "list<integer>"],
    [
      // The arcs (k, next k), over those k with a next.
      "iw_arcs",
      ["Filter", upTo(elements), ["Function", ["Greater", at("k", "iw_next"), 0], "k"]],
      "list<integer>",
    ],
  ],
  forEach(upTo(elements), [
    "If",
    // An opener: nothing before it in its block.
    [
      "Equal",
      ["Count", ["Filter", upTo(["Subtract", "i", 1]), ["Function", ["Equal", at("k", "iw_next"), "i"], "k"]]],
      0,
    ],
    [
      "Add",
      [
        "Count",
        ["Filter", "iw_arcs", ["Function", ["And", ["Less", "k", "i"], ["Less", "i", at("k", "iw_next")]], "k"]],
      ],
      [
        "Count",
        ["Filter", upTo(elements), ["Function", ["And", ["Equal", at("k", "iw_next"), 0], ["Less", "k", "i"]], "k"]],
      ],
    ],
    lets(
      [
        [
          "iw_from",
          ["Max", ["Filter", upTo(["Subtract", "i", 1]), ["Function", ["Equal", at("k", "iw_next"), "i"], "k"]]],
          "integer",
        ],
      ],
      [
        "Add",
        [
          "Count",
          [
            "Filter",
            "iw_arcs",
            ["Function", ["And", ["Less", "iw_from", "k"], ["Less", "k", "i"], ["Less", "i", at("k", "iw_next")]], "k"],
          ],
        ],
        [
          "Count",
          [
            "Filter",
            upTo(elements),
            ["Function", ["And", ["Equal", at("k", "iw_next"), 0], ["Less", "iw_from", "k"], ["Less", "k", "i"]], "k"],
          ],
        ],
      ],
    ),
  ]),
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
  {
    name: "BlockSizeComposition",
    from: "set_composition",
    to: "composition",
    body: forEach(["Range", 1, ["Length", "_raw"], 1], ["Length", at("i")]),
    summary: "The block sizes of a set composition, its blocks taken in order.",
    note: "FindStat's Mp00287. Lossy: which elements share a block is forgotten.",
  },
  {
    name: "UnderlyingSetPartition",
    from: "set_composition",
    to: "set_partition",
    body: relabeled("v"),
    summary: "The set partition with the same blocks, the order of the blocks forgotten.",
    note: "FindStat's Mp00285. Lossy: each set partition has as many orderings as it has blocks, factorially.",
  },
  {
    name: "BlockConcatenation",
    from: "set_composition",
    to: "permutation",
    body: ["Flatten", forEach(["Range", 1, ["Length", "_raw"], 1], ["Sort", at("i")])],
    summary: "The permutation that lists the blocks in order, each sorted increasingly.",
    note: "FindStat's Mp00286. Lossy: where one block ends and the next starts is forgotten.",
  },
  {
    name: "IncreasingCyclePermutation",
    from: "set_partition",
    to: "permutation",
    body: forEach(upTo(elements), [
      "Apply",
      [
        "Function",
        [
          "If",
          ["Greater", ["Length", ["Filter", "blk", ["Function", ["Greater", "y", "i"], "y"]]], 0],
          ["Min", ["Filter", "blk", ["Function", ["Greater", "y", "i"], "y"]]],
          ["Min", "blk"],
        ],
        ["Typed", "blk", "'list<integer>'"],
      ],
      blockOf("i"),
    ]),
    summary:
      "The permutation whose cycles are the blocks, each cycle increasing: every element goes to the next larger in its block, the largest to the least.",
    note: "FindStat's Mp00080, Sage's to_permutation. Injective; it maximizes the exceedances among the permutations with these cycles.",
  },
  {
    name: "AssociatedStandardTableau",
    from: "set_partition",
    to: "standard_tableau",
    // Column j holds the j-th smallest elements of the blocks that have one, sorted; the rows read across.
    body: [
      "If",
      ["Equal", ["Length", "_raw"], 0],
      ["List"],
      lets(
        [
          ["at_width", ["Max", forEach(upTo(["Length", "_raw"]), ["Length", at("i")])], "integer"],
          [
            "at_columns",
            forEach(
              upTo("at_width"),
              [
                "Sort",
                [
                  "Map",
                  ["Function", ["At", ["Sort", "b"], "j"], "b"],
                  ["Filter", "_raw", ["Function", ["GreaterEqual", ["Length", "b"], "j"], "b"]],
                ],
              ],
              "j",
            ),
            "list<list<integer>>",
          ],
        ],
        forEach(
          upTo(["Length", at(1, "at_columns")]),
          [
            "Map",
            ["Function", ["At", ["At", "at_columns", "j"], "r"], "j"],
            [
              "Filter",
              upTo("at_width"),
              ["Function", ["GreaterEqual", ["Length", ["At", "at_columns", "j"]], "r"], "j"],
            ],
          ],
          "r",
        ),
      ),
    ],
    summary:
      "The standard tableau whose j-th column holds the j-th smallest elements of the blocks, in increasing order.",
    note: "FindStat's Mp00258. Not injective.",
  },
  {
    name: "IntertwiningToDualMajorIndex",
    from: "set_partition",
    to: "set_partition",
    body: bind("iw", intertwiningWord, blocksOf("iw", 0), "list<integer>"),
    summary:
      "The set partition whose growth word is the intertwining word: a bijection taking the intertwining number to the dual major index.",
    note: "FindStat's Mp00171, the inverse of DualMajorIndexToIntertwining. Entry i of the intertwining word counts the arcs crossing the one that ends at i.",
  },
  {
    name: "DualMajorIndexToIntertwining",
    from: "set_partition",
    to: "set_partition",
    // The growth word read as an intertwining word. An entry one above all earlier ones opens a block; any other
    // entry w joins the block of the w-th most recent closer (an element not yet followed in its block), which stops being one.
    body: [
      "If",
      ["Equal", ["Length", "_raw"], 0],
      ["List"],
      lets(
        [["dm_word", growthStringOf("_raw", 0), "list<integer>"]],
        bind(
          "dm_state",
          [
            "Fold",
            [
              "Function",
              lets(
                [
                  ["dm_labels", ["At", "acc", 1], "list<integer>"],
                  ["dm_closers", ["At", "acc", 2], "list<integer>"],
                  ["dm_top", ["At", "acc", 3], "integer"],
                  ["dm_w", at("e", "dm_word"), "integer"],
                  // 0 when the entry opens a block (no closer is removed), else the closer it joins.
                  [
                    "dm_l",
                    ["If", ["Equal", "dm_w", ["Add", "dm_top", 1]], 0, at(["Add", "dm_w", 1], "dm_closers")],
                    "integer",
                  ],
                ],
                [
                  "Tuple",
                  [
                    "Join",
                    "dm_labels",
                    [
                      "List",
                      ["If", ["Equal", "dm_w", ["Add", "dm_top", 1]], ["Add", "dm_top", 1], at("dm_l", "dm_labels")],
                    ],
                  ],
                  ["Join", ["List", "e"], ["Filter", "dm_closers", ["Function", ["Not", ["Equal", "x", "dm_l"]], "x"]]],
                  ["If", ["Equal", "dm_w", ["Add", "dm_top", 1]], ["Add", "dm_top", 1], "dm_top"],
                ],
              ),
              "acc",
              "e",
            ],
            ["Tuple", ["List", 0], ["List", 1], 0],
            ["Range", 2, elements, 1],
          ],
          lets([["dm_final", ["At", "dm_state", 1], "list<integer>"]], blocksOf("dm_final", 0)),
        ),
      ),
    ],
    summary:
      "The inverse of IntertwiningToDualMajorIndex: read the growth word as an intertwining word and rebuild the blocks.",
    note: "FindStat's Mp00174.",
  },
];
