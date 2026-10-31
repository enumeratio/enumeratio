// Involutions of set partitions found by FindStat, each written as the definition in its source.

import { at, bind, forEach, lets, type CombinatorialMap, type MathJSON } from "../../src/map-helpers.ts";
import { blocksOfLeastLabels } from "./maps.ts";

const upTo = (k: MathJSON): MathJSON => ["Range", 1, k, 1];

const kzEntry = (index: MathJSON): MathJSON => at(index, "kz_s");
/** The stack's length: the state is the n block labels, then the stack of open blocks' labels, the top last. */
const kzStackLength: MathJSON = ["Subtract", ["Length", "kz_s"], "kz_n"];
/** Where in the stack the block that i joins sits: gamma places from the top. */
const kzSlot: MathJSON = [
  "Subtract",
  kzStackLength,
  [
    "Count",
    [
      "Filter",
      upTo("kz_n"),
      [
        "Function",
        [
          "And",
          ["Greater", at("y", "kz_pred"), 0],
          ["Less", at("y", "kz_pred"), at("i", "kz_pred")],
          ["Greater", "y", "i"],
        ],
        "y",
      ],
    ],
  ],
];
const kzJoins: MathJSON = ["Greater", at("i", "kz_pred"), 0];

/** One element i: it takes the label of the block it joins (or opens its own, labeled i); that block leaves the stack and,
 *  when an arc goes on from i, returns to the top. */
const kzStep: MathJSON = lets(
  [
    ["kz_slot", ["If", kzJoins, kzSlot, 0], "integer"],
    ["kz_label", ["If", kzJoins, kzEntry(["Add", "kz_n", "kz_slot"]), "i"], "integer"],
    ["kz_kept", ["Subtract", kzStackLength, ["If", kzJoins, 1, 0]], "integer"],
    ["kz_total", ["Add", "kz_n", "kz_kept", ["If", ["Greater", at("i", "kz_succ"), 0], 1, 0]], "integer"],
  ],
  forEach(
    upTo("kz_total"),
    [
      "If",
      ["LessEqual", "q", "kz_n"],
      ["If", ["Equal", "q", "i"], "kz_label", kzEntry("q")],
      [
        "If",
        ["LessEqual", "q", ["Add", "kz_n", "kz_kept"]],
        kzEntry([
          "If",
          ["And", ["Greater", "kz_slot", 0], ["GreaterEqual", ["Subtract", "q", "kz_n"], "kz_slot"]],
          ["Add", "q", 1],
          "q",
        ]),
        "kz_label",
      ],
    ],
    "q",
  ),
);

/**
 * Kasraoui-Zeng. An arc joins consecutive elements of a block. Sweeping 1 .. n with a stack of open blocks, an
 * element closing an arc joins the block gamma places from the top of the stack, gamma being one more than the
 * arcs that start earlier and end later (arcs that nest over it); an element opening an arc then puts its block back
 * on the stack, and any other finishes its block. The image has the arcs' nestings and crossings exchanged.
 * The sweep carries each element's block, labeled by its least element, and the stack of open blocks' labels.
 */
export const kasraouiZengBody: MathJSON = bind(
  "kz_n",
  ["Length", ["Flatten", "_raw"]],
  [
    "If",
    ["LessEqual", "kz_n", 1],
    "_raw",
    bind(
      // The element before x in its block, or 0.
      "kz_pred",
      forEach(
        upTo("kz_n"),
        bind(
          "kz_block",
          at(["IndexWhere", "_raw", ["Function", ["Element", "x", "b"], "b"]]),
          [
            "If",
            ["Equal", ["IndexOf", "kz_block", "x"], 1],
            0,
            at(["Subtract", ["IndexOf", "kz_block", "x"], 1], "kz_block"),
          ],
          "list<integer>",
        ),
        "x",
      ),
      bind(
        // The element after x in its block, or 0.
        "kz_succ",
        forEach(
          upTo("kz_n"),
          bind(
            "kz_block",
            at(["IndexWhere", "_raw", ["Function", ["Element", "x", "b"], "b"]]),
            [
              "If",
              ["Equal", ["IndexOf", "kz_block", "x"], ["Length", "kz_block"]],
              0,
              at(["Add", ["IndexOf", "kz_block", "x"], 1], "kz_block"),
            ],
            "list<integer>",
          ),
          "x",
        ),
        bind(
          "kz_done",
          ["Fold", ["Function", kzStep, "kz_s", "i"], forEach(upTo("kz_n"), 0, "z"), upTo("kz_n")],
          blocksOfLeastLabels(forEach(upTo("kz_n"), at("e", "kz_done"), "e")),
          "list<integer>",
        ),
        "list<integer>",
      ),
      "list<integer>",
    ),
  ],
  "integer",
);

const last = (block: MathJSON): MathJSON => ["At", block, ["Length", block]];
const blockAt = (k: MathJSON): MathJSON => at(k, "_raw");
/** The index in `_raw` of the block with the k-th least largest element. */
const byRank = (k: MathJSON): MathJSON => at(k, "cs_order");
const sizeAt = (k: MathJSON): MathJSON => ["Length", blockAt(byRank(k))];
/** The number of leading blocks of p that are singletons `stays` accepts, given a block's least element. */
const leadLength = (stays: (least: MathJSON) => MathJSON): MathJSON => [
  "Subtract",
  [
    "Min",
    [
      "Filter",
      upTo("cs_m"),
      ["Function", ["Not", ["And", ["Equal", sizeAt("k"), 1], stays(at(1, blockAt(byRank("k"))))]], "k"],
    ],
  ],
  1,
];
const smallerThanX = (e: MathJSON): MathJSON => ["And", ["Greater", e, 1], ["Less", e, "cs_x"]];

/** The blocks of the elements 1 .. n that `labels` puts together, ordered by least element. */
const groupedBy = (labels: MathJSON): MathJSON =>
  bind(
    "cs_lab",
    labels,
    [
      "Map",
      ["Function", ["Filter", upTo("cs_n"), ["Function", ["Equal", at("q", "cs_lab"), at("g", "cs_lab")], "q"]], "g"],
      [
        "Filter",
        upTo("cs_n"),
        [
          "Function",
          [
            "Equal",
            ["Count", ["Filter", upTo("g"), ["Function", ["Equal", at("q", "cs_lab"), at("g", "cs_lab")], "q"]]],
            1,
          ],
          "g",
        ],
      ],
    ],
    "list<integer>",
  );

/**
 * Callan's switch. Take the blocks by their largest elements, p, and let s be the second element of the block b of 1
 * and r the least of the largest elements of the blocks with more than one element. With x the least largest
 * element and y = min(r, s), the partition is fixed when b is a singleton or x = y. Below that, the
 * leading singletons of p below s (or all of them, when r < s) join b, and s is split off as a singleton when r > s;
 * above it, the elements of b below x become singletons and, when the first block of p is the singleton x, it joins b.
 * Each element carries a label for its block in the image: its block's rank in p, or the negated element for a new singleton.
 */
const callanSwitchBody: MathJSON = bind(
  "cs_m",
  ["Length", "_raw"],
  [
    "If",
    ["Equal", "cs_m", 0],
    ["List"],
    bind(
      "cs_n",
      ["Length", ["Flatten", "_raw"]],
      bind(
        "cs_last",
        forEach(upTo("cs_m"), last(blockAt("j")), "j"),
        bind(
          // The rank in p of each block of `_raw`, and the block that has each rank.
          "cs_rank",
          forEach(
            upTo("cs_m"),
            ["Add", 1, ["Count", ["Filter", "cs_last", ["Function", ["Less", "k", at("j", "cs_last")], "k"]]]],
            "j",
          ),
          bind(
            "cs_order",
            forEach(upTo("cs_m"), ["IndexWhere", "cs_rank", ["Function", ["Equal", "v", "k"], "v"]], "k"),
            bind(
              "cs_blk",
              forEach(upTo("cs_n"), ["IndexWhere", "_raw", ["Function", ["Element", "e", "b"], "b"]], "e"),
              bind(
                // The rank in p of the block of each element.
                "cs_p",
                forEach(upTo("cs_n"), at(at("e", "cs_blk"), "cs_rank"), "e"),
                bind(
                  "cs_b",
                  at(1),
                  [
                    "If",
                    ["Equal", ["Length", "cs_b"], 1],
                    "_raw",
                    bind(
                      "cs_s",
                      at(2, "cs_b"),
                      bind(
                        "cs_r",
                        [
                          "Min",
                          forEach(
                            ["Filter", upTo("cs_m"), ["Function", ["Greater", ["Length", blockAt("k")], 1], "k"]],
                            at("k", "cs_last"),
                            "k",
                          ),
                        ],
                        bind(
                          "cs_x",
                          at(byRank(1), "cs_last"),
                          [
                            "If",
                            ["Equal", "cs_x", ["Min", "cs_r", "cs_s"]],
                            "_raw",
                            [
                              "If",
                              ["Less", "cs_x", ["Min", "cs_r", "cs_s"]],
                              bind(
                                // The leading blocks of p, which join b.
                                "cs_i",
                                leadLength((least) => ["Or", ["LessEqual", "cs_r", "cs_s"], ["Less", least, "cs_s"]]),
                                groupedBy(
                                  forEach(
                                    upTo("cs_n"),
                                    [
                                      "If",
                                      ["LessEqual", at("e", "cs_p"), "cs_i"],
                                      at(1, "cs_rank"),
                                      [
                                        "If",
                                        ["And", ["Greater", "cs_r", "cs_s"], ["Equal", "e", "cs_s"]],
                                        ["Negate", "e"],
                                        at("e", "cs_p"),
                                      ],
                                    ],
                                    "e",
                                  ),
                                ),
                                "integer",
                              ),
                              groupedBy(
                                forEach(
                                  upTo("cs_n"),
                                  [
                                    "If",
                                    ["And", ["Equal", at("e", "cs_blk"), 1], smallerThanX("e")],
                                    ["Negate", "e"],
                                    [
                                      "If",
                                      ["And", ["Equal", sizeAt(1), 1], ["Equal", "e", "cs_x"]],
                                      at(1, "cs_rank"),
                                      at("e", "cs_p"),
                                    ],
                                  ],
                                  "e",
                                ),
                              ),
                            ],
                          ],
                          "integer",
                        ),
                        "integer",
                      ),
                      "integer",
                    ),
                  ],
                  "list<integer>",
                ),
                "list<integer>",
              ),
              "list<integer>",
            ),
            "list<integer>",
          ),
          "list<integer>",
        ),
        "list<integer>",
      ),
      "integer",
    ),
  ],
  "integer",
);

export const SET_PARTITION_INVOLUTION_MAPS: readonly CombinatorialMap[] = [
  {
    name: "KasraouiZeng",
    from: "set_partition",
    to: "set_partition",
    body: kasraouiZengBody,
    summary: "The Kasraoui-Zeng involution: exchanges the number of crossings with the number of nestings.",
    note: "FindStat's Mp00115, defined in Kasraoui and Zeng's \"Distribution of crossings, nestings and alignments of two edges in matchings and partitions\".",
  },
  {
    name: "CallanSwitch",
    from: "set_partition",
    to: "set_partition",
    body: callanSwitchBody,
    summary:
      "Callan's involution: switches the first closer with the lesser of the least closer and the second element of the block of 1.",
    note: "FindStat's Mp00249, a joint symmetry of St000971 and St001784.",
  },
];
