// Maps from Dyck paths to other carriers (partitions, tableaux, permutations, set partitions, binary
// trees) and the Delest-Viennot family back to Dyck paths. Bodies are over `_raw`, the path's 0/1 steps
// (1 up).

import { at, forEach, lets, type CombinatorialMap, type MathJSON } from "../../src/map-helpers.ts";
import { inverseRsk } from "../../tableaux/src/families/rsk-pairs.ts";
import { krattenthalerPermutationBody } from "./dyck-maps.ts";
import { areaSequence, dyckGuard, twoRowTableau, upsThrough } from "./maps.ts";

const steps: MathJSON = ["Length", "_raw"];
const semilength: MathJSON = ["Divide", steps, 2];
const upTo = (k: MathJSON): MathJSON => ["Range", 1, k, 1];
const isEmpty: MathJSON = ["Equal", steps, 0];

/** Whether the integer expression `x` is odd. */
const odd = (x: MathJSON): MathJSON => ["Equal", ["Mod", x, 2], 1];

/** `count` zeros, as a fresh list (none when `count` is not positive). */
const zeros = (count: MathJSON): MathJSON => forEach(upTo(count), 0, "z");
const ones = (count: MathJSON): MathJSON => forEach(upTo(count), 1, "z");

/** The height of `_raw` after step k. */
const heightAfter = (k: MathJSON): MathJSON => ["Subtract", ["Multiply", 2, upsThrough(k)], k];

/** The positions p in 1 .. 2n - 1 where `_raw` steps `first` and then `second`. */
const turns = (first: number, second: number): MathJSON => [
  "Filter",
  ["Range", 1, ["Subtract", steps, 1], 1],
  ["Function", ["And", ["Equal", at("p"), first], ["Equal", at(["Add", "p", 1]), second]], "p"],
];

/** The polyomino paths `lower` and `upper` (bound names, each of length n + 1) as the Dyck path of the
 *  classical Delest-Viennot bijection: 1 - lower(1), then upper(i + 1) and 1 - lower(i + 1) alternating. */
const delestViennotPath = (lower: string, upper: string): MathJSON =>
  forEach(upTo(steps), [
    "If",
    odd("i"),
    ["Subtract", 1, at(["Divide", ["Add", "i", 1], 2], lower)],
    at(["Add", ["Divide", "i", 2], 1], upper),
  ]);

/** Wherever `where` (increasing positions) holds `value`, and the remaining positions the remaining values
 *  in increasing order: the permutation of 1 .. n named by those entries. */
const fillAround = (where: MathJSON, value: MathJSON): MathJSON =>
  lets(
    [
      ["fa_where", where, "list<integer>"],
      ["fa_value", value, "list<integer>"],
      [
        "fa_free",
        ["Filter", upTo(semilength), ["Function", ["Not", ["Element", "x", "fa_where"]], "x"]],
        "list<integer>",
      ],
      [
        "fa_rest",
        ["Filter", upTo(semilength), ["Function", ["Not", ["Element", "x", "fa_value"]], "x"]],
        "list<integer>",
      ],
    ],
    forEach(
      upTo(semilength),
      [
        "If",
        ["Element", "x", "fa_where"],
        at(["IndexOf", "fa_where", "x"], "fa_value"),
        at(["IndexOf", "fa_free", "x"], "fa_rest"),
      ],
      "x",
    ),
  );

/** Mp00129: a permutation entry at each valley, the number of downs through it, holding the ups through it plus 1. */
const billeyJockuschStanleyBody: MathJSON = [
  "If",
  isEmpty,
  ["List"],
  lets(
    [["bjs_valleys", turns(0, 1), "list<integer>"]],
    fillAround(
      forEach(
        upTo(["Length", "bjs_valleys"]),
        ["Subtract", at("k", "bjs_valleys"), upsThrough(at("k", "bjs_valleys"))],
        "k",
      ),
      forEach(upTo(["Length", "bjs_valleys"]), ["Add", upsThrough(at("k", "bjs_valleys")), 1], "k"),
    ),
  ),
];

/** Mp00025: the area sequence read from the end; each entry picks the value j - area(j) if the area does not
 *  drop by more than one there, else the least remaining value above it. */
const avoiding132Body: MathJSON = [
  "If",
  isEmpty,
  ["List"],
  lets(
    [
      ["av_area", areaSequence, "list<integer>"],
      ["av_n", semilength, "integer"],
    ],
    [
      "At",
      [
        "Fold",
        [
          "Function",
          lets(
            [
              ["av_j", ["Add", ["Subtract", "av_n", "i"], 1], "integer"],
              ["av_next", ["If", ["Equal", "av_j", "av_n"], 0, at(["Add", "av_j", 1], "av_area")], "integer"],
              ["av_t", ["Subtract", "av_j", at("av_j", "av_area")], "integer"],
              ["av_old", ["At", "acc", 1], "list<integer>"],
              ["av_left", ["At", "acc", 2], "list<integer>"],
              [
                "av_v",
                [
                  "If",
                  ["Greater", ["Add", at("av_j", "av_area"), 1], "av_next"],
                  "av_t",
                  ["Min", ["Filter", "av_left", ["Function", ["Greater", "x", "av_t"], "x"]]],
                ],
                "integer",
              ],
            ],
            [
              "Tuple",
              ["Join", "av_old", ["List", "av_v"]],
              ["Filter", "av_left", ["Function", ["Not", ["Equal", "x", "av_v"]], "x"]],
            ],
          ),
          "acc",
          "i",
        ],
        ["Tuple", ["List"], upTo("av_n")],
        upTo("av_n"),
      ],
      1,
    ],
  ),
];

/** Mp00024: the permutation whose RSK pair is the two-row tableaux of the first half of the path (ups on top) and
 *  of the last half read backwards (downs on top), as inverse RSK. */
const avoiding321Body: MathJSON = [
  "If",
  isEmpty,
  ["List"],
  lets(
    [
      [
        "rk_p",
        [
          "Join",
          ["List", ["Filter", upTo(semilength), ["Function", ["Equal", at("p"), 1], "p"]]],
          [
            "If",
            ["Greater", ["Count", ["Filter", upTo(semilength), ["Function", ["Equal", at("p"), 0], "p"]]], 0],
            ["List", ["Filter", upTo(semilength), ["Function", ["Equal", at("p"), 0], "p"]]],
            ["List"],
          ],
        ],
        "list<list<integer>>",
      ],
      [
        "rk_q",
        [
          "Join",
          [
            "List",
            ["Filter", upTo(semilength), ["Function", ["Equal", at(["Subtract", ["Add", steps, 1], "k"]), 0], "k"]],
          ],
          [
            "If",
            [
              "Greater",
              [
                "Count",
                ["Filter", upTo(semilength), ["Function", ["Equal", at(["Subtract", ["Add", steps, 1], "k"]), 1], "k"]],
              ],
              0,
            ],
            [
              "List",
              ["Filter", upTo(semilength), ["Function", ["Equal", at(["Subtract", ["Add", steps, 1], "k"]), 1], "k"]],
            ],
            ["List"],
          ],
        ],
        "list<list<integer>>",
      ],
    ],
    inverseRsk("rk_p", "rk_q", semilength) as MathJSON,
  ),
];

/** Mp00031: from the identity, each area-sequence entry a_j swaps the neighbours at positions j, j + 1, then
 *  j - 1, j, and so on down, a_j swaps in all. */
const avoiding312Body: MathJSON = [
  "If",
  isEmpty,
  ["List"],
  lets(
    [
      ["bk_area", areaSequence, "list<integer>"],
      [
        "bk_swaps",
        [
          "Flatten",
          forEach(
            upTo(semilength),
            forEach(upTo(at("j", "bk_area")), ["Subtract", ["Subtract", "j", 1], ["Subtract", "r", 1]], "r"),
            "j",
          ),
        ],
        "list<integer>",
      ],
    ],
    [
      "Fold",
      [
        "Function",
        forEach(
          upTo(semilength),
          [
            "If",
            ["Equal", "q", "s"],
            at(["Add", "s", 1], "w"),
            ["If", ["Equal", "q", ["Add", "s", 1]], at("s", "w"), at("q", "w")],
          ],
          "q",
        ),
        "w",
        "s",
      ],
      upTo(semilength),
      "bk_swaps",
    ],
  ),
];

/** The Dyck path's down steps matched to up steps by the tunnels, and the maximal run of downs each lies in:
 *  Biane's noncrossing partition puts into one block the ups whose downs share a run. */
const noncrossingPartitionBody: MathJSON = [
  "If",
  isEmpty,
  ["List"],
  lets(
    [
      ["nc_ups", ["Filter", upTo(steps), ["Function", ["Equal", at("p"), 1], "p"]], "list<integer>"],
      ["nc_peaks", turns(1, 0), "list<integer>"],
      ["nc_h", forEach(upTo(steps), heightAfter("k"), "k"), "list<integer>"],
      [
        // The down closing the j-th up: the first later step back at the height before it.
        "nc_close",
        forEach(
          upTo(semilength),
          [
            "Min",
            [
              "Filter",
              ["Range", ["Add", at("j", "nc_ups"), 1], steps, 1],
              ["Function", ["Equal", at("q", "nc_h"), ["Subtract", at(at("j", "nc_ups"), "nc_h"), 1]], "q"],
            ],
          ],
          "j",
        ),
        "list<integer>",
      ],
      [
        // Its run: the peaks before it.
        "nc_run",
        forEach(
          upTo(semilength),
          ["Count", ["Filter", "nc_peaks", ["Function", ["Less", "k", at("j", "nc_close")], "k"]]],
          "j",
        ),
        "list<integer>",
      ],
      [
        "nc_blocks",
        forEach(
          upTo(["Length", "nc_peaks"]),
          ["Filter", upTo(semilength), ["Function", ["Equal", at("j", "nc_run"), "r"], "j"]],
          "r",
        ),
        "list<list<integer>>",
      ],
    ],
    [
      "Map",
      [
        "Function",
        ["At", "nc_blocks", ["IndexWhere", "nc_blocks", ["Function", ["Equal", ["At", "b", 1], "m"], "b"]]],
        "m",
      ],
      ["Sort", ["Map", ["Function", ["At", "b", 1], "b"], "nc_blocks"]],
    ],
  ),
];

/** The peak heights and the valley heights plus one (0 at each end), the data of the Delest-Viennot column
 *  heights: column i is a_i tall, starting b_i above the bottom. */
const peakData = (body: MathJSON): MathJSON =>
  lets(
    [
      ["dv_peaks", turns(1, 0), "list<integer>"],
      ["dv_valleys", turns(0, 1), "list<integer>"],
      ["dv_a", forEach(upTo(["Length", "dv_peaks"]), heightAfter(at("k", "dv_peaks")), "k"), "list<integer>"],
      [
        "dv_b",
        [
          "Join",
          ["List", 0],
          forEach(upTo(["Length", "dv_valleys"]), ["Add", heightAfter(at("k", "dv_valleys")), 1], "k"),
          ["List", 0],
        ],
        "list<integer>",
      ],
    ],
    body,
  );

/** The two polyomino paths of columns (a, b) and the Dyck path of Mp00229. */
const delestViennotBody: MathJSON = [
  "If",
  isEmpty,
  ["List"],
  peakData(
    lets(
      [
        [
          "dv_lower",
          [
            "Flatten",
            forEach(
              upTo(["Length", "dv_a"]),
              ["Join", zeros(["Subtract", at("i", "dv_a"), at("i", "dv_b")]), ["List", 1]],
              "i",
            ),
          ],
          "list<integer>",
        ],
        [
          "dv_upper",
          [
            "Flatten",
            forEach(
              upTo(["Length", "dv_a"]),
              ["Join", ["List", 1], zeros(["Subtract", at("i", "dv_a"), at(["Add", "i", 1], "dv_b")])],
              "i",
            ),
          ],
          "list<integer>",
        ],
      ],
      delestViennotPath("dv_lower", "dv_upper"),
    ),
  ),
];

/** The number of 0s before each 1 of the word `w` (a bound name of length m): Sage's `_prefix_lengths(w, 0)`. */
const zerosBeforeEachOne = (w: string): MathJSON =>
  forEach(
    ["Filter", upTo(["Length", w]), ["Function", ["Equal", at("q", w), 1], "q"]],
    ["Count", ["Filter", upTo("q"), ["Function", ["Equal", at("t", w), 0], "t"]]],
    "q",
  );

/** Mp00227: the polyomino of the Dyck path, its column heights a and upper heights u, then the path with
 *  a_i - b_i ups and a_i - b_(i+1) downs per column, b_i = a_(i-1) - u_i + u_(i-1) - 1. */
const inverseDelestViennotBody: MathJSON = [
  "If",
  isEmpty,
  ["List"],
  lets(
    [
      ["iv_l", ["Join", ["List", 1], "_raw", ["List", 0]], "list<integer>"],
      [
        "iv_up",
        forEach(upTo(["Add", semilength, 1]), at(["Subtract", ["Multiply", 2, "k"], 1], "iv_l"), "k"),
        "list<integer>",
      ],
      [
        "iv_down",
        forEach(upTo(["Add", semilength, 1]), ["Subtract", 1, at(["Multiply", 2, "k"], "iv_l")], "k"),
        "list<integer>",
      ],
      ["iv_lh", zerosBeforeEachOne("iv_down"), "list<integer>"],
      ["iv_uh", zerosBeforeEachOne("iv_up"), "list<integer>"],
      [
        "iv_a",
        forEach(
          upTo(["Min", ["Length", "iv_lh"], ["Length", "iv_uh"]]),
          ["Subtract", at("k", "iv_lh"), at("k", "iv_uh")],
          "k",
        ),
        "list<integer>",
      ],
      [
        "iv_b",
        [
          "Join",
          ["List", 0],
          forEach(
            upTo(["Subtract", ["Length", "iv_a"], 1]),
            ["Subtract", ["Add", ["Subtract", at("k", "iv_a"), at(["Add", "k", 1], "iv_uh")], at("k", "iv_uh")], 1],
            "k",
          ),
          ["List", 0],
        ],
        "list<integer>",
      ],
    ],
    [
      "Flatten",
      forEach(
        upTo(["Length", "iv_a"]),
        [
          "Flatten",
          [
            "List",
            ones(["Subtract", at("k", "iv_a"), at("k", "iv_b")]),
            zeros(["Subtract", at("k", "iv_a"), at(["Add", "k", 1], "iv_b")]),
          ],
        ],
        "k",
      ),
    ],
  ),
];

/** Mp00228: the polyomino reflected in the diagonal swaps each adjacent pair of steps from the second. */
const reflectedBody: MathJSON = forEach(upTo(steps), [
  "If",
  ["Or", ["Equal", "i", 1], ["Equal", "i", steps]],
  at("i"),
  ["If", ["Equal", ["Mod", "i", 2], 0], at(["Add", "i", 1]), at(["Subtract", "i", 1])],
]);

/** Mp00027: the partition whose parts are the numbers of downs before each up step, from the last up step. */
const cutOutBody: MathJSON = lets(
  [["co_ups", ["Filter", upTo(steps), ["Function", ["Equal", at("p"), 1], "p"]], "list<integer>"]],
  [
    "Filter",
    forEach(
      upTo(semilength),
      ["Subtract", at(["Subtract", ["Add", semilength, 1], "j"], "co_ups"), ["Subtract", ["Add", semilength, 1], "j"]],
      "j",
    ),
    ["Function", ["Greater", "x", 0], "x"],
  ],
);

/** Mp00033: the positions of the ups, then those of the downs. */
const twoRowBody: MathJSON = ["If", isEmpty, ["List"], twoRowTableau];

/** Mp00023, one peeling of Stump's bijection on the area sequence `area` (a bound name of length n >= 2): the touch
 *  points, as the lists of positions whose entries rotate together, and the pending touches. */
const peeledCycles = (area: string): MathJSON =>
  lets(
    [
      [
        "pl_scan",
        [
          "Fold",
          [
            "Function",
            lets(
              [
                ["pl_touches", at(1, "acc"), "list<integer>"],
                ["pl_cycles", at(2, "acc"), "list<list<integer>>"],
                ["pl_next", at(["Add", "k", 1], area), "integer"],
                ["pl_with", ["Join", at(1, "acc"), ["List", "k"]], "list<integer>"],
              ],
              [
                "If",
                ["Equal", "pl_next", 0],
                [
                  "If",
                  ["Greater", ["Length", "pl_with"], 1],
                  ["Tuple", ["List"], ["Join", "pl_cycles", ["List", "pl_with"]]],
                  [
                    "If",
                    ["Equal", at("k", area), 0],
                    ["Tuple", ["List"], "pl_cycles"],
                    ["Tuple", "pl_with", "pl_cycles"],
                  ],
                ],
                ["If", ["Equal", "pl_next", 1], ["Tuple", "pl_with", "pl_cycles"], "acc"],
              ],
            ),
            "acc",
            "k",
          ],
          ["Tuple", ["List"], ["List"]],
          ["Range", 1, ["Subtract", ["Length", area], 1], 1],
        ],
      ],
    ],
    // The last position closes a cycle when its entry is positive and a touch is pending.
    [
      "If",
      ["And", ["Greater", at(["Length", area], area), 0], ["Greater", ["Length", at(1, "pl_scan")], 0]],
      ["Join", at(2, "pl_scan"), ["List", ["Join", at(1, "pl_scan"), ["List", ["Length", area]]]]],
      at(2, "pl_scan"),
    ],
  );

/** Mp00023: Stump's bijection. A round peels the area sequence and rotates the entries at each touch cycle one
 *  place; a round with no cycles leaves the state alone, so n rounds run past the last. */
const noncrossingPermutationBody: MathJSON = [
  "If",
  isEmpty,
  ["List"],
  [
    "If",
    ["Equal", steps, 2],
    ["List", 1],
    at(2, [
      "Fold",
      [
        "Function",
        lets(
          [
            ["nc_area", at(1, "acc"), "list<integer>"],
            ["nc_pi", at(2, "acc"), "list<integer>"],
            ["nc_cycles", peeledCycles("nc_area"), "list<list<integer>>"],
          ],
          [
            "If",
            ["Equal", ["Length", "nc_cycles"], 0],
            "acc",
            [
              "Tuple",
              forEach(
                upTo(semilength),
                ["If", ["Equal", "j", semilength], 0, ["Max", ["Subtract", at(["Add", "j", 1], "nc_area"), 2], 0]],
                "j",
              ),
              [
                "Fold",
                [
                  "Function",
                  forEach(
                    upTo(semilength),
                    [
                      "If",
                      ["Element", "j", at("c", "nc_cycles")],
                      at(
                        at(
                          [
                            "If",
                            ["Equal", ["IndexOf", at("c", "nc_cycles"), "j"], ["Length", at("c", "nc_cycles")]],
                            1,
                            ["Add", ["IndexOf", at("c", "nc_cycles"), "j"], 1],
                          ],
                          at("c", "nc_cycles"),
                        ),
                        "ring",
                      ),
                      at("j", "ring"),
                    ],
                    "j",
                  ),
                  "ring",
                  "c",
                ],
                "nc_pi",
                upTo(["Length", "nc_cycles"]),
              ],
            ],
          ],
        ),
        "acc",
        "r",
      ],
      ["Tuple", areaSequence, upTo(semilength)],
      upTo(semilength),
    ]),
  ],
];

/** The positions of `_raw` whose step is `letter`. */
const stepPositions = (letter: number): MathJSON => [
  "Filter",
  upTo(steps),
  ["Function", ["Equal", at("p"), letter], "p"],
];

/** The last 1 in row `row` of the Ringel matrix, from the bound list `rg_hi` (rows past the last stay put). */
const lastOneIn = (row: MathJSON): MathJSON => at(["Add", ["Min", row, "rg_n"], 1], "rg_hi");

/** Mp00201's omega, on the pair (row, column): to (column + 1, the last 1 of the row, or n when the column is
 *  already beyond it). */
const omegaRow = (column: MathJSON): MathJSON => ["Add", column, 1];
const omegaColumn = (column: MathJSON, row: MathJSON): MathJSON => [
  "If",
  ["Greater", column, lastOneIn(row)],
  "rg_n",
  lastOneIn(row),
];

/** One round of the walk on the state (injective row and column, simple row and column, answer or -1). */
const ringelStep: MathJSON = [
  "Function",
  lets(
    [
      ["rg_ir", at(1, "acc"), "integer"],
      ["rg_ic", at(2, "acc"), "integer"],
      ["rg_sr", at(3, "acc"), "integer"],
      ["rg_sc", at(4, "acc"), "integer"],
      ["rg_ar", omegaRow("rg_ic"), "integer"],
      ["rg_ac", omegaColumn("rg_ic", "rg_ir"), "integer"],
      ["rg_br", omegaRow("rg_ac"), "integer"],
      ["rg_bc", omegaColumn("rg_ac", "rg_ar"), "integer"],
      ["rg_cr", omegaRow("rg_sc"), "integer"],
      ["rg_cc", omegaColumn("rg_sc", "rg_sr"), "integer"],
      ["rg_dr", omegaRow("rg_cc"), "integer"],
      ["rg_dc", omegaColumn("rg_cc", "rg_cr"), "integer"],
    ],
    [
      "If",
      ["GreaterEqual", at(5, "acc"), 0],
      "acc",
      [
        "If",
        ["Equal", lastOneIn("rg_ir"), "rg_ic"],
        ["Tuple", "rg_ir", "rg_ic", "rg_sr", "rg_sc", "rg_ir"],
        [
          "If",
          ["Equal", lastOneIn("rg_cr"), "rg_cc"],
          ["Tuple", "rg_br", "rg_bc", "rg_cr", "rg_cc", "rg_cr"],
          ["Tuple", "rg_br", "rg_bc", "rg_dr", "rg_dc", -1],
        ],
      ],
    ],
  ),
  "acc",
  "t",
];

/** The state a walk for the number of downs `i` starts from. */
const ringelStart = (): MathJSON => ["Tuple", at(["Add", "i", 1], "rg_lo"), "i", "i", "i", -1];

/**
 * Mp00201: the Ringel permutation of the Nakayama algebra of the path, after Sage's code on the matrix with a 1 at
 * (downs, ups) at every lattice point of the path. Row i holds its 1s from `ups` to `hi_i` and column j its 1s from
 * `lo_j`, so the walk of the code needs only those: it moves a pair (row, column) by (column + 1, the last 1 of the
 * row, or n when the column is past it) until the pair sits on a row's last 1, and the answer is its row, plus 1.
 */
const ringelBody: MathJSON = [
  "If",
  isEmpty,
  ["List", 1],
  lets(
    [
      ["rg_n", semilength, "integer"],
      ["rg_up", stepPositions(1), "list<integer>"],
      ["rg_down", stepPositions(0), "list<integer>"],
      // The most ups at each number of downs (index downs + 1), and the fewest downs at each number of ups.
      [
        "rg_hi",
        ["Join", forEach(upTo("rg_n"), ["Subtract", at("k", "rg_down"), "k"], "k"), ["List", "rg_n"]],
        "list<integer>",
      ],
      [
        "rg_lo",
        ["Join", ["List", 0], forEach(upTo("rg_n"), ["Subtract", at("k", "rg_up"), "k"], "k")],
        "list<integer>",
      ],
    ],
    forEach(
      ["Range", 0, "rg_n", 1],
      ["Add", at(5, ["Fold", ringelStep, ringelStart(), upTo(["Add", "rg_n", 1])]), 1],
      "i",
    ),
  ),
];

export const DYCK_CONVERSION_MAPS: readonly CombinatorialMap[] = [
  {
    name: "CutOutPartition",
    from: "dyck_path",
    to: "integer_partition",
    body: cutOutBody,
    guard: dyckGuard,
    summary:
      "The partition cut out of the staircase by the path: part i is the number of downs before the (n + 1 - i)-th up step.",
    note: 'FindStat\'s Mp00027, "to partition". Injective: its image is the partitions inside the staircase (n-1, ..., 1).',
  },
  {
    name: "TwoRowTableau",
    from: "dyck_path",
    to: "standard_tableau",
    body: twoRowBody,
    guard: dyckGuard,
    summary:
      "The standard tableau of shape (n, n) with the positions of the up steps in its first row and of the down steps in its second.",
    note: "FindStat's Mp00033. Injective; the same tableau Promotion and InversePromotion act on.",
  },
  {
    name: "KrattenthalerPermutation",
    from: "dyck_path",
    to: "permutation",
    body: krattenthalerPermutationBody,
    guard: dyckGuard,
    summary: "The 321-avoiding permutation whose left-to-right maxima are the path's peaks: Krattenthaler's bijection.",
    note: "FindStat's Mp00119. The value at a peak is the ups so far and its position the downs so far plus one; the other values fill the other positions increasingly. The first step of KnuthKrattenthaler.",
  },
  {
    name: "BilleyJockuschStanleyPermutation",
    from: "dyck_path",
    to: "permutation",
    body: billeyJockuschStanleyBody,
    guard: dyckGuard,
    summary:
      "The 321-avoiding permutation with entry (ups through a valley) + 1 at the position of its downs through that valley: the Billey-Jockusch-Stanley bijection.",
    note: "FindStat's Mp00129. The other entries fill the remaining positions increasingly. Injective: it reaches the 321-avoiding permutations.",
  },
  {
    name: "Avoiding132Permutation",
    from: "dyck_path",
    to: "permutation",
    body: avoiding132Body,
    guard: dyckGuard,
    summary:
      "The 132-avoiding permutation of Krattenthaler's bijection, built from the path's area sequence read from the end.",
    note: "FindStat's Mp00025, Sage's to_132_avoiding_permutation. Injective.",
  },
  {
    name: "Avoiding321Permutation",
    from: "dyck_path",
    to: "permutation",
    body: avoiding321Body,
    guard: dyckGuard,
    summary:
      "The 321-avoiding permutation whose RSK pair is the pair of two-row tableaux read off the first and last halves of the path.",
    note: "FindStat's Mp00024. It sends centered tunnels to fixed points and the semilength plus the height of the middle point to twice the longest increasing subsequence. Injective. Interpreted: inverse RSK has no compiled form yet.",
  },
  {
    name: "Avoiding312Permutation",
    from: "dyck_path",
    to: "permutation",
    body: avoiding312Body,
    guard: dyckGuard,
    summary:
      "The 312-avoiding permutation of Bandlow and Killpatrick: from the identity, each area-sequence entry swaps neighbouring positions that many times.",
    note: "FindStat's Mp00031. It sends the area to the number of inversions. Injective.",
  },
  {
    name: "NoncrossingPartition",
    from: "dyck_path",
    to: "set_partition",
    body: noncrossingPartitionBody,
    guard: dyckGuard,
    summary:
      "Biane's noncrossing set partition: the up steps whose matching downs lie in one run of downs form a block.",
    note: "FindStat's Mp00138. Injective: it reaches exactly the noncrossing partitions.",
  },
  {
    name: "TamariBinaryTree",
    from: "dyck_path",
    to: "binary_tree",
    composedOf: ["Mirror", "BinaryTree", "ReverseComplement"],
    summary:
      "A path D = L U R D as the binary tree whose left and right subtrees are those of L and R: the bijection compatible with the Tamari order.",
    note: "FindStat's Mp00029; TamariDyckPath is its inverse. BinaryTree(DyckPath) reads the other decomposition, U L D R, so this is it after a reverse-complement and a left-right mirror.",
  },
  {
    name: "DelestViennot",
    from: "dyck_path",
    to: "dyck_path",
    body: delestViennotBody,
    guard: dyckGuard,
    summary:
      "The Dyck path of the parallelogram polyomino whose columns are as tall as the path's peaks, by the classical bijection.",
    note: "FindStat's Mp00229: the Delest-Viennot bijection from Dyck paths to parallelogram polyominoes, then the classical bijection from polyominoes back to paths. The inverse is InverseDelestViennot.",
  },
  {
    name: "InverseDelestViennot",
    from: "dyck_path",
    to: "dyck_path",
    body: inverseDelestViennotBody,
    guard: dyckGuard,
    summary:
      "The path whose peaks are the polyomino's columns, for the polyomino the classical bijection gives this path.",
    note: 'FindStat\'s Mp00227, "Delest-Viennot-inverse": the inverse of DelestViennot.',
  },
  {
    name: "ReflectParallelogramPolyomino",
    from: "dyck_path",
    to: "dyck_path",
    body: reflectedBody,
    guard: dyckGuard,
    summary:
      "Reflect the path's parallelogram polyomino across the diagonal, so the first column becomes the first row.",
    note: "FindStat's Mp00228, an involution: it swaps each adjacent pair of steps from the second step on.",
  },
  {
    name: "NoncrossingPermutation",
    from: "dyck_path",
    to: "permutation",
    body: noncrossingPermutationBody,
    guard: dyckGuard,
    summary:
      "The noncrossing permutation Stump's bijection gives the path: the cycles of its touch points, peeled off round by round.",
    note: "FindStat's Mp00023, Sage's to_noncrossing_permutation. Injective: its image is the noncrossing permutations. It sends the area to the number of inversions.",
  },
  {
    name: "Ringel",
    from: "dyck_path",
    to: "permutation",
    body: ringelBody,
    guard: dyckGuard,
    summary: "The Ringel permutation of the Nakayama algebra whose Kupisch series the path gives, one size up.",
    note: "FindStat's Mp00201, after Ringel's The finitistic dimension of a Nakayama algebra. Injective, into the permutations of n + 1.",
  },
];
