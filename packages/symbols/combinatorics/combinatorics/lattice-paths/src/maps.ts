// The one combinatorial map whose `from` carrier is `dyck_path` (step 6c). Its body comes from
// trees' `binary-tree.ts`, which also backs the two maps trees owns itself
// (`../../trees/src/maps.ts`) — the inverse direction of the bijection lives here because a
// map's area is decided by its SOURCE carrier, not the module its body happens to share.

import { at, bind, forEach, type CombinatorialMap, type MathJSON, positions } from "../../src/map-helpers.ts";
import { dyckPathOf, mirrorOf, treeOfDyckPathBody, treeOfDyckPathGuard } from "../../trees/src/binary-tree.ts";

/** The positions 1 .. 2n of `_raw` that hold `letter` (1 up, 0 down) and satisfy `also`. */
const stepsWhere = (letter: number, also: MathJSON = true, from: MathJSON = 1): MathJSON => [
  "Filter",
  ["Range", from, ["Length", "_raw"], 1],
  ["Function", ["And", ["Equal", at("p"), letter], also], "p"],
];

/** How many up steps `_raw` has among its first k steps. */
const upsThrough = (k: MathJSON): MathJSON => [
  "Count",
  ["Filter", ["Range", 1, k, 1], ["Function", ["Equal", at("u"), 1], "u"]],
];

/** Only a Dyck path: as many downs as ups, and no prefix with more downs than ups. The carrier also holds
 *  the grand paths other families draw, which these maps are not defined on. */
const dyckGuard: MathJSON = [
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
];
