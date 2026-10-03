// A permutation in cycle notation with its fixed points kept (`CycleDecomposition`), so it knows
// its size and converts back. Wolfram's `Cycles` drops fixed points and so doesn't. The
// conversions are defined in Epsil; tests/map-definitions.test.ts checks them against the
// collections' own (`PermutationsAsCycles`).
import { bind, type MathJSON as Expression } from "../../src/map-helpers.ts";
import { recurse, self } from "../../src/recursion.ts";

type MathJSON = unknown;

/** The cycle of `p` through `start`, from `start`. */
const cycleThrough = (p: MathJSON, start: MathJSON): MathJSON =>
  recurse(
    ["If", ["Equal", ["At", p, "x"], start], ["List", "x"], ["Join", ["List", "x"], self(["At", p, "x"])]],
    ["x"],
    start,
  );

/** Each cycle from its least point, cycles in order of those points: start a cycle at every
 *  point no earlier cycle has reached. */
export const decomposition = (p: MathJSON): MathJSON => [
  "Fold",
  [
    "Function",
    ["If", ["Element", "s", ["Flatten", "acc"]], "acc", ["Join", "acc", ["List", cycleThrough(p, "s")]]],
    "acc",
    "s",
  ],
  ["List"],
  ["Range", 1, ["Length", p], 1],
];

export const cycleDecompositionBody: MathJSON = decomposition("_raw");

/** Where `i` goes: the point after it in its cycle, wrapping round; `otherwise` when none holds it. */
const successor = (cycles: MathJSON, i: MathJSON, otherwise: MathJSON = 0): MathJSON => [
  "Fold",
  [
    "Function",
    [
      "Fold",
      [
        "Function",
        ["If", ["Equal", ["At", "c", "k"], i], ["At", "c", ["Add", ["Mod", "k", ["Length", "c"]], 1]], "to"],
        "to",
        "k",
      ],
      "found",
      ["Range", 1, ["Length", "c"], 1],
    ],
    "found",
    "c",
  ],
  otherwise,
  cycles,
];

// A fold rather than `Map`: a `Map` over an empty range stays lazy, and the guard compares it.
export const permutationOfCycleDecompositionBody: MathJSON = [
  "Fold",
  ["Function", ["Join", "acc", ["List", successor("_raw", "i")]], "acc", "i"],
  ["List"],
  ["Range", 1, ["Length", ["Flatten", "_raw"]], 1],
];

/** Only a canonical decomposition converts: the permutation must give it back. */
export const permutationOfCycleDecompositionGuard: MathJSON = ["Equal", decomposition("_image"), "_raw"];

/** The canonical decomposition of the permutation of 1..`_n` that the disjoint cycles `_raw`
 *  describe, the points they leave out fixed: the permutation first, then its decomposition. */
export const cycleDecompositionOfCyclesBody: MathJSON = bind(
  "p",
  [
    "Fold",
    ["Function", ["Join", "acc", ["List", successor("_raw", "i", "i")]], "acc", "i"],
    ["List"],
    ["Range", 1, "_n", 1],
  ] as Expression,
  decomposition("p") as Expression,
  "list<integer>",
);

/** The cycles hold integers in 1..`_n`, none twice. Indexed rather than folded over the
 *  flattened list, which a fold leaves unevaluated. */
const point = ["At", ["Flatten", "_raw"], "j"];
export const cycleDecompositionOfCyclesGuard: MathJSON = [
  "And",
  ["GreaterEqual", "_n", 0],
  ["Equal", ["Length", ["Flatten", "_raw"]], ["Length", ["Union", ["Flatten", "_raw"]]]],
  [
    "Fold",
    [
      "Function",
      ["And", "ok", ["Equal", ["Floor", point], point], ["LessEqual", 1, point], ["LessEqual", point, "_n"]],
      "ok",
      "j",
    ],
    "True",
    ["Range", 1, ["Length", ["Flatten", "_raw"]], 1],
  ],
];

/** `Cycles` keeps no fixed points, so a decomposition's singleton cycles go. */
export const cyclesOfCycleDecompositionBody: MathJSON = [
  "Filter",
  "_raw",
  ["Function", ["Greater", ["Length", "c"], 1], "c"],
];
