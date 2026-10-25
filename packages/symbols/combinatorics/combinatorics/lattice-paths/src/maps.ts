// The one combinatorial map whose `from` carrier is `dyck_path` (step 6c). Its body comes from
// trees' `binary-tree.ts`, which also backs the two maps trees owns itself
// (`../../trees/src/maps.ts`) — the inverse direction of the bijection lives here because a
// map's area is decided by its SOURCE carrier, not the module its body happens to share.

import { at, bind, forEach, type CombinatorialMap, type MathJSON, positions } from "../../src/map-helpers.ts";
import { buildFromDyck } from "../../collections/src/families/nested.ts";
import { inversePromotionRows, promotionRows } from "../../tableaux/src/promotion.ts";
import { dyckPathOf, mirrorOf, treeOfDyckPathBody, treeOfDyckPathGuard } from "../../trees/src/binary-tree.ts";

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
const areaSequence: MathJSON = bind(
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
const twoRowTableau: MathJSON = ["List", positionsOf(1), positionsOf(0)];

/** The Dyck path whose up steps are the entries of the first row of the tableau `table`. */
const pathOfTwoRowTableau = (table: string): MathJSON =>
  forEach(positions, ["If", ["Element", "p", at(1, table)], 1, 0], "p");

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

/** The indices 1 .. n, none when n is 0: the stated step keeps the range from counting down. */
const upTo = (n: MathJSON): MathJSON => ["Range", 1, n, 1];

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
    body: treeOfDyckPathBody,
    guard: treeOfDyckPathGuard,
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
    body: dyckPathOf(mirrorOf(treeOfDyckPathBody)),
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
    body: [
      "If",
      ["Equal", ["Length", "_raw"], 0],
      ["List"],
      bind(
        "pm_tab",
        twoRowTableau,
        bind("pm_image", promotionRows("pm_tab"), pathOfTwoRowTableau("pm_image"), "list<list<integer>>"),
        "list<list<integer>>",
      ),
    ],
    guard: dyckGuard,
    summary: "Promotion of the Dyck path's two-row standard tableau, read back as a path.",
    note: "FindStat's Mp00142; the inverse is InversePromotion.",
  },
  {
    name: "InversePromotion",
    from: "dyck_path",
    to: "dyck_path",
    body: [
      "If",
      ["Equal", ["Length", "_raw"], 0],
      ["List"],
      bind(
        "pm_tab",
        twoRowTableau,
        bind("pm_image", inversePromotionRows("pm_tab"), pathOfTwoRowTableau("pm_image"), "list<list<integer>>"),
        "list<list<integer>>",
      ),
    ],
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
