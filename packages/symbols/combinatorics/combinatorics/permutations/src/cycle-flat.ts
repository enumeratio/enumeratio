// Cycle structure on flat integer lists, so the maps built on it compile. A cycle is never a list
// of its points: each point is labeled by its cycle's leader (the least or greatest point of its
// orbit), and a cycle is the points with one label. The only nested value is a result that is
// itself a list of cycles (`cycleDecompositionOf`).

import { bind, lets, type MathJSON } from "../../src/map-helpers.ts";

/** The labels, bound by `withLabels` and read by the helpers below. */
const LABEL = "cy_label";

/** A permutation, named: the word `_raw` or the word `_image`, with the step it takes at a point. */
export interface Walk {
  /** The symbol holding the permutation's word. */
  readonly word: string;
  /** Where the permutation sends `point`. */
  readonly step: (point: MathJSON) => MathJSON;
}

export const plain = (word = "_raw"): Walk => ({ word, step: (point) => ["At", word, point] });
/** The underlying permutation of a signed one: the sign is dropped at each step. */
export const unsigned: Walk = { word: "_raw", step: (point) => ["Abs", ["At", "_raw", point]] };

const upTo = (n: MathJSON): MathJSON => ["Range", 1, n, 1];
const size = (walk: Walk): MathJSON => ["Length", walk.word];
const at = (index: MathJSON, of: MathJSON): MathJSON => ["At", of, index];

/** The permutation applied `times` times to `start`, as a fold. */
export const power = (walk: Walk, start: MathJSON, times: MathJSON): MathJSON => [
  "Fold",
  ["Function", walk.step("pw_a"), "pw_a", "pw_b"],
  start,
  upTo(times),
];

/** The orbit of every point reduced by `extreme` (Min or Max): each point's cycle leader. One walk per point,
 *  carrying the point it stands on and the extreme so far. */
export const labels = (walk: Walk, extreme: "Min" | "Max"): MathJSON => [
  "Map",
  [
    "Function",
    at(2, [
      "Fold",
      [
        "Function",
        ["List", walk.step(at(1, "lb_acc")), [extreme, ["List", at(2, "lb_acc"), walk.step(at(1, "lb_acc"))]]],
        "lb_acc",
        "lb_step",
      ],
      ["List", "lb_point", "lb_point"],
      upTo(size(walk)),
    ]),
    "lb_point",
  ],
  upTo(size(walk)),
];

/** `body` with the labels of `walk` bound for the helpers below. */
export const withLabels = (walk: Walk, extreme: "Min" | "Max", body: MathJSON): MathJSON =>
  bind(LABEL, labels(walk, extreme), body, "list<integer>");

/** The points of the cycle led by `leader`, counted. */
export const cycleSize = (leader: MathJSON): MathJSON => [
  "Count",
  ["Filter", upTo("cy_n"), ["Function", ["Equal", at("cy_j", LABEL), leader], "cy_j"]],
];

/** The negative entries of the signed word `_raw` among the points of the cycle led by `leader`. */
export const negativesIn = (leader: MathJSON): MathJSON => [
  "Count",
  [
    "Filter",
    upTo("cy_n"),
    ["Function", ["And", ["Equal", at("cy_j", LABEL), leader], ["Less", ["At", "_raw", "cy_j"], 0]], "cy_j"],
  ],
];

/** The cycle leaders, ascending. */
const leadersWhere = (also: (leader: MathJSON) => MathJSON): MathJSON => [
  "Filter",
  upTo("cy_n"),
  ["Function", ["And", ["Equal", at("cy_c", LABEL), "cy_c"], also("cy_c")], "cy_c"],
];

/** `body` with `cy_n` the number of points. */
const withSize = (walk: Walk, body: MathJSON): MathJSON => bind("cy_n", size(walk), body, "integer");

/** `body` unless there are no points: the empty list. */
const nonEmpty = (body: MathJSON): MathJSON => ["If", ["Equal", "cy_n", 0], ["List"], body];

/** The cycle lengths in order of their leaders, over the cycles that satisfy `also`. */
export const lengthsWhere = (also: (leader: MathJSON) => MathJSON = () => true): MathJSON => [
  "Map",
  ["Function", cycleSize("cy_l"), "cy_l"],
  leadersWhere(also),
];

/** `body` with the lengths of the cycles satisfying `also` bound to `cy_lens`; `walk` labeled by `extreme`. */
export const withLengths = (
  walk: Walk,
  extreme: "Min" | "Max",
  also: (leader: MathJSON) => MathJSON,
  body: MathJSON,
): MathJSON =>
  withSize(walk, nonEmpty(withLabels(walk, extreme, bind("cy_lens", lengthsWhere(also), body, "list<integer>"))));

/** A list sorted largest-first, read back to front. */
const descending = (list: string): MathJSON => [
  "Map",
  ["Function", ["At", ["Sort", list], ["Subtract", ["Add", ["Length", list], 1], "ds_i"]], "ds_i"],
  upTo(["Length", list]),
];

/** The cumulative sums of `list`, entry m the sum of its first m entries. */
const cumulative = (list: string): MathJSON => [
  "Fold",
  [
    "Function",
    [
      "Join",
      "cu_acc",
      [
        "List",
        ["Add", ["If", ["Equal", "cu_c", 1], 0, ["At", "cu_acc", ["Subtract", "cu_c", 1]]], ["At", list, "cu_c"]],
      ],
    ],
    "cu_acc",
    "cu_c",
  ],
  ["List"],
  upTo(["Count", list]),
];

/** Each cycle written from its leader, cycles in the order of the leaders (ascending), as the one word of their
 *  points: position p is the (p - start of its block)-th image of its block's leader. The lengths are `cy_lens`. */
export const cycleWord = (walk: Walk, body: (word: MathJSON) => MathJSON): MathJSON =>
  lets(
    [
      ["cy_leaders", leadersWhere(() => true), "list<integer>"],
      ["cy_ends", cumulative("cy_lens"), "list<integer>"],
    ],
    body([
      "Map",
      [
        "Function",
        bind(
          "cw_blk",
          [
            "Add",
            [
              "Count",
              ["Filter", upTo(["Length", "cy_ends"]), ["Function", ["Less", at("cw_b", "cy_ends"), "cw_p"], "cw_b"]],
            ],
            1,
          ],
          bind(
            "cw_off",
            [
              "Subtract",
              "cw_p",
              ["If", ["Equal", "cw_blk", 1], 1, ["Add", at(["Subtract", "cw_blk", 1], "cy_ends"), 1]],
            ],
            [
              "If",
              ["Equal", "cw_off", 0],
              at("cw_blk", "cy_leaders"),
              power(walk, at("cw_blk", "cy_leaders"), "cw_off"),
            ],
            "integer",
          ),
          "integer",
        ),
        "cw_p",
      ],
      upTo("cy_n"),
    ]),
  );

/** The cycles of `walk` as a list of lists, each from its least point, in order of those points. */
export const cycleDecompositionOf = (walk: Walk): MathJSON =>
  withSize(
    walk,
    nonEmpty(
      withLabels(
        walk,
        "Min",
        bind(
          "cy_leaders",
          leadersWhere(() => true),
          [
            "Map",
            [
              "Function",
              [
                "Map",
                [
                  "Function",
                  ["If", ["Equal", "cd_k", 1], "cd_s", power(walk, "cd_s", ["Subtract", "cd_k", 1])],
                  "cd_k",
                ],
                upTo(cycleSize("cd_s")),
              ],
              "cd_s",
            ],
            "cy_leaders",
          ],
          "list<integer>",
        ),
      ),
    ),
  );

/** The conjugate partition of the cycle type: entry j counts the cycles of length at least j. */
export const conjugateOfCycleType: MathJSON = [
  "Map",
  ["Function", ["Count", ["Filter", "cy_lens", ["Function", ["GreaterEqual", "cy_l", "cy_j"], "cy_l"]]], "cy_j"],
  upTo(["Max", "cy_lens"]),
];

/** The canonical permutation of the cycle type: cycles in decreasing length, filled with consecutive integers,
 *  each cycle (a a+1 ... a+len-1) written as the one-line word a+1, ..., a+len-1, a. */
export const conjugacyClassRepresentative: MathJSON = lets(
  [
    ["cy_sorted", descending("cy_lens"), "list<integer>"],
    ["cy_ends", cumulative("cy_sorted"), "list<integer>"],
  ],
  [
    "Map",
    [
      "Function",
      bind(
        "cr_blk",
        [
          "Add",
          [
            "Count",
            ["Filter", upTo(["Length", "cy_ends"]), ["Function", ["Less", at("cr_b", "cy_ends"), "cr_p"], "cr_b"]],
          ],
          1,
        ],
        [
          "If",
          ["Less", "cr_p", at("cr_blk", "cy_ends")],
          ["Add", "cr_p", 1],
          ["If", ["Equal", "cr_blk", 1], 1, ["Add", at(["Subtract", "cr_blk", 1], "cy_ends"), 1]],
        ],
        "integer",
      ),
      "cr_p",
    ],
    upTo("cy_n"),
  ],
);
