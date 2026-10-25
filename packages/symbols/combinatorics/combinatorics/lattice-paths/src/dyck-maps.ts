// More combinatorial maps from Dyck paths to Dyck paths: the inverse Kreweras complement, the
// Knuth-Krattenthaler bijection and the Elizalde-Rubey involution. Bodies are over `_raw`, the
// path's 0/1 steps (1 up).

import { at, bind, forEach, type CombinatorialMap, type MathJSON } from "../../src/map-helpers.ts";
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
const knuthKrattenthalerBody: MathJSON = [
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
];
