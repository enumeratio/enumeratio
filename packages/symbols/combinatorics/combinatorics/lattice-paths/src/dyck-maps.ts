// More combinatorial maps from Dyck paths to Dyck paths: the inverse Kreweras complement, the
// Knuth-Krattenthaler bijection and the Elizalde-Rubey involution. Bodies are over `_raw`, the
// path's 0/1 steps (1 up).

import { at, bind, forEach, lets, type CombinatorialMap, type MathJSON } from "../../src/map-helpers.ts";
import { rskPair } from "../../tableaux/src/tableau.ts";
import { dyckGuard, upsThrough } from "./maps.ts";

const steps: MathJSON = ["Length", "_raw"];
const upTo = (k: MathJSON): MathJSON => ["Range", 1, k, 1];

/** `expr` with the symbol `from` named `to`. */
const renamed = (expr: MathJSON, from: string, to: string): MathJSON =>
  Array.isArray(expr) ? expr.map((part) => renamed(part, from, to)) : expr === from ? to : expr;

/**
 * The inverse Kreweras complement, with the path as a noncrossing partition (the down steps after the i-th up
 * step are the block whose largest element is i, the elements being the up steps they close). Its permutation
 * sends each element to the next in its block, cyclically; the complement is that composed with the long cycle,
 * and the image's blocks are the cycles of π⁻¹ after c: i goes to the previous element of the block of i + 1.
 */
const inverseKrewerasComplementBody: MathJSON = [
  "If",
  ["Equal", steps, 0],
  ["List"],
  bind(
    "kc_m",
    ["Divide", steps, 2],
    bind(
      "kc_ups",
      ["Filter", upTo(steps), ["Function", ["Equal", at("p"), 1], "p"]],
      bind(
        // Height after step p.
        "kc_h",
        forEach(upTo(steps), ["Subtract", ["Multiply", 2, upsThrough("p")], "p"], "p"),
        bind(
          // The block of up step j: the number of ups before the down step closing it.
          "kc_key",
          forEach(
            upTo("kc_m"),
            [
              "Divide",
              [
                "Add",
                ["Subtract", at(at("j", "kc_ups"), "kc_h"), 1],
                [
                  "Min",
                  [
                    "Filter",
                    upTo(steps),
                    [
                      "Function",
                      [
                        "And",
                        ["Greater", "q", at("j", "kc_ups")],
                        ["Equal", at("q", "kc_h"), ["Subtract", at(at("j", "kc_ups"), "kc_h"), 1]],
                      ],
                      "q",
                    ],
                  ],
                ],
              ],
              2,
            ],
            "j",
          ),
          bind(
            // ρ(i): the previous element, in its block, of i + 1 (cyclically).
            "kc_rho",
            forEach(
              upTo("kc_m"),
              bind(
                "kc_x",
                ["Add", ["Mod", "i", "kc_m"], 1],
                bind(
                  "kc_before",
                  [
                    "Filter",
                    upTo("kc_m"),
                    [
                      "Function",
                      ["And", ["Equal", at("e", "kc_key"), at("kc_x", "kc_key")], ["Less", "e", "kc_x"]],
                      "e",
                    ],
                  ],
                  [
                    "If",
                    ["Greater", ["Length", "kc_before"], 0],
                    ["Max", "kc_before"],
                    [
                      "Max",
                      ["Filter", upTo("kc_m"), ["Function", ["Equal", at("e", "kc_key"), at("kc_x", "kc_key")], "e"]],
                    ],
                  ],
                  "list<integer>",
                ),
                "integer",
              ),
              "i",
            ),
            [
              "Flatten",
              forEach(
                upTo("kc_m"),
                bind(
                  "kc_cycle",
                  [
                    "Union",
                    forEach(upTo("kc_m"), ["Fold", ["Function", at("a", "kc_rho"), "a", "b"], "i", upTo("k")], "k"),
                  ],
                  [
                    "Join",
                    ["List", 1],
                    [
                      "If",
                      ["Equal", "i", ["Max", "kc_cycle"]],
                      forEach(upTo(["Length", "kc_cycle"]), 0, "z"),
                      ["List"],
                    ],
                  ],
                  "set<integer>",
                ),
                "i",
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
    "integer",
  ),
];

/**
 * Knuth-Krattenthaler: the 321-avoiding permutation whose left-to-right maxima are the path's peaks (the value
 * at a peak is the ups so far, its position the downs so far plus one; the other values fill the other positions
 * increasingly), its RSK pair of two-row tableaux, and the path with ups at the first row of P and at 2m + 1 - q
 * for q in the second row of Q.
 */
const krattenthalerThen = (next: MathJSON): MathJSON => [
  "If",
  ["Equal", steps, 0],
  ["List"],
  bind(
    "kk_peaks",
    [
      "Filter",
      ["Range", 1, ["Subtract", steps, 1], 1],
      ["Function", ["And", ["Equal", at("p"), 1], ["Equal", at(["Add", "p", 1]), 0]], "p"],
    ],
    bind(
      // Position (downs so far + 1) and value (ups so far) of each left-to-right maximum.
      "kk_where",
      forEach(
        upTo(["Length", "kk_peaks"]),
        ["Add", ["Subtract", at("k", "kk_peaks"), upsThrough(at("k", "kk_peaks"))], 1],
        "k",
      ),
      bind(
        "kk_value",
        forEach(upTo(["Length", "kk_peaks"]), upsThrough(at("k", "kk_peaks")), "k"),
        bind(
          "kk_free",
          ["Filter", upTo(["Divide", steps, 2]), ["Function", ["Not", ["Element", "x", "kk_where"]], "x"]],
          bind(
            "kk_rest",
            ["Filter", upTo(["Divide", steps, 2]), ["Function", ["Not", ["Element", "x", "kk_value"]], "x"]],
            bind(
              "kk_pi",
              forEach(
                upTo(["Divide", steps, 2]),
                [
                  "If",
                  ["Element", "x", "kk_where"],
                  at(["IndexOf", "kk_where", "x"], "kk_value"),
                  at(["IndexOf", "kk_free", "x"], "kk_rest"),
                ],
                "x",
              ),
              next,
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
];

const knuthKrattenthalerBody: MathJSON = krattenthalerThen(
  bind(
    "kk_pq",
    renamed(rskPair, "_raw", "kk_pi"),
    forEach(
      upTo(steps),
      [
        "If",
        [
          "Or",
          ["Element", "p", at(1, at(1, "kk_pq"))],
          [
            "And",
            ["Greater", ["Length", at(2, "kk_pq")], 1],
            ["Element", ["Subtract", ["Add", steps, 1], "p"], at(2, at(2, "kk_pq"))],
          ],
        ],
        1,
        0,
      ],
      "p",
    ),
    "list<list<list<integer>>>",
  ),
);

/** Mp00119: the 321-avoiding permutation whose left-to-right maxima are the path's peaks. */
export const krattenthalerPermutationBody: MathJSON = krattenthalerThen("kk_pi");

/** One phi step of Elizalde-Rubey on the path `dy` (a bound name): the first of the last descent's downs moves
 *  back to just before the point where the last descent, taken with the steps after it, stops exceeding the ups by
 *  more than `slack` (1 to lengthen the returns, 0 for the inverse). */
const lastDescentStep = (inverse: boolean): MathJSON =>
  bind(
    "er_n",
    ["Length", "dy"],
    bind(
      // The last up step.
      "er_a",
      ["Max", ["Filter", upTo("er_n"), ["Function", ["Equal", at("p", "dy"), 1], "p"]]],
      bind(
        // The longest suffix of the steps up to the last up that, with the last descent, is balanced enough.
        "er_r",
        [
          "Max",
          [
            "Filter",
            upTo("er_a"),
            [
              "Function",
              [
                "LessEqual",
                [
                  "Subtract",
                  [
                    "Add",
                    ["Subtract", "er_n", "er_a"],
                    ["Count", ["Filter", ["Range", "r", "er_a", 1], ["Function", ["Equal", at("q", "dy"), 0], "q"]]],
                  ],
                  ["Count", ["Filter", ["Range", "r", "er_a", 1], ["Function", ["Equal", at("q", "dy"), 1], "q"]]],
                ],
                inverse ? 0 : 1,
              ],
              "r",
            ],
          ],
        ],
        forEach(
          upTo("er_n"),
          inverse
            ? [
                // Drop the down before the suffix and lengthen the last descent.
                "If",
                ["Less", "t", ["Subtract", "er_r", 1]],
                at("t", "dy"),
                [
                  "If",
                  ["Less", "t", "er_a"],
                  at(["Add", "t", 1], "dy"),
                  ["If", ["Equal", "t", "er_a"], 0, at("t", "dy")],
                ],
              ]
            : [
                // Move the first down of the last descent back before the suffix.
                "If",
                ["Less", "t", "er_r"],
                at("t", "dy"),
                [
                  "If",
                  ["Equal", "t", "er_r"],
                  0,
                  ["If", ["LessEqual", "t", ["Add", "er_a", 1]], at(["Subtract", "t", 1], "dy"), at("t", "dy")],
                ],
              ],
          "t",
        ),
        "integer",
      ),
      "integer",
    ),
    "integer",
  );

/** The returns to the diagonal. */
const returns: MathJSON = [
  "Count",
  ["Filter", upTo(steps), ["Function", ["Equal", ["Multiply", 2, upsThrough("t")], "t"], "t"]],
];
/** The length of the last descent. */
const lastDescent: MathJSON = [
  "Subtract",
  steps,
  ["Max", ["Filter", upTo(steps), ["Function", ["Equal", at("p"), 1], "p"]]],
];

const swapReturnsAndLastDescentBody: MathJSON = [
  "If",
  ["Equal", steps, 0],
  ["List"],
  bind(
    "er_bottom",
    returns,
    bind(
      "er_top",
      lastDescent,
      [
        "If",
        ["Greater", "er_bottom", "er_top"],
        ["Fold", ["Function", lastDescentStep(true), "dy", "w"], "_raw", upTo(["Subtract", "er_bottom", "er_top"])],
        [
          "If",
          ["Greater", "er_top", "er_bottom"],
          ["Fold", ["Function", lastDescentStep(false), "dy", "w"], "_raw", upTo(["Subtract", "er_top", "er_bottom"])],
          "_raw",
        ],
      ],
      "integer",
    ),
    "integer",
  ),
];

/** The Dyck path rotated, reading `_raw` appended with a down step backwards: the one rotation that is a Dyck word
 *  followed by a down step, found as the first place the walk's height is least, with that last step dropped. */
const coriLeBorgneBody: MathJSON = bind(
  "cl_rev",
  forEach(upTo(["Add", steps, 1]), ["If", ["Equal", "k", 1], 0, at(["Subtract", ["Add", steps, 2], "k"])], "k"),
  bind(
    "cl_heights",
    // Height after j steps of the reversed word, j = 0 .. 2n.
    forEach(
      ["Range", 0, steps, 1],
      [
        "Subtract",
        [
          "Multiply",
          2,
          [
            "Count",
            [
              "Filter",
              upTo(["Add", steps, 1]),
              ["Function", ["And", ["LessEqual", "k", "j"], ["Equal", at("k", "cl_rev"), 1]], "k"],
            ],
          ],
        ],
        "j",
      ],
      "j",
    ),
    bind(
      "cl_start",
      [
        "Min",
        [
          "Filter",
          ["Range", 0, steps, 1],
          ["Function", ["Equal", at(["Add", "j", 1], "cl_heights"), ["Min", "cl_heights"]], "j"],
        ],
      ],
      forEach(
        upTo(steps),
        at(["Add", ["Mod", ["Add", "cl_start", ["Subtract", "t", 1]], ["Add", steps, 1]], 1], "cl_rev"),
        "t",
      ),
      "integer",
    ),
    "list<integer>",
  ),
  "list<integer>",
);

/** Each step takes the next place in the order 1, 2n, 2, 2n - 1, ..., and is an up step when its partner in the
 *  matching of the path's up steps with their downs comes later in that order. */
const elizaldeDeutschBody: MathJSON = bind(
  "ed_heights",
  forEach(upTo(steps), ["Subtract", ["Multiply", 2, upsThrough("p")], "p"], "p"),
  bind(
    "ed_partner",
    forEach(
      upTo(steps),
      [
        "If",
        ["Equal", at("p"), 1],
        [
          "Min",
          [
            "Filter",
            ["Range", ["Add", "p", 1], steps, 1],
            ["Function", ["Equal", at("q", "ed_heights"), ["Subtract", at("p", "ed_heights"), 1]], "q"],
          ],
        ],
        [
          "Max",
          [
            "Filter",
            upTo(steps),
            [
              "Function",
              [
                "And",
                ["Less", "q", "p"],
                ["Equal", at("q"), 1],
                ["Equal", at("q", "ed_heights"), ["Add", at("p", "ed_heights"), 1]],
              ],
              "q",
            ],
          ],
        ],
      ],
      "p",
    ),
    forEach(upTo(steps), [
      "If",
      [
        "Greater",
        // The partner's place in the order.
        bind(
          "ed_mate",
          at(
            [
              "If",
              ["Equal", ["Mod", "i", 2], 1],
              ["Divide", ["Add", "i", 1], 2],
              ["Subtract", ["Add", steps, 1], ["Divide", "i", 2]],
            ],
            "ed_partner",
          ),
          [
            "If",
            ["LessEqual", "ed_mate", ["Divide", steps, 2]],
            ["Subtract", ["Multiply", 2, "ed_mate"], 1],
            ["Multiply", 2, ["Subtract", ["Add", steps, 1], "ed_mate"]],
          ],
          "integer",
        ),
        "i",
      ],
      1,
      0,
    ]),
    "list<integer>",
  ),
  "list<integer>",
);

/** The height after each step of the symbol `word`, a list of 0/1 steps. */
const heightsAfter = (word: string): MathJSON =>
  forEach(
    upTo(["Length", word]),
    [
      "Subtract",
      [
        "Multiply",
        2,
        [
          "Count",
          [
            "Filter",
            upTo(["Length", word]),
            ["Function", ["And", ["LessEqual", "k", "s"], ["Equal", at("k", word), 1]], "k"],
          ],
        ],
      ],
      "s",
    ],
    "s",
  );

/** The symbol `word` with each up step the path never returns beneath turned into a down step, given its `heights`. */
const finalAscentsDown = (word: string, heights: string): MathJSON =>
  forEach(
    upTo(["Length", word]),
    [
      "If",
      [
        "And",
        ["Equal", at("s", word), 1],
        [
          "Equal",
          [
            "Count",
            [
              "Filter",
              upTo(["Length", word]),
              ["Function", ["And", ["Greater", "t", "s"], ["Less", at("t", heights), at("s", heights)]], "t"],
            ],
          ],
          0,
        ],
      ],
      0,
      at("s", word),
    ],
    "s",
  );

/** The first half with its final ascent turned down, read backwards and complemented, then the second half read
 *  the same way round, complemented, and treated alike (the two reversals cancel). */
const barnabeiCastronuovoBody: MathJSON = lets(
  [
    ["bc_n", ["Divide", steps, 2], "integer"],
    ["bc_a", forEach(upTo("bc_n"), at("i")), "list<integer>"],
    ["bc_aHeights", heightsAfter("bc_a"), "list<integer>"],
    ["bc_first", finalAscentsDown("bc_a", "bc_aHeights"), "list<integer>"],
    ["bc_b", forEach(upTo("bc_n"), ["Subtract", 1, at(["Subtract", ["Add", steps, 1], "i"])]), "list<integer>"],
    ["bc_bHeights", heightsAfter("bc_b"), "list<integer>"],
    ["bc_second", finalAscentsDown("bc_b", "bc_bHeights"), "list<integer>"],
  ],
  forEach(upTo(steps), [
    "If",
    ["LessEqual", "i", "bc_n"],
    ["Subtract", 1, at(["Subtract", ["Add", "bc_n", 1], "i"], "bc_first")],
    at(["Subtract", "i", "bc_n"], "bc_second"),
  ]),
);

/** The word `word` with its values `a` and `b` exchanged. */
const swappedValues = (word: MathJSON, a: MathJSON, b: MathJSON): MathJSON =>
  forEach(upTo(["Length", word]), [
    "If",
    ["Equal", at("i", word), a],
    b,
    ["If", ["Equal", at("i", word), b], a, at("i", word)],
  ]);

/**
 * The Adin-Bagno-Roichman bijection of a 321-avoiding permutation, which Sage's code recurses on, run as two folds.
 * Going down, with n the length of `w` and k the number of prefixes holding the values up to their length, a last
 * entry n is dropped (op 1); n after n - 1 is lifted out (op 2); n before n - 1 has the values n - 1 and n
 * exchanged (op 3). Each op is recorded as [kind, n, k, where n was]. Coming back up, newest op first, op 1 puts n
 * on the end, op 2 puts n back and exchanges the values n - k - 1 and n - k, and op 3 rotates the values from
 * n - k up one place (n to n - k). A step takes at most two rounds per length, so 2n rounds run past the bottom.
 */
const abrOfPermutation = (permutation: string): MathJSON =>
  lets(
    [
      [
        "ab_down",
        [
          "Fold",
          [
            "Function",
            lets(
              [
                ["ab_w", at(1, "acc"), "list<integer>"],
                ["ab_ops", at(2, "acc"), "list<list<integer>>"],
                ["ab_n", ["Length", "ab_w"], "integer"],
              ],
              [
                "If",
                ["Less", "ab_n", 2],
                "acc",
                lets(
                  [
                    [
                      "ab_k",
                      [
                        "Count",
                        [
                          "Filter",
                          upTo("ab_n"),
                          [
                            "Function",
                            [
                              "Equal",
                              [
                                "Count",
                                [
                                  "Filter",
                                  upTo("ab_n"),
                                  [
                                    "Function",
                                    ["And", ["LessEqual", "j", "q"], ["Greater", at("j", "ab_w"), "q"]],
                                    "j",
                                  ],
                                ],
                              ],
                              0,
                            ],
                            "q",
                          ],
                        ],
                      ],
                      "integer",
                    ],
                    ["ab_at", ["IndexOf", "ab_w", "ab_n"], "integer"],
                    ["ab_before", ["IndexOf", "ab_w", ["Subtract", "ab_n", 1]], "integer"],
                  ],
                  [
                    "If",
                    ["Equal", at("ab_n", "ab_w"), "ab_n"],
                    [
                      "Tuple",
                      forEach(upTo(["Subtract", "ab_n", 1]), at("i", "ab_w")),
                      ["Join", "ab_ops", ["List", ["List", 1, "ab_n", "ab_k", "ab_at"]]],
                    ],
                    [
                      "If",
                      ["Greater", "ab_at", "ab_before"],
                      [
                        "Tuple",
                        ["Filter", "ab_w", ["Function", ["Less", "x", "ab_n"], "x"]],
                        ["Join", "ab_ops", ["List", ["List", 2, "ab_n", "ab_k", "ab_at"]]],
                      ],
                      [
                        "Tuple",
                        swappedValues("ab_w", ["Subtract", "ab_n", 1], "ab_n"),
                        ["Join", "ab_ops", ["List", ["List", 3, "ab_n", "ab_k", "ab_at"]]],
                      ],
                    ],
                  ],
                ),
              ],
            ),
            "acc",
            "t",
          ],
          ["Tuple", permutation, ["List"]],
          upTo(["Multiply", 2, ["Length", permutation]]),
        ],
      ],
    ],
    [
      "If",
      ["Equal", ["Length", at(2, "ab_down")], 0],
      at(1, "ab_down"),
      [
        "Fold",
        [
          "Function",
          lets(
            [
              [
                "ab_op",
                at(["Subtract", ["Add", ["Length", at(2, "ab_down")], 1], "t"], at(2, "ab_down")),
                "list<integer>",
              ],
            ],
            [
              "If",
              ["Equal", at(1, "ab_op"), 1],
              ["Join", "acc", ["List", at(2, "ab_op")]],
              [
                "If",
                ["Equal", at(1, "ab_op"), 2],
                swappedValues(
                  forEach(upTo(at(2, "ab_op")), [
                    "If",
                    ["Less", "i", at(4, "ab_op")],
                    at("i", "acc"),
                    ["If", ["Equal", "i", at(4, "ab_op")], at(2, "ab_op"), at(["Subtract", "i", 1], "acc")],
                  ]),
                  ["Subtract", ["Subtract", at(2, "ab_op"), at(3, "ab_op")], 1],
                  ["Subtract", at(2, "ab_op"), at(3, "ab_op")],
                ),
                forEach(upTo(at(2, "ab_op")), [
                  "If",
                  ["GreaterEqual", at("i", "acc"), ["Subtract", at(2, "ab_op"), at(3, "ab_op")]],
                  [
                    "If",
                    ["Equal", at("i", "acc"), at(2, "ab_op")],
                    ["Subtract", at(2, "ab_op"), at(3, "ab_op")],
                    ["Add", at("i", "acc"), 1],
                  ],
                  at("i", "acc"),
                ]),
              ],
            ],
          ),
          "acc",
          "t",
        ],
        at(1, "ab_down"),
        upTo(["Length", at(2, "ab_down")]),
      ],
    ],
  );

/** The Dyck path whose block for each left-to-right maximum of the permutation `pi` (a bound name) is the ups from
 *  the last maximum's value up to this one, then the downs to the position of the next maximum (or the end). */
const peaksOfMaxima = (pi: string): MathJSON =>
  lets(
    [
      [
        "pk_at",
        [
          "Filter",
          upTo(["Length", pi]),
          [
            "Function",
            [
              "Equal",
              [
                "Count",
                [
                  "Filter",
                  upTo(["Length", pi]),
                  ["Function", ["And", ["Less", "j", "p"], ["Greater", at("j", pi), at("p", pi)]], "j"],
                ],
              ],
              0,
            ],
            "p",
          ],
        ],
        "list<integer>",
      ],
    ],
    [
      "Fold",
      [
        "Function",
        [
          "Join",
          "acc",
          forEach(
            upTo([
              "Subtract",
              at(at("t", "pk_at"), pi),
              ["If", ["Equal", "t", 1], 0, at(at(["Subtract", "t", 1], "pk_at"), pi)],
            ]),
            1,
            "z",
          ),
          forEach(
            upTo([
              "Subtract",
              ["If", ["Equal", "t", ["Length", "pk_at"]], ["Add", ["Length", pi], 1], at(["Add", "t", 1], "pk_at")],
              at("t", "pk_at"),
            ]),
            0,
            "z",
          ),
        ],
        "acc",
        "t",
      ],
      ["List"],
      upTo(["Length", "pk_at"]),
    ],
  );

const adinBagnoRoichmanBody: MathJSON = [
  "If",
  ["Equal", steps, 0],
  ["List"],
  lets(
    [
      ["ab_start", krattenthalerPermutationBody, "list<integer>"],
      ["ab_pi", abrOfPermutation("ab_start"), "list<integer>"],
    ],
    peaksOfMaxima("ab_pi"),
  ),
];

export const DYCK_MAPS: readonly CombinatorialMap[] = [
  {
    name: "InverseKrewerasComplement",
    from: "dyck_path",
    to: "dyck_path",
    body: inverseKrewerasComplementBody,
    guard: dyckGuard,
    summary:
      "The inverse Kreweras complement of the path read as a noncrossing partition: the blocks are the downs after each up step.",
    note: "FindStat's Mp00327. A bijection of each size; Mp00089 is the same map on noncrossing permutations.",
  },
  {
    name: "KnuthKrattenthaler",
    from: "dyck_path",
    to: "dyck_path",
    body: knuthKrattenthalerBody,
    guard: dyckGuard,
    summary:
      "The 321-avoiding permutation whose left-to-right maxima are the path's peaks, its RSK pair, and the first row of P with the second row of Q as ups.",
    note: "FindStat's Mp00296: Dyck path, to 321-avoiding permutation (Krattenthaler's bijection), to RSK pair, to Dyck path (Knuth).",
  },
  {
    name: "SwapReturnsAndLastDescent",
    from: "dyck_path",
    to: "dyck_path",
    body: swapReturnsAndLastDescentBody,
    guard: dyckGuard,
    summary: "An involution exchanging the number of returns with the length of the last descent.",
    note: "FindStat's Mp00118, the specialization to Dyck paths of the map of Elizalde and Rubey. It keeps the number of ups before each down that is neither a return nor in the last descent.",
  },
  {
    name: "CoriLeBorgne",
    from: "dyck_path",
    to: "dyck_path",
    body: ["If", ["Equal", steps, 0], ["List"], coriLeBorgneBody],
    guard: dyckGuard,
    summary:
      "The involution that appends a down step to the path, reverses the word, and takes its one rotation that is a Dyck word followed by a down step.",
    note: "FindStat's Mp00121.",
  },
  {
    name: "ElizaldeDeutsch",
    from: "dyck_path",
    to: "dyck_path",
    body: ["If", ["Equal", steps, 0], ["List"], elizaldeDeutschBody],
    guard: dyckGuard,
    summary:
      "Reading the steps in the order first, last, second, second to last, and so on, a step of the image is an up step when its matching step has not yet been read.",
    note: "FindStat's Mp00122, the bijection of Elizalde and Deutsch.",
  },
  {
    name: "BarnabeiCastronuovo",
    from: "dyck_path",
    to: "dyck_path",
    body: ["If", ["Equal", steps, 0], ["List"], barnabeiCastronuovoBody],
    guard: dyckGuard,
    summary: "The Schützenberger involution that reverses the canonical decompositions of the two halves of the path.",
    note: "FindStat's Mp00123. In each half the up steps the path never returns beneath are the empty pieces of the decomposition.",
  },
  {
    name: "AdinBagnoRoichman",
    from: "dyck_path",
    to: "dyck_path",
    body: adinBagnoRoichmanBody,
    guard: dyckGuard,
    summary:
      "The bijection of Adin, Bagno and Roichman on the 321-avoiding permutation of the path, read back as a path: it keeps the ups before each peak.",
    note: "FindStat's Mp00124. It sends the number of returns to the number of ups after the last double rise.",
  },
];
