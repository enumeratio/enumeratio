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

// --- the rook-placement bijections of Wachs-White and Yip, read off the set partition's arcs ---
// Each element e has a predecessor rk_prv[e] and successor rk_nxt[e] in its block (0 when none); the arcs are the
// pairs (rk_prv[e], e). Sage's sequential rook placements are written as counts over these.

const elementRange: MathJSON = upTo(elements);

const rookLists = (body: MathJSON): MathJSON =>
  lets(
    [
      ["rk_gw", growthStringOf("_raw", 0), "list<integer>"],
      [
        "rk_prv",
        forEach(
          elementRange,
          bind(
            "rk_before",
            [
              "Filter",
              elementRange,
              ["Function", ["And", ["Less", "k", "e"], ["Equal", at("k", "rk_gw"), at("e", "rk_gw")]], "k"],
            ],
            ["If", ["Greater", ["Count", "rk_before"], 0], ["Max", "rk_before"], 0],
            "list<integer>",
          ),
          "e",
        ),
        "list<integer>",
      ],
      [
        "rk_nxt",
        forEach(
          elementRange,
          bind(
            "rk_after",
            [
              "Filter",
              elementRange,
              ["Function", ["And", ["Greater", "k", "e"], ["Equal", at("k", "rk_gw"), at("e", "rk_gw")]], "k"],
            ],
            ["If", ["Greater", ["Count", "rk_after"], 0], ["Min", "rk_after"], 0],
            "list<integer>",
          ),
          "e",
        ),
        "list<integer>",
      ],
    ],
    body,
  );

/** No elements: the empty partition; one: itself; else `body`, which may fold over Range(2, n). */
const fromTwoElements = (body: MathJSON): MathJSON => ["If", ["LessEqual", elements, 1], "_raw", rookLists(body)];

/** The blocks of a list that labels each element with the least element of its block. */
export const blocksOfLeastLabels = (labels: MathJSON): MathJSON =>
  bind(
    "ll",
    labels,
    [
      "Map",
      ["Function", ["Filter", elementRange, ["Function", ["Equal", at("p", "ll"), "m"], "p"]], "m"],
      ["Filter", elementRange, ["Function", ["Equal", at("m", "ll"), "m"], "m"]],
    ],
    "list<integer>",
  );

/** How many of the elements below j have the least element x, for a partition labelled by `iy_least`. */
const iySizeBefore = (x: MathJSON, j: MathJSON): MathJSON => [
  "Count",
  ["Filter", ["Range", 1, ["Subtract", j, 1], 1], ["Function", ["Equal", at("t", "iy_least"), x], "t"]],
];

/** The least-element labels of the partition whose element y joins element `pred`(y) (0 for none) below it. */
const chainLabels = (pred: (y: MathJSON) => MathJSON): MathJSON => [
  "Fold",
  [
    "Function",
    bind(
      "cl_pred",
      pred("y"),
      ["Join", "acc", ["List", ["If", ["Greater", "cl_pred", 0], at("cl_pred", "acc"), "y"]]],
      "integer",
    ),
    "acc",
    "y",
  ],
  ["List", 1],
  ["Range", 2, elements, 1],
];

export const SET_PARTITIONS_MAPS: readonly CombinatorialMap[] = [
  {
    name: "Complement",
    from: "set_partition",
    to: "set_partition",
    // Each element v becomes n + 1 - v; the relabeling reverses the blocks' order, so they are re-sorted.
    body: relabeled(["Subtract", ["Add", ["Length", ["Flatten", "_raw"]], 1], "v"]),
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
  {
    name: "WachsWhite",
    from: "set_partition",
    to: "set_partition",
    // Wachs and White's gamma on the rook placement of the arcs: the growth word's entry at e counts the cells left in
    // column e - 1 once every rook has struck the cells north of it and east of it.
    body: [
      "If",
      ["Equal", elements, 0],
      ["List"],
      rookLists(
        bind(
          "ww_word",
          forEach(
            elementRange,
            [
              "If",
              ["Equal", "e", 1],
              0,
              bind(
                "ww_left",
                ["Add", ["Subtract", elements, "e"], 1],
                [
                  "Subtract",
                  ["Subtract", "e", 1],
                  [
                    "Count",
                    [
                      "Filter",
                      ["Range", ["Add", "ww_left", 1], elements, 1],
                      [
                        "Function",
                        [
                          "Or",
                          ["Greater", at("x", "rk_prv"), "ww_left"],
                          ["GreaterEqual", at("ww_left", "rk_nxt"), "x"],
                        ],
                        "x",
                      ],
                    ],
                  ],
                ],
                "integer",
              ),
            ],
            "e",
          ),
          blocksOf("ww_word", 0),
          "list<integer>",
        ),
      ),
    ],
    summary:
      "The set partition whose arcs, read as a rook placement, Wachs and White's bijection gamma carries to a set partition.",
    note: "FindStat's Mp00215. The inverse of InverseWachsWhite.",
  },
  {
    name: "InverseWachsWhite",
    from: "set_partition",
    to: "set_partition",
    // Each element e that is not a block minimum puts a rook in the free row ranked by its block's index; the rook joins
    // n + 1 - e with n minus that row.
    body: fromTwoElements(
      bind(
        "iw_rows",
        [
          "Fold",
          [
            "Function",
            [
              "Join",
              "acc",
              [
                "List",
                [
                  "If",
                  ["Equal", at("e", "rk_prv"), 0],
                  -1,
                  [
                    "At",
                    ["Filter", ["Range", 0, elements, 1], ["Function", ["Not", ["Element", "x", "acc"]], "x"]],
                    ["Add", at("e", "rk_gw"), 1],
                  ],
                ],
              ],
            ],
            "acc",
            "e",
          ],
          ["List", -1],
          ["Range", 2, elements, 1],
        ],
        blocksOfLeastLabels(
          chainLabels((y) =>
            bind(
              "iw_hit",
              ["Filter", elementRange, ["Function", ["Equal", at("q", "iw_rows"), ["Subtract", elements, y]], "q"]],
              ["If", ["Greater", ["Count", "iw_hit"], 0], ["Subtract", ["Add", elements, 1], ["Min", "iw_hit"]], 0],
              "list<integer>",
            ),
          ),
        ),
        "list<integer>",
      ),
    ),
    summary:
      "The set partition joined by the arcs of the rook placement that Wachs and White's bijection gamma assigns to the set partition.",
    note: "FindStat's Mp00216, the inverse of WachsWhite.",
  },
  {
    name: "WachsWhiteRho",
    from: "set_partition",
    to: "set_partition",
    // Wachs and White's rho: the arcs' rooks leave rs[x] cells in row x; element x joins the rs[x]-th block, in order,
    // that has not yet taken its closer.
    body: fromTwoElements(
      lets(
        [
          ["wr_closers", ["Filter", elementRange, ["Function", ["Equal", at("e", "rk_nxt"), 0], "e"]], "list<integer>"],
          [
            "wr_rs",
            forEach(
              elementRange,
              [
                "Count",
                [
                  "Filter",
                  elementRange,
                  [
                    "Function",
                    [
                      "And",
                      ["Less", "a", "x"],
                      ["Greater", at("a", "rk_nxt"), "x"],
                      ["Greater", "a", at("x", "rk_prv")],
                    ],
                    "a",
                  ],
                ],
              ],
              "x",
            ),
            "list<integer>",
          ],
          [
            "wr_labels",
            [
              "Fold",
              [
                "Function",
                [
                  "Join",
                  "acc",
                  [
                    "List",
                    [
                      "At",
                      [
                        "Filter",
                        ["Range", 1, ["Count", "wr_closers"], 1],
                        // A block is taken once its latest element so far is a closer.
                        [
                          "Function",
                          [
                            "Equal",
                            [
                              "Count",
                              [
                                "Filter",
                                ["Range", 1, ["Subtract", "e", 1], 1],
                                [
                                  "Function",
                                  ["And", ["Element", "k", "wr_closers"], ["Equal", at("k", "acc"), "b"]],
                                  "k",
                                ],
                              ],
                            ],
                            0,
                          ],
                          "b",
                        ],
                      ],
                      ["Add", at("e", "wr_rs"), 1],
                    ],
                  ],
                ],
                "acc",
                "e",
              ],
              ["List", 1],
              ["Range", 2, elements, 1],
            ],
          ],
        ],
        [
          "Map",
          ["Function", ["Filter", elementRange, ["Function", ["Equal", at("p", "wr_labels"), "j"], "p"]], "j"],
          ["Range", 1, ["Count", "wr_closers"], 1],
        ],
      ),
    ),
    summary:
      "The set partition whose arcs, read as a rook placement, Wachs and White's bijection rho carries to a set partition.",
    note: "FindStat's Mp00217. The inverse of InverseWachsWhiteRho.",
  },
  {
    name: "InverseWachsWhiteRho",
    from: "set_partition",
    to: "set_partition",
    // Down the rows, row y puts its rook in the rs-th free column to its right (the closers' columns taken); the rook
    // joins n + 1 - column with y.
    body: fromTwoElements(
      bind(
        "iwr_columns",
        [
          "At",
          [
            "Fold",
            [
              "Function",
              lets(
                [
                  [
                    "iwr_rs",
                    [
                      "Count",
                      [
                        "Filter",
                        elementRange,
                        [
                          "Function",
                          [
                            "And",
                            ["Equal", at("c", "rk_nxt"), 0],
                            ["Greater", "c", "y"],
                            ["Less", at("c", "rk_gw"), at("y", "rk_gw")],
                          ],
                          "c",
                        ],
                      ],
                    ],
                    "integer",
                  ],
                  [
                    "iwr_free",
                    [
                      "Filter",
                      ["Range", ["Add", ["Subtract", elements, "y"], 2], elements, 1],
                      ["Function", ["Not", ["Element", "j", ["At", "acc", 1]]], "j"],
                    ],
                    "list<integer>",
                  ],
                ],
                [
                  "If",
                  ["Less", "iwr_rs", ["Length", "iwr_free"]],
                  [
                    "Tuple",
                    ["Join", ["At", "acc", 1], ["List", at(["Add", "iwr_rs", 1], "iwr_free")]],
                    ["Join", ["At", "acc", 2], ["List", at(["Add", "iwr_rs", 1], "iwr_free")]],
                  ],
                  ["Tuple", ["At", "acc", 1], ["Join", ["At", "acc", 2], ["List", 0]]],
                ],
              ),
              "acc",
              "y",
            ],
            [
              "Tuple",
              [
                "Map",
                ["Function", ["Subtract", ["Add", elements, 1], "e"], "e"],
                ["Filter", elementRange, ["Function", ["Equal", at("e", "rk_nxt"), 0], "e"]],
              ],
              ["List", 0],
            ],
            ["Range", 2, elements, 1],
          ],
          2,
        ],
        blocksOfLeastLabels(
          chainLabels((y) => [
            "If",
            ["Greater", at(y, "iwr_columns"), 0],
            ["Subtract", ["Add", elements, 1], at(y, "iwr_columns")],
            0,
          ]),
        ),
        "list<integer>",
      ),
    ),
    summary:
      "The set partition joined by the arcs of the rook placement that Wachs and White's bijection rho assigns to the set partition.",
    note: "FindStat's Mp00218, the inverse of WachsWhiteRho.",
  },
  {
    name: "Yip",
    from: "set_partition",
    to: "set_partition",
    // Yip's psi: element e joins the block of rank e - r - c among the blocks so far, ordered by size (largest first)
    // then least element, where r is e's predecessor and c counts the earlier elements whose predecessor is above r.
    // One rank past the last block opens a new block.
    body: fromTwoElements(
      blocksOfLeastLabels([
        "Fold",
        [
          "Function",
          lets(
            [
              [
                "yp_rank",
                [
                  "Subtract",
                  ["Subtract", "e", at("e", "rk_prv")],
                  [
                    "Count",
                    [
                      "Filter",
                      ["Range", 1, ["Subtract", "e", 1], 1],
                      ["Function", ["Greater", at("j", "rk_prv"), at("e", "rk_prv")], "j"],
                    ],
                  ],
                ],
                "integer",
              ],
              [
                // One key per block, sorting by size then least element; the least element is the key's remainder.
                "yp_keys",
                [
                  "Sort",
                  [
                    "Map",
                    [
                      "Function",
                      [
                        "Add",
                        [
                          "Multiply",
                          [
                            "Subtract",
                            elements,
                            [
                              "Count",
                              [
                                "Filter",
                                ["Range", 1, ["Subtract", "e", 1], 1],
                                ["Function", ["Equal", at("k", "acc"), "m"], "k"],
                              ],
                            ],
                          ],
                          ["Add", elements, 1],
                        ],
                        "m",
                      ],
                      "m",
                    ],
                    [
                      "Filter",
                      ["Range", 1, ["Subtract", "e", 1], 1],
                      ["Function", ["Equal", at("m", "acc"), "m"], "m"],
                    ],
                  ],
                ],
                "list<integer>",
              ],
            ],
            [
              "Join",
              "acc",
              [
                "List",
                [
                  "If",
                  ["Greater", "yp_rank", ["Length", "yp_keys"]],
                  "e",
                  ["Mod", at("yp_rank", "yp_keys"), ["Add", elements, 1]],
                ],
              ],
            ],
          ),
          "acc",
          "e",
        ],
        ["List", 1],
        ["Range", 2, elements, 1],
      ]),
    ),
    summary: "The set partition whose arcs, read as a rook placement, Yip's bijection psi carries to a set partition.",
    note: "FindStat's Mp00220. The inverse of InverseYip.",
  },
  {
    name: "InverseYip",
    from: "set_partition",
    to: "set_partition",
    // Taking the elements off from the largest, the rank of the block an element leaves is the degree of its column; the
    // rooks are then placed up the columns, each in the lowest row that degree allows, and their ends joined.
    body: fromTwoElements(
      lets(
        [
          [
            "iy_least",
            forEach(
              elementRange,
              ["Min", ["Filter", elementRange, ["Function", ["Equal", at("k", "rk_gw"), at("e", "rk_gw")], "k"]]],
              "e",
            ),
            "list<integer>",
          ],
          [
            "iy_degrees",
            forEach(
              elementRange,
              [
                "If",
                ["Equal", at("j", "rk_prv"), 0],
                0,
                bind(
                  "iy_home",
                  at("j", "iy_least"),
                  bind(
                    "iy_homeSize",
                    iySizeBefore("iy_home", "j"),
                    [
                      "Subtract",
                      ["Subtract", "j", 1],
                      [
                        "Count",
                        [
                          "Filter",
                          ["Range", 1, ["Subtract", "j", 1], 1],
                          [
                            "Function",
                            [
                              "And",
                              ["Equal", at("k", "iy_least"), "k"],
                              [
                                "Or",
                                ["Greater", iySizeBefore("k", "j"), "iy_homeSize"],
                                ["And", ["Equal", iySizeBefore("k", "j"), "iy_homeSize"], ["Less", "k", "iy_home"]],
                              ],
                            ],
                            "k",
                          ],
                        ],
                      ],
                    ],
                    "integer",
                  ),
                  "integer",
                ),
              ],
              "j",
            ),
            "list<integer>",
          ],
          [
            "iy_state",
            [
              "Fold",
              [
                "Function",
                [
                  "If",
                  ["Equal", at("j", "rk_prv"), 0],
                  ["Tuple", ["Join", ["At", "acc", 1], ["List", "j"]], ["At", "acc", 2]],
                  bind(
                    "iy_row",
                    [
                      "Min",
                      [
                        "Filter",
                        ["Range", 1, elements, 1],
                        [
                          "Function",
                          [
                            "LessEqual",
                            at("j", "iy_degrees"),
                            [
                              "Add",
                              "i",
                              ["Count", ["Filter", ["At", "acc", 2], ["Function", ["Greater", "r", "i"], "r"]]],
                            ],
                          ],
                          "i",
                        ],
                      ],
                    ],
                    [
                      "Tuple",
                      ["Join", ["At", "acc", 1], ["List", at("iy_row", ["At", "acc", 1])]],
                      ["Join", ["At", "acc", 2], ["List", "iy_row"]],
                    ],
                    "integer",
                  ),
                ],
                "acc",
                "j",
              ],
              ["Tuple", ["List", 1], ["List", 0]],
              ["Range", 2, elements, 1],
            ],
          ],
        ],
        blocksOfLeastLabels(["At", "iy_state", 1]),
      ),
    ),
    summary:
      "The set partition joined by the arcs of the rook placement that Yip's bijection psi assigns to the set partition.",
    note: "FindStat's Mp00219, the inverse of Yip.",
  },
];
