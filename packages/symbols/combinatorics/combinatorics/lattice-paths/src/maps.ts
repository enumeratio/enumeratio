// The one combinatorial map whose `from` carrier is `dyck_path` (step 6c). Its body comes from
// trees' `binary-tree.ts`, which also backs the two maps trees owns itself
// (`../../trees/src/maps.ts`) — the inverse direction of the bijection lives here because a
// map's area is decided by its SOURCE carrier, not the module its body happens to share.

import { at, bind, forEach, lets, type CombinatorialMap, type MathJSON, positions } from "../../src/map-helpers.ts";
import { ANY, buildFromDyck } from "../../collections/src/families/nested.ts";

/** The positions 1 .. 2n of `_raw` that hold `letter` (1 up, 0 down) and satisfy `also`. */
const stepsWhere = (letter: number, also: MathJSON = true, from: MathJSON = 1): MathJSON => [
  "Filter",
  ["Range", from, ["Length", "_raw"], 1],
  ["Function", ["And", ["Equal", at("p"), letter], also], "p"],
];

/** How many up steps `_raw` has among its first k steps. */
export const upsThrough = (k: MathJSON): MathJSON => [
  "Count",
  ["Filter", ["Range", 1, k, 1], ["Function", ["Equal", at("u"), 1], "u"]],
];

/** Only a Dyck path: as many downs as ups, and no prefix with more downs than ups. The carrier also holds
 *  the grand paths other families draw, which these maps are not defined on. */
export const dyckGuard: MathJSON = [
  "And",
  ["Equal", ["Multiply", 2, upsThrough(["Length", "_raw"])], ["Length", "_raw"]],
  [
    "Equal",
    [
      "Count",
      [
        "Filter",
        ["Range", 1, ["Length", "_raw"], 1],
        ["Function", ["Less", ["Multiply", 2, upsThrough("t")], "t"], "t"],
      ],
    ],
    0,
  ],
];

/** The area sequence: entry i is the height before the i-th up step, 2i - 1 - (its position). */
export const areaSequence: MathJSON = bind(
  "ups",
  stepsWhere(1),
  forEach(["Range", 1, ["Length", "ups"], 1], ["Subtract", ["Subtract", ["Multiply", 2, "i"], 1], at("i", "ups")]),
  "list<integer>",
);

/** The height of `_raw` before step p: ups so far less downs so far. */
const heightBefore = (p: MathJSON): MathJSON => [
  "Subtract",
  ["Multiply", 2, upsThrough(["Subtract", p, 1])],
  ["Subtract", p, 1],
];

/** The positions of `_raw` whose step is `letter`, as a list built whole. */
const positionsOf = (letter: number): MathJSON => [
  "Fold",
  ["Function", ["If", ["Equal", at("p"), letter], ["Join", "acc", ["List", "p"]], "acc"], "acc", "p"],
  ["List"],
  positions,
];

/** The two-row standard tableau of a Dyck path: the positions of its up steps, then those of its down steps. */
export const twoRowTableau: MathJSON = ["List", positionsOf(1), positionsOf(0)];

/** The indices 1 .. n, none when n is 0: the stated step keeps the range from counting down. */
const upTo = (n: MathJSON): MathJSON => ["Range", 1, n, 1];

/** The Dyck path whose up steps are the entries of the list `first`. */
const pathOfFirstRow = (first: MathJSON): MathJSON =>
  bind(
    "pt_first",
    first,
    forEach(
      positions,
      ["If", ["Greater", ["Count", ["Filter", "pt_first", ["Function", ["Equal", "r", "p"], "r"]]], 0], 1, 0],
      "p",
    ),
    "list<integer>",
  );

// Promotion of the path's two-row tableau (n entries a row), on a flat state: the first row, then the second,
// then the hole's row and column, each an integer, so the walk can compile (nested rows in a state can't).
const holeIndex = (state: string, n: MathJSON): MathJSON => [
  "Add",
  ["Multiply", ["Subtract", at(["Add", ["Multiply", 2, n], 1], state), 1], n],
  at(["Add", ["Multiply", 2, n], 2], state),
];

/** The state after the hole takes `value` in its cell and moves to (`row`, `column`). */
const holeMoved = (state: string, n: MathJSON, value: MathJSON, row: MathJSON, column: MathJSON): MathJSON =>
  forEach(upTo(["Add", ["Multiply", 2, n], 2]), [
    "If",
    ["Equal", "i", holeIndex(state, n)],
    value,
    [
      "If",
      ["Equal", "i", ["Add", ["Multiply", 2, n], 1]],
      row,
      ["If", ["Equal", "i", ["Add", ["Multiply", 2, n], 2]], column, at("i", state)],
    ],
  ]);

/** Promotion's walk: the hole from the largest entry (second row, last column) pulls in the larger of the entry
 *  to its left and the one above it, until it reaches the origin. The first row of the image tableau follows. */
const promotedFirstRow: MathJSON = bind(
  "pm_n",
  ["Divide", ["Length", "_raw"], 2],
  bind(
    "pm_end",
    [
      "Fold",
      [
        "Function",
        bind(
          "pm_idx",
          holeIndex("pm_s", "pm_n"),
          bind(
            "pm_left",
            [
              "If",
              ["Greater", at(["Add", ["Multiply", 2, "pm_n"], 2], "pm_s"), 1],
              at(["Subtract", "pm_idx", 1], "pm_s"),
              0,
            ],
            bind(
              "pm_up",
              [
                "If",
                ["Greater", at(["Add", ["Multiply", 2, "pm_n"], 1], "pm_s"), 1],
                at(["Subtract", "pm_idx", "pm_n"], "pm_s"),
                0,
              ],
              [
                "If",
                ["And", ["Equal", "pm_left", 0], ["Equal", "pm_up", 0]],
                "pm_s",
                [
                  "If",
                  ["Greater", "pm_left", "pm_up"],
                  holeMoved("pm_s", "pm_n", "pm_left", at(["Add", ["Multiply", 2, "pm_n"], 1], "pm_s"), [
                    "Subtract",
                    at(["Add", ["Multiply", 2, "pm_n"], 2], "pm_s"),
                    1,
                  ]),
                  holeMoved(
                    "pm_s",
                    "pm_n",
                    "pm_up",
                    ["Subtract", at(["Add", ["Multiply", 2, "pm_n"], 1], "pm_s"), 1],
                    at(["Add", ["Multiply", 2, "pm_n"], 2], "pm_s"),
                  ),
                ],
              ],
              "integer",
            ),
            "integer",
          ),
          "integer",
        ),
        "pm_s",
        "pm_step",
      ],
      ["Join", positionsOf(1), positionsOf(0), ["List", 2, "pm_n"]],
      upTo(["Length", "_raw"]),
    ],
    // The entries all go up by one and the origin takes 1.
    forEach(upTo("pm_n"), ["If", ["Equal", "k", 1], 1, ["Add", at("k", "pm_end"), 1]], "k"),
    "list<integer>",
  ),
  "integer",
);

/** Inverse promotion's walk: the hole from the origin pulls in the smaller of the entry to its right and the one
 *  below it, until it can't; the entries all go down by one and the hole's cell takes the largest. */
const inversePromotedFirstRow: MathJSON = bind(
  "pm_n",
  ["Divide", ["Length", "_raw"], 2],
  bind(
    "pm_end",
    [
      "Fold",
      [
        "Function",
        bind(
          "pm_idx",
          holeIndex("pm_s", "pm_n"),
          bind(
            "pm_right",
            [
              "If",
              ["Less", at(["Add", ["Multiply", 2, "pm_n"], 2], "pm_s"), "pm_n"],
              at(["Add", "pm_idx", 1], "pm_s"),
              ["Add", ["Length", "_raw"], 1],
            ],
            bind(
              "pm_down",
              [
                "If",
                ["Less", at(["Add", ["Multiply", 2, "pm_n"], 1], "pm_s"), 2],
                at(["Add", "pm_idx", "pm_n"], "pm_s"),
                ["Add", ["Length", "_raw"], 1],
              ],
              [
                "If",
                ["And", ["Greater", "pm_right", ["Length", "_raw"]], ["Greater", "pm_down", ["Length", "_raw"]]],
                "pm_s",
                [
                  "If",
                  ["Less", "pm_right", "pm_down"],
                  holeMoved("pm_s", "pm_n", "pm_right", at(["Add", ["Multiply", 2, "pm_n"], 1], "pm_s"), [
                    "Add",
                    at(["Add", ["Multiply", 2, "pm_n"], 2], "pm_s"),
                    1,
                  ]),
                  holeMoved(
                    "pm_s",
                    "pm_n",
                    "pm_down",
                    ["Add", at(["Add", ["Multiply", 2, "pm_n"], 1], "pm_s"), 1],
                    at(["Add", ["Multiply", 2, "pm_n"], 2], "pm_s"),
                  ),
                ],
              ],
              "integer",
            ),
            "integer",
          ),
          "integer",
        ),
        "pm_s",
        "pm_step",
      ],
      ["Join", positionsOf(1), positionsOf(0), ["List", 1, 1]],
      upTo(["Length", "_raw"]),
    ],
    forEach(
      upTo("pm_n"),
      ["If", ["Equal", "k", holeIndex("pm_end", "pm_n")], ["Length", "_raw"], ["Subtract", at("k", "pm_end"), 1]],
      "k",
    ),
    "list<integer>",
  ),
  "integer",
);

/** Mp00222, as Sage builds it: the peaks above height 1 as (position before the up step, height before it), between
 *  sentinels; between each pair of consecutive ones, the ups and downs that carry a valley across. */
const peaksToValleysBody: MathJSON = [
  "If",
  ["Equal", ["Length", "_raw"], 0],
  ["List"],
  bind(
    "ptv_peaks",
    [
      "Fold",
      [
        "Function",
        [
          "If",
          ["And", ["Equal", at("p"), 1], ["Equal", at(["Add", "p", 1]), 0], ["Greater", heightBefore("p"), 0]],
          ["Join", "acc", ["List", "p"]],
          "acc",
        ],
        "acc",
        "p",
      ],
      ["List"],
      ["Range", 1, ["Subtract", ["Length", "_raw"], 1], 1],
    ],
    bind(
      "ptv_at",
      [
        "Join",
        ["List", -2],
        forEach(["Range", 1, ["Length", "ptv_peaks"], 1], ["Subtract", at("k", "ptv_peaks"), 1], "k"),
        ["List", ["Length", "_raw"]],
      ],
      bind(
        "ptv_height",
        [
          "Join",
          ["List", 0],
          forEach(["Range", 1, ["Length", "ptv_peaks"], 1], heightBefore(at("k", "ptv_peaks")), "k"),
          ["List", 0],
        ],
        bind(
          "ptv_word",
          [
            "Fold",
            [
              "Function",
              bind(
                "ptv_gap",
                ["Subtract", ["Subtract", at(["Add", "q", 1], "ptv_at"), at("q", "ptv_at")], 2],
                bind(
                  "ptv_rise",
                  ["Subtract", at(["Add", "q", 1], "ptv_height"), at("q", "ptv_height")],
                  [
                    "Join",
                    "acc",
                    forEach(["Range", 1, ["Floor", ["Divide", ["Add", "ptv_gap", "ptv_rise"], 2]], 1], 1, "z"),
                    forEach(["Range", 1, ["Floor", ["Divide", ["Subtract", "ptv_gap", "ptv_rise"], 2]], 1], 0, "z"),
                    ["List", 0, 1],
                  ],
                  "integer",
                ),
                "integer",
              ),
              "acc",
              "q",
            ],
            ["List"],
            ["Range", 1, ["Subtract", ["Length", "ptv_at"], 1], 1],
          ],
          forEach(["Range", 1, ["Subtract", ["Length", "ptv_word"], 2], 1], at("k", "ptv_word"), "k"),
          "list<integer>",
        ),
        "list<integer>",
      ),
      "list<integer>",
    ),
    "list<integer>",
  ),
];

/** The inverse zeta map's body: the area sequence folded in one entry at a time, each step wrapping a
 *  prefix of the path built so far, as in FindStat's Mp00032. The state is the path `out` and `zeros`,
 *  the positions (counted back from the end of `out`) where a later entry may attach. */
const inverseZetaBody: MathJSON = [
  "If",
  ["Equal", ["Length", "_raw"], 0],
  ["List"],
  bind(
    "area",
    areaSequence,
    [
      "At",
      [
        "Fold",
        [
          "Function",
          bind(
            "out",
            ["At", "acc", 1],
            bind(
              "zeros",
              ["At", "acc", 2],
              bind(
                "a",
                at("i", "area"),
                // Attach after `p` entries of `out`: the a-th zero, or the end when there are only a of them.
                bind(
                  "p",
                  ["At", ["Join", "zeros", ["List", ["Length", "out"]]], ["Add", "a", 1]],
                  [
                    "List",
                    [
                      "Join",
                      ["List", 1],
                      forEach(["Range", ["Add", "p", 1], ["Length", "out"], 1], at("k", "out"), "k"),
                      ["List", 0],
                      forEach(upTo("p"), at("k", "out"), "k"),
                    ],
                    [
                      "Join",
                      ["List", 0],
                      forEach(
                        upTo("a"),
                        ["Add", at("k", "zeros"), ["Subtract", ["Add", ["Length", "out"], 2], "p"]],
                        "k",
                      ),
                    ],
                  ],
                ),
              ),
              "list<integer>",
            ),
            "list<integer>",
          ),
          "acc",
          "i",
        ],
        ["List", ["List"], ["List"]],
        upTo(["Length", "area"]),
      ],
      1,
    ],
    "list<integer>",
  ),
];

/** The bounce path's corners, from the end: starting at n, the next stop after height h is the column of the
 *  up step that ends at height h (`xs` holds the column of every up step), and the stops stay 0 once the
 *  diagonal is reached. */
const bounceBody: MathJSON = [
  "If",
  ["Equal", ["Length", "_raw"], 0],
  ["List"],
  bind(
    "n",
    ["Divide", ["Length", "_raw"], 2],
    bind(
      "xs",
      forEach(upTo("n"), ["Subtract", ["Subtract", "k", 1], at("k", areaSequence)], "k"),
      bind(
        "stops",
        [
          "Fold",
          [
            "Function",
            bind("last", at(["Length", "acc"], "acc"), [
              "Join",
              "acc",
              ["List", ["If", ["Equal", "last", 0], 0, at("last", "xs")]],
            ]),
            "acc",
            "j",
          ],
          ["List", "n"],
          upTo("n"),
        ],
        // The gaps between successive stops are the bounces, last stop first; each is d ups then d downs.
        bind(
          "gaps",
          [
            "Fold",
            [
              "Function",
              [
                "If",
                ["Greater", ["Subtract", at("q", "stops"), at(["Add", "q", 1], "stops")], 0],
                ["Join", "acc", ["List", ["Subtract", at("q", "stops"), at(["Add", "q", 1], "stops")]]],
                "acc",
              ],
              "acc",
              "q",
            ],
            ["List"],
            upTo("n"),
          ],
          [
            "Flatten",
            forEach(
              upTo(["Length", "gaps"]),
              forEach(
                upTo(["Multiply", 2, at(["Subtract", ["Add", ["Length", "gaps"], 1], "r"], "gaps")]),
                ["If", ["LessEqual", "k", at(["Subtract", ["Add", ["Length", "gaps"], 1], "r"], "gaps")], 1, 0],
                "k",
              ),
              "r",
            ),
          ],
          "list<integer>",
        ),
        "list<integer>",
      ),
      "list<integer>",
    ),
  ),
];

/** Mp00103: the area sequence with its first entry dropped and every entry lowered by two (not below 0), a final 0
 *  closing it, read back as a path: each entry a_i is an up step, then a_i + 1 - a_(i+1) down steps. */
const peelingBody: MathJSON = [
  "If",
  ["Equal", ["Length", "_raw"], 0],
  ["List"],
  bind(
    "area",
    areaSequence,
    bind(
      "peeled",
      forEach(upTo(["Length", "area"]), [
        "If",
        ["Equal", "i", ["Length", "area"]],
        0,
        ["Max", 0, ["Subtract", at(["Min", ["Add", "i", 1], ["Length", "area"]], "area"), 2]],
      ]),
      [
        "Flatten",
        forEach(
          upTo(["Length", "peeled"]),
          forEach(
            upTo([
              "Subtract",
              ["Add", at("i", "peeled"), 2],
              [
                "If",
                ["Equal", "i", ["Length", "peeled"]],
                0,
                at(["Min", ["Add", "i", 1], ["Length", "peeled"]], "peeled"),
              ],
            ]),
            ["If", ["Equal", "k", 1], 1, 0],
            "k",
          ),
        ),
      ],
      "list<integer>",
    ),
    "list<integer>",
  ),
];

/** The height of `_raw` after j steps. */
const heightAfter = (j: MathJSON): MathJSON => ["Subtract", ["Multiply", 2, upsThrough(j)], j];

/** Mp00331: put 1s for the returns, then a 0, then the path without the up steps that open each primitive piece
 *  (the steps leaving the axis), less its last step. */
const counterclockwiseBody: MathJSON = [
  "If",
  ["Equal", ["Length", "_raw"], 0],
  ["List"],
  bind(
    "returns",
    ["Count", ["Filter", ["Range", 1, ["Length", "_raw"], 1], ["Function", ["Equal", heightAfter("t"), 0], "t"]]],
    bind(
      "kept",
      [
        "Filter",
        ["Range", 1, ["Length", "_raw"], 1],
        ["Function", ["Not", ["Equal", heightAfter(["Subtract", "p", 1]), 0]], "p"],
      ],
      [
        "Flatten",
        [
          "List",
          forEach(upTo("returns"), 1, "z"),
          ["List", 0],
          forEach(upTo(["Subtract", ["Length", "kept"], 1]), at(at("q", "kept")), "q"),
        ],
      ],
      "list<integer>",
    ),
    "integer",
  ),
];

/** Mp00330: drop the first run of k ups and the down step after it, and put one up step in at the first time the path
 *  reaches each of the levels k - 2 down to 0 (its record lows), a leading up step in front and a down step behind. */
const clockwiseBody: MathJSON = [
  "If",
  ["Equal", ["Length", "_raw"], 0],
  ["List"],
  bind(
    "ups",
    ["Subtract", ["First", stepsWhere(0)], 1],
    [
      "Flatten",
      [
        "List",
        ["List", 1],
        [
          "Flatten",
          forEach(
            ["Range", ["Add", "ups", 1], ["Length", "_raw"], 1],
            [
              "Join",
              [
                "If",
                [
                  "And",
                  ["Greater", "j", "ups"],
                  ["LessEqual", heightAfter("j"), ["Subtract", "ups", 2]],
                  [
                    "Less",
                    heightAfter("j"),
                    ["Min", forEach(["Range", "ups", ["Subtract", "j", 1], 1], heightAfter("t"), "t")],
                  ],
                ],
                ["List", 1],
                ["List"],
              ],
              ["If", ["Less", "j", ["Length", "_raw"]], ["List", at(["Add", "j", 1])], ["List"]],
            ],
            "j",
          ),
        ],
        ["List", 0],
      ],
    ],
    "integer",
  ),
];

/** Mp00101: split the path as U A D B at its first return and swap the pieces, recursively (U B' D A'), on flat
 *  lists. A step's matching down closes its segment, whose end the parent hands down (the matched down before
 *  the step's left child, the parent's own end for its right one); the image's U for the step is then at its
 *  parent's slot plus one when it is a right child, and past the parent's U, its right subtree and its D when it
 *  is a left one. The image has an up exactly at those slots. */
const decompositionReverseBody: MathJSON = [
  "If",
  ["Equal", ["Length", "_raw"], 0],
  ["List"],
  lets(
    [
      // Height after k steps is at(k + 1).
      [
        "dr_h",
        ["Join", ["List", 0], forEach(positions, ["Subtract", ["Multiply", 2, upsThrough("p")], "p"], "p")],
        "list<integer>",
      ],
      // The down matching each up (0 for a down).
      [
        "dr_down",
        forEach(
          positions,
          [
            "If",
            ["Equal", at("p"), 1],
            [
              "Min",
              [
                "Filter",
                ["Range", 1, ["Length", "_raw"], 1],
                [
                  "Function",
                  ["And", ["Greater", "q", "p"], ["Equal", at(["Add", "q", 1], "dr_h"), at("p", "dr_h")]],
                  "q",
                ],
              ],
            ],
            0,
          ],
          "p",
        ),
        "list<integer>",
      ],
      // The up matching each down (0 for an up).
      [
        "dr_up",
        forEach(
          positions,
          [
            "If",
            ["Equal", at("p"), 0],
            [
              "Max",
              ["Filter", ["Range", 1, ["Length", "_raw"], 1], ["Function", ["Equal", at("q", "dr_down"), "p"], "q"]],
            ],
            0,
          ],
          "p",
        ),
        "list<integer>",
      ],
      // Where each up's segment ends.
      [
        "dr_end",
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
                  ["Equal", at("p"), 0],
                  0,
                  [
                    "If",
                    ["Equal", "p", 1],
                    ["Length", "_raw"],
                    [
                      "If",
                      ["Equal", at(["Subtract", "p", 1]), 1],
                      ["Subtract", at(["Subtract", "p", 1], "dr_down"), 1],
                      at(at(["Subtract", "p", 1], "dr_up"), "acc"),
                    ],
                  ],
                ],
              ],
            ],
            "acc",
            "p",
          ],
          ["List"],
          positions,
        ],
        "list<integer>",
      ],
      // The slot of each up in the image (0 for a down).
      [
        "dr_slot",
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
                  ["Equal", at("p"), 0],
                  0,
                  [
                    "If",
                    ["Equal", "p", 1],
                    1,
                    [
                      "If",
                      ["Equal", at(["Subtract", "p", 1]), 1],
                      [
                        "Add",
                        at(["Subtract", "p", 1], "acc"),
                        2,
                        ["Subtract", at(["Subtract", "p", 1], "dr_end"), at(["Subtract", "p", 1], "dr_down")],
                      ],
                      ["Add", at(at(["Subtract", "p", 1], "dr_up"), "acc"), 1],
                    ],
                  ],
                ],
              ],
            ],
            "acc",
            "p",
          ],
          ["List"],
          positions,
        ],
        "list<integer>",
      ],
    ],
    forEach(
      positions,
      ["If", ["Greater", ["Count", ["Filter", "dr_slot", ["Function", ["Equal", "s", "t"], "s"]]], 0], 1, 0],
      "t",
    ),
  ),
];

/** Mp00012's inverse: the tree of the path from its preorder arity word. An up step is a node (2 children); a leaf
 *  stands for each empty piece, after an up step that a down step follows and after a down step that is followed
 *  by another or ends the path. The word is read from its end by a stack, so nothing recurses. */
const binaryTreeBody: MathJSON = [
  "If",
  ["Equal", ["Length", "_raw"], 0],
  0,
  bind(
    "bt_word",
    [
      "Flatten",
      forEach(
        positions,
        [
          "If",
          ["Equal", at("p"), 1],
          ["If", ["Equal", at(["Min", ["Add", "p", 1], ["Length", "_raw"]]), 0], ["List", 2, 0], ["List", 2]],
          [
            "If",
            ["Or", ["Equal", "p", ["Length", "_raw"]], ["Equal", at(["Min", ["Add", "p", 1], ["Length", "_raw"]]), 0]],
            ["List", 0],
            ["List"],
          ],
        ],
        "p",
      ),
    ],
    // Read from the end, a node (2) takes the top two finished trees, the first on top. State: [height, the stack's
    // cells from position 2].
    bind(
      "bt_end",
      [
        "Fold",
        [
          "Function",
          // The accumulator is rebound typed: its cells are trees, not integers.
          bind(
            "bt_stack",
            "bt_s",
            bind(
              "bt_height",
              at(1, "bt_stack"),
              [
                "ReplaceAt",
                ["ReplaceAt", "bt_stack", 1, ["Add", ["Subtract", "bt_height", ["At", "bt_word", "j"]], 1]],
                ["Add", ["Subtract", "bt_height", ["At", "bt_word", "j"]], 2],
                [
                  "If",
                  ["Equal", ["At", "bt_word", "j"], 0],
                  0,
                  ["List", ["At", "bt_stack", ["Add", "bt_height", 1]], ["At", "bt_stack", "bt_height"]],
                ],
              ],
              "integer",
            ),
            ANY,
          ),
          "bt_s",
          "j",
        ],
        ["Join", ["List", 0], forEach(["Range", 1, ["Length", "bt_word"], 1], 0, "z")],
        ["Range", ["Length", "bt_word"], 1, -1],
      ],
      at(2, "bt_end"),
      ANY,
    ),
    "list<integer>",
  ),
];

export const LATTICE_PATHS_MAPS: readonly CombinatorialMap[] = [
  {
    name: "ReverseComplement",
    from: "dyck_path",
    to: "dyck_path",
    body: forEach(positions, ["Subtract", 1, at(["Subtract", ["Add", ["Length", "_raw"], 1], "i"])]),
    summary: "The path read backwards, with ups and downs swapped: its mirror image across the vertical.",
    note: "FindStat's \"reverse\" for Dyck paths: reading the steps backwards alone would leave the word's ups and downs unbalanced, so each step is also swapped.",
  },
  {
    name: "BinaryWord",
    convert: true,
    from: "dyck_path",
    to: "binary_word",
    body: "_raw",
    summary: "The Dyck word as a binary word: 1 for an up step, 0 for a down step.",
    findstat: ["Mp00093"],
  },
  {
    name: "TouchComposition",
    from: "dyck_path",
    to: "composition",
    // Heights return to 0 at the touch points; the parts are the halved gaps between them.
    body: bind(
      "touches",
      [
        "Join",
        ["List", 0],
        [
          "Filter",
          ["Range", 1, ["Length", "_raw"], 1],
          ["Function", ["Equal", ["Subtract", ["Multiply", 2, upsThrough("t")], "t"], 0], "t"],
        ],
      ],
      forEach(
        ["Range", 1, ["Subtract", ["Length", "touches"], 1], 1],
        ["Divide", ["Subtract", at(["Add", "q", 1], "touches"), at("q", "touches")], 2],
        "q",
      ),
      "list<integer>",
    ),
    guard: dyckGuard,
    summary: "The semilengths of the primitive pieces between a path's returns to the diagonal.",
  },
  {
    name: "RiseComposition",
    from: "dyck_path",
    to: "composition",
    // A rise starts at an up step that is first, or follows a down step, and runs to the next down step.
    body: bind(
      "starts",
      stepsWhere(1, ["Or", ["Equal", "p", 1], ["Equal", at(["Max", 1, ["Subtract", "p", 1]]), 0]]),
      forEach(
        ["Range", 1, ["Length", "starts"], 1],
        ["Subtract", ["First", stepsWhere(0, true, ["Add", at("q", "starts"), 1])], at("q", "starts")],
        "q",
      ),
      "list<integer>",
    ),
    guard: dyckGuard,
    summary: "The lengths of the maximal runs of up steps, left to right.",
  },
  {
    name: "LalanneKreweras",
    from: "dyck_path",
    to: "dyck_path",
    // An up (down) step is labeled by its rank among the ups (downs). The image's runs of ups are the gaps
    // between the labels of the downs that start a double fall; its runs of downs, the gaps between the
    // labels of the ups that start a double rise; each list opened by 0 and closed by n.
    body: [
      "If",
      ["Equal", ["Length", "_raw"], 0],
      ["List"],
      bind(
        "fallLabels",
        [
          "Join",
          ["List", 0],
          [
            "Map",
            ["Function", ["Subtract", "p", upsThrough("p")], "p"],
            [
              "Filter",
              ["Range", 1, ["Subtract", ["Length", "_raw"], 1], 1],
              ["Function", ["And", ["Equal", at("p"), 0], ["Equal", at(["Add", "p", 1]), 0]], "p"],
            ],
          ],
          ["List", ["Divide", ["Length", "_raw"], 2]],
        ],
        bind(
          "riseLabels",
          [
            "Join",
            ["List", 0],
            [
              "Map",
              ["Function", upsThrough("p"), "p"],
              [
                "Filter",
                ["Range", 1, ["Subtract", ["Length", "_raw"], 1], 1],
                ["Function", ["And", ["Equal", at("p"), 1], ["Equal", at(["Add", "p", 1]), 1]], "p"],
              ],
            ],
            ["List", ["Divide", ["Length", "_raw"], 2]],
          ],
          // Block q is a run of fall[q + 1] - fall[q] ups then rise[q + 1] - rise[q] downs, so step t is an up
          // when it comes after the blocks before q and within q's ups.
          forEach(
            ["Range", 1, ["Length", "_raw"], 1],
            [
              "If",
              [
                "Greater",
                [
                  "Count",
                  [
                    "Filter",
                    ["Range", 1, ["Subtract", ["Length", "fallLabels"], 1], 1],
                    [
                      "Function",
                      [
                        "And",
                        ["Less", ["Add", at("q", "fallLabels"), at("q", "riseLabels")], "t"],
                        ["LessEqual", "t", ["Add", at(["Add", "q", 1], "fallLabels"), at("q", "riseLabels")]],
                      ],
                      "q",
                    ],
                  ],
                ],
                0,
              ],
              1,
              0,
            ],
            "t",
          ),
          "list<integer>",
        ),
        "list<integer>",
      ),
    ],
    guard: dyckGuard,
    summary:
      "The Lalanne-Kreweras involution: labels of the ups and downs that start a double rise or fall, differenced.",
    note: "An involution that swaps the number of peaks with the number of double rises, and area-related statistics with their dual. Mp00120.",
  },
  {
    name: "ZetaMap",
    from: "dyck_path",
    to: "dyck_path",
    // Read the area sequence backwards; for each level from its maximum down to -1, an up step for each
    // entry at that level and a down step for each entry one above it.
    body: [
      "If",
      ["Equal", ["Length", "_raw"], 0],
      ["List"],
      bind(
        "area",
        areaSequence,
        [
          "Flatten",
          [
            "Map",
            [
              "Function",
              [
                "Flatten",
                forEach(
                  ["Range", 1, ["Length", "area"], 1],
                  [
                    "If",
                    ["Equal", at(["Subtract", ["Add", ["Length", "area"], 1], "k"], "area"), "level"],
                    ["List", 1],
                    [
                      "If",
                      ["Equal", at(["Subtract", ["Add", ["Length", "area"], 1], "k"], "area"), ["Add", "level", 1]],
                      ["List", 0],
                      ["List"],
                    ],
                  ],
                  "k",
                ),
              ],
              "level",
            ],
            ["Range", ["Max", "area"], -1, -1],
          ],
        ],
        "list<integer>",
      ),
    ],
    guard: dyckGuard,
    summary: "The zeta map: the area sequence read backwards, level by level from the top, as ups and downs.",
    note: "Sends the bistatistic (area, dinv) to (bounce, area). FindStat's Mp00030; its inverse is Mp00032.",
  },
  {
    name: "BinaryTree",
    convert: true,
    from: "dyck_path",
    to: "binary_tree",
    body: binaryTreeBody,
    guard: dyckGuard,
    summary: "A Dyck path U A D B, cut at its first return, as the binary tree [φ⁻¹(A), φ⁻¹(B)].",
  },
  {
    name: "InverseZetaMap",
    from: "dyck_path",
    to: "dyck_path",
    body: inverseZetaBody,
    guard: dyckGuard,
    summary: "The inverse of the zeta map.",
    note: "FindStat's Mp00032. Built from the area sequence one entry at a time, as FindStat does: each entry wraps a stretch of the path so far.",
  },
  {
    name: "BouncePath",
    from: "dyck_path",
    to: "dyck_path",
    body: bounceBody,
    guard: dyckGuard,
    summary: "The bounce path of a Dyck path, bouncing between the path and the diagonal from the far corner.",
    note: "FindStat's Mp00099, the first half of the zeta map. Idempotent: a bounce path is its own bounce path.",
  },
  {
    name: "DecompositionReverse",
    from: "dyck_path",
    to: "dyck_path",
    // The tree [A, B] of U A D B, mirrored, as a path again. (Not `composedOf`: a composition has no guard
    // to decline the grand paths other families draw.)
    body: decompositionReverseBody,
    guard: dyckGuard,
    summary: "Split a path as U A D B at its first return, and swap the pieces, recursively: U B' D A'.",
    note: "FindStat's Mp00101, an involution. It is the binary tree's left-right symmetry carried across the Dyck-path bijection.",
  },
  {
    name: "PrimeDyckPath",
    from: "dyck_path",
    to: "dyck_path",
    body: ["Join", ["List", 1], "_raw", ["List", 0]],
    guard: dyckGuard,
    summary:
      "The path wrapped in one more up step first and down step last: a path that touches the diagonal only at its ends.",
    note: "FindStat's Mp00199. Injective, one semilength up; the paths it reaches are those with a single return.",
  },
  {
    name: "OrderedTree",
    convert: true,
    from: "dyck_path",
    to: "ordered_tree",
    body: bind("op", "_raw", buildFromDyck("op", ["Length", "_raw"]) as MathJSON, "list<integer>"),
    guard: dyckGuard,
    summary:
      "A Dyck path as the ordered tree whose depth-first contour it is: an up step opens a child, a down step closes it.",
    note: "FindStat's Mp00026. The inverse of DyckPath(OrderedTree).",
    findstat: ["Mp00026"],
  },
  {
    name: "Promotion",
    from: "dyck_path",
    to: "dyck_path",
    body: ["If", ["Equal", ["Length", "_raw"], 0], ["List"], pathOfFirstRow(promotedFirstRow)],
    guard: dyckGuard,
    summary: "Promotion of the Dyck path's two-row standard tableau, read back as a path.",
    note: "FindStat's Mp00142; the inverse is InversePromotion.",
  },
  {
    name: "InversePromotion",
    from: "dyck_path",
    to: "dyck_path",
    body: ["If", ["Equal", ["Length", "_raw"], 0], ["List"], pathOfFirstRow(inversePromotedFirstRow)],
    guard: dyckGuard,
    summary: "Inverse promotion of the Dyck path's two-row standard tableau, read back as a path.",
    note: "FindStat's Mp00143; the inverse is Promotion.",
  },
  {
    name: "PeaksToValleys",
    from: "dyck_path",
    to: "dyck_path",
    body: peaksToValleysBody,
    guard: dyckGuard,
    summary:
      "The path with a valley wherever the original has a peak of height at least 2, each valley two lower than its peak.",
    note: "FindStat's Mp00222, the inverse of rowmotion on Dyck paths as order ideals of the triangular poset.",
  },
  {
    name: "Peeling",
    from: "dyck_path",
    to: "dyck_path",
    body: peelingBody,
    guard: dyckGuard,
    summary: "The path whose area sequence is this one's with its first entry dropped and the rest lowered by two.",
    note: "FindStat's Mp00103, the peeling map. Lossy: it is not injective, and a path of semilength n goes to one of the same semilength.",
  },
  {
    name: "ClockwiseTriangulationRotation",
    from: "dyck_path",
    to: "dyck_path",
    body: clockwiseBody,
    guard: dyckGuard,
    summary: "Rotate the triangulation of the (n + 2)-gon the path stands for one step clockwise.",
    note: "FindStat's Mp00330, the inverse of CounterclockwiseTriangulationRotation. A path is the pre-order walk of the binary tree of the triangulation's faces.",
  },
  {
    name: "CounterclockwiseTriangulationRotation",
    from: "dyck_path",
    to: "dyck_path",
    body: counterclockwiseBody,
    guard: dyckGuard,
    summary: "Rotate the triangulation of the (n + 2)-gon the path stands for one step counterclockwise.",
    note: "FindStat's Mp00331, the inverse of ClockwiseTriangulationRotation.",
  },
];
