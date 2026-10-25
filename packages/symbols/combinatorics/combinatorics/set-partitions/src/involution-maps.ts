// Involutions of set partitions found by FindStat, each written as the definition in its source.

import { at, bind, forEach, type CombinatorialMap, type MathJSON } from "../../src/map-helpers.ts";

const upTo = (k: MathJSON): MathJSON => ["Range", 1, k, 1];
const rows = "list<any>";

/** The blocks `blocks` (a list of lists) ordered by their least elements. */
const byLeastElement = (blocks: MathJSON): MathJSON => [
  "Map",
  ["Function", ["At", blocks, ["IndexWhere", blocks, ["Function", ["Equal", ["At", "b", 1], "m"], "b"]]], "m"],
  ["Sort", ["Map", ["Function", ["At", "b", 1], "b"], blocks]],
];

export const kzOpen: MathJSON = at(1, "kz_state");
/** Where in the stack the block that i joins sits: gamma places from the top. */
export const kzSlot: MathJSON = [
  "Subtract",
  ["Length", kzOpen],
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
export const kzJoined: MathJSON = [
  "If",
  ["Greater", at("i", "kz_pred"), 0],
  ["Join", at(kzSlot, kzOpen), ["List", "i"]],
  ["List", "i"],
];
export const kzRest: MathJSON = [
  "If",
  ["Greater", at("i", "kz_pred"), 0],
  [
    "Map",
    ["Function", at("q", kzOpen), "q"],
    ["Filter", upTo(["Length", kzOpen]), ["Function", ["NotEqual", "q", kzSlot], "q"]],
  ],
  kzOpen,
];

/**
 * Kasraoui-Zeng. An arc joins consecutive elements of a block. Sweeping 1 .. n with a stack of open blocks, an
 * element closing an arc joins the block gamma places from the top of the stack, gamma being one more than the
 * arcs that start earlier and end later (arcs that nest over it); an element opening an arc then puts its block back
 * on the stack, and any other finishes its block. The image has the arcs' nestings and crossings exchanged.
 */
export const kasraouiZengBody: MathJSON = bind(
  "kz_n",
  ["Length", ["Flatten", "_raw"]],
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
        at(2, [
          "Fold",
          [
            "Function",
            [
              "If",
              ["Greater", at("i", "kz_succ"), 0],
              ["List", ["Join", kzRest, ["List", kzJoined]], at(2, "kz_state")],
              ["List", kzRest, ["Join", at(2, "kz_state"), ["List", kzJoined]]],
            ],
            "kz_state",
            "i",
          ],
          ["List", ["List"], ["List"]],
          upTo("kz_n"),
        ]),
        byLeastElement("kz_done"),
        rows,
      ),
      "list<integer>",
    ),
    "list<integer>",
  ),
  "integer",
);

/** The list of `item` for each `variable` in `over`, built whole (a `Map` stays lazy and does not bind as a list). */
const built = (over: MathJSON, item: MathJSON, variable: string): MathJSON => [
  "Fold",
  ["Function", ["Join", "bt_acc", ["List", item]], "bt_acc", variable],
  ["List"],
  over,
];
const last = (block: MathJSON): MathJSON => ["At", block, ["Length", block]];
/** The blocks of `list` after the first `k`. */
const dropped = (list: MathJSON, k: MathJSON): MathJSON =>
  bind(
    "cs_kept",
    list,
    built(["Filter", upTo(["Length", "cs_kept"]), ["Function", ["Greater", "j", k], "j"]], at("j", "cs_kept"), "j"),
    rows,
  );

/**
 * Callan's switch. Take the blocks by their largest elements, p, and let s be the second element of the block b of 1
 * and r the least of the largest elements of the blocks with more than one element. With x the least largest
 * element and y = min(r, s), the partition is fixed when b is a singleton or x = y. Below that, the
 * leading singletons of p below s (or all of them, when r < s) join b, and s is split off as a singleton when r > s;
 * above it, the elements of b below x become singletons and, when the first block of p is the singleton x, it joins b.
 */
/** The blocks of p with the block of 1 replaced by `replacement`. */
const withReplaced = (replacement: MathJSON): MathJSON =>
  bind(
    "cs_w",
    built(upTo("cs_n"), ["If", ["Equal", at("k", "cs_p"), "cs_b"], replacement, at("k", "cs_p")], "k"),
    "cs_w",
    rows,
  );
const isLeadSingleton = (k: MathJSON): MathJSON => ["Equal", ["Length", at(k, "cs_p")], 1];
/** Whether the block k of p is no longer one of the leading singletons that `stays` accepts. */
const leadEnds = (stays: MathJSON): MathJSON => [
  "Subtract",
  ["Min", ["Filter", upTo("cs_n"), ["Function", ["Not", ["And", isLeadSingleton("k"), stays]], "k"]]],
  1,
];
const lead: MathJSON = [
  "Flatten",
  ["Map", ["Function", at("k", "cs_p"), "k"], ["Filter", upTo("cs_n"), ["Function", ["LessEqual", "k", "cs_i"], "k"]]],
];
const smallerThanX = (e: MathJSON): MathJSON => ["And", ["Greater", e, 1], ["Less", e, "cs_x"]];

const callanSwitchBody: MathJSON = [
  "If",
  ["Equal", ["Length", "_raw"], 0],
  ["List"],
  bind(
    "cs_p",
    [
      "Map",
      ["Function", at(["IndexWhere", "_raw", ["Function", ["Equal", last("b"), "m"], "b"]]), "m"],
      ["Sort", ["Map", ["Function", last("b"), "b"], "_raw"]],
    ],
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
              [
                "Map",
                ["Function", last("b"), "b"],
                ["Filter", "cs_p", ["Function", ["Greater", ["Length", "b"], 1], "b"]],
              ],
            ],
            bind(
              "cs_x",
              last(at(1, "cs_p")),
              bind(
                "cs_n",
                ["Length", "cs_p"],
                [
                  "If",
                  ["Equal", "cs_x", ["Min", "cs_r", "cs_s"]],
                  "_raw",
                  bind(
                    "cs_out",
                    [
                      "If",
                      ["Less", "cs_x", ["Min", "cs_r", "cs_s"]],
                      bind(
                        "cs_i",
                        leadEnds(["Or", ["LessEqual", "cs_r", "cs_s"], ["Less", at(1, at("k", "cs_p")), "cs_s"]]),
                        [
                          "If",
                          ["Greater", "cs_r", "cs_s"],
                          [
                            "Join",
                            dropped(
                              withReplaced([
                                "Join",
                                ["Filter", "cs_b", ["Function", ["NotEqual", "e", "cs_s"], "e"]],
                                lead,
                              ]),
                              "cs_i",
                            ),
                            ["List", ["List", "cs_s"]],
                          ],
                          dropped(withReplaced(["Join", "cs_b", lead]), "cs_i"),
                        ],
                        "integer",
                      ),
                      bind(
                        "cs_m",
                        built(["Filter", "cs_b", ["Function", smallerThanX("e"), "e"]], ["List", "e"], "e"),
                        bind(
                          "cs_rest",
                          [
                            "If",
                            isLeadSingleton(1),
                            dropped(
                              withReplaced([
                                "Join",
                                ["Filter", "cs_b", ["Function", ["Not", smallerThanX("e")], "e"]],
                                ["List", "cs_x"],
                              ]),
                              1,
                            ),
                            withReplaced(["Filter", "cs_b", ["Function", ["Not", smallerThanX("e")], "e"]]),
                          ],
                          ["Join", "cs_m", "cs_rest"],
                          rows,
                        ),
                        rows,
                      ),
                    ],
                    bind("cs_sorted", built("cs_out", ["Sort", "b"], "b"), byLeastElement("cs_sorted"), rows),
                    rows,
                  ),
                ],
                "integer",
              ),
              "integer",
            ),
            "integer",
          ),
          "integer",
        ),
      ],
      "list<integer>",
    ),
    rows,
  ),
];

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
