// The permutation families, defined in Epsil (see collections/src/families/epsil.ts): the
// symmetric group, k-permutations, signed, coloured and cyclic permutations, involutions and
// derangements. Each is ordered by rank, and every rank is a mixed-radix number read off the
// element, so count, unrank, rank and membership are all closed expressions over `_n` (and
// `_k`), with no list built up along the way.

import type { AnyFamily, EpsilFamily } from "../../../collections/src/families/epsil.ts";
import {
  DerangementCount,
  DerangementRank,
  DerangementUnrank,
  InvolutionCount,
  InvolutionRank,
  InvolutionUnrank,
  IsDerangementOf,
  IsInvolutionOf,
} from "../../../collections/src/families/kernels-extra.ts";
import { type NumberKernel, numberKernel } from "../../../collections/src/families/types.ts";

type MathJSON = unknown;

// Every Range states its step: compute-engine counts down when the end is below the start.
const upTo = (from: MathJSON, to: MathJSON): MathJSON => ["Range", from, to, 1];
const downTo = (from: MathJSON, to: MathJSON): MathJSON => ["Range", from, to, -1];
const fold = (body: MathJSON, accumulator: string, variable: string, init: MathJSON, over: MathJSON): MathJSON => [
  "Fold",
  ["Function", body, accumulator, variable],
  init,
  over,
];
const map = (body: MathJSON, variable: string, over: MathJSON): MathJSON => ["Map", ["Function", body, variable], over];
const sub = (a: MathJSON, b: MathJSON): MathJSON => ["Subtract", a, b];
const add = (...xs: MathJSON[]): MathJSON => ["Add", ...xs];
const at = (list: MathJSON, index: MathJSON): MathJSON => ["At", list, index];
/** ⌊a / b⌋ for integers, exactly: compute-engine's `Floor` of a big rational rounds through a
 *  double, so ⌊(25! − 1) / 24!⌋ would be 25. */
const quotient = (a: MathJSON, b: MathJSON): MathJSON => ["Divide", sub(a, ["Mod", a, b]), b];
const all = (condition: (j: string) => MathJSON, over: MathJSON, j = "j"): MathJSON =>
  fold(["And", "ok", condition(j)], "ok", j, "True", over);
const between = (x: MathJSON, low: MathJSON, high: MathJSON): MathJSON => [
  "And",
  ["LessEqual", low, x],
  ["LessEqual", x, high],
];

/** m (m − 1) ⋯ (m − t + 1): the number of ways to fill t slots from m. */
const falling = (m: MathJSON, t: MathJSON, v = "f"): MathJSON =>
  fold(["Multiply", "product", v], "product", v, 1, upTo(add(sub(m, t), 1), m));

/** Digit j (1-based) of r in the mixed radix of a k-permutation of n: slot j has n − j + 1
 *  choices, and a digit there is worth the ways to fill the slots after it, (n − j)! when every
 *  slot is filled. */
const digit = (n: MathJSON, k: MathJSON, r: MathJSON, j: MathJSON): MathJSON => [
  "Mod",
  quotient(r, JSON.stringify(n) === JSON.stringify(k) ? ["Factorial", sub(n, j)] : falling(sub(n, j), sub(k, j))),
  add(sub(n, j), 1),
];

/**
 * Entry j of the k-permutation of n with rank r in lex order: the (d_j + 1)-th smallest value
 * not used before it. Read from the digits alone: start at d_j + 1 and, for each earlier slot i
 * from j − 1 down to 1, step past that slot's value when it is at or below the current one (its
 * value, among the values still free at i, is d_i + 1).
 */
const lexEntry = (n: MathJSON, k: MathJSON, r: MathJSON, j: MathJSON): MathJSON =>
  fold(
    ["If", ["GreaterEqual", "v", add(digit(n, k, r, "i"), 1)], add("v", 1), "v"],
    "v",
    "i",
    add(digit(n, k, r, j), 1),
    downTo(sub(j, 1), 1),
  );

const lexUnrank = (n: MathJSON, k: MathJSON, r: MathJSON): MathJSON => map(lexEntry(n, k, r, "j"), "j", upTo(1, k));

/** The lex rank of a k-permutation of n whose entry j is `entry(j)`: digit j is how many values
 *  below entry j are still free, read in Horner form. */
const lexRank = (n: MathJSON, k: MathJSON, entry: (j: MathJSON) => MathJSON): MathJSON =>
  fold(
    add(
      ["Multiply", "r", add(sub(n, "j"), 1)],
      sub(
        sub(entry("j"), 1),
        fold(add("c", ["If", ["Less", entry("i"), entry("j")], 1, 0]), "c", "i", 0, upTo(1, sub("j", 1))),
      ),
    ),
    "r",
    "j",
    0,
    upTo(1, k),
  );

/** Whether `entry(1..k)` are distinct values in 1..n. */
const injective = (n: MathJSON, k: MathJSON, entry: (j: MathJSON) => MathJSON): MathJSON =>
  all(
    (j) => ["And", between(entry(j), 1, n), all((i) => ["NotEqual", entry(i), entry(j)], upTo(1, sub(j, 1)), "i")],
    upTo(1, k),
  );

const element = (j: MathJSON): MathJSON => at("_x", j);
const hasLength = (list: MathJSON, length: MathJSON, then: MathJSON): MathJSON => [
  "If",
  ["Equal", ["Length", list], length],
  then,
  "False",
];

/** The symmetric group: the permutations of n in lex order. Its count passes 2^53 at n = 19,
 *  where compiled code gives way to exact integers. */
const symmetricGroup: EpsilFamily = {
  head: "SymmetricGroup",
  carrier: "Permutation",
  paramCount: 1,
  kind: "ints",
  params: ["_n"],
  epsil: {
    count: ["Factorial", "_n"],
    unrank: lexUnrank("_n", "_n", "_r"),
    rank: lexRank("_n", "_n", element),
    valid: hasLength("_x", "_n", injective("_n", "_n", element)),
  },
};

/** The k-permutations (arrangements) of n, n!/(n − k)! of them, in lex order. */
const kPermutations: EpsilFamily = {
  head: "KPermutations",
  paramCount: 2,
  kind: "ints",
  params: ["_n", "_k"],
  epsil: {
    count: ["If", ["LessEqual", "_k", "_n"], falling("_n", "_k"), 0],
    unrank: lexUnrank("_n", "_k", "_r"),
    rank: lexRank("_n", "_k", element),
    valid: hasLength("_x", "_k", injective("_n", "_k", element)),
  },
};

// A signed permutation's rank is its sign mask (bit j − 1 set when entry j is negative) times
// n!, plus the lex rank of its absolute values.
/** +1, or −1 when bit j − 1 of the mask is set. */
const sign = (mask: MathJSON, j: MathJSON): MathJSON => [
  "Subtract",
  1,
  ["Multiply", 2, ["Mod", quotient(mask, ["Power", 2, sub(j, 1)]), 2]],
];
const magnitude = (j: MathJSON): MathJSON => ["Abs", element(j)];

/** The hyperoctahedral group B_n: permutations with a sign on each entry, 2^n n! of them. */
const signedPermutations: EpsilFamily = {
  head: "SignedPermutations",
  carrier: "SignedPermutation",
  paramCount: 1,
  kind: "ints",
  params: ["_n"],
  epsil: {
    count: ["Multiply", ["Power", 2, "_n"], ["Factorial", "_n"]],
    unrank: map(
      [
        "Multiply",
        sign(quotient("_r", ["Factorial", "_n"]), "j"),
        lexEntry("_n", "_n", ["Mod", "_r", ["Factorial", "_n"]], "j"),
      ],
      "j",
      upTo(1, "_n"),
    ),
    rank: add(
      [
        "Multiply",
        fold(add("m", ["If", ["Less", element("j"), 0], ["Power", 2, sub("j", 1)], 0]), "m", "j", 0, upTo(1, "_n")),
        ["Factorial", "_n"],
      ],
      lexRank("_n", "_n", magnitude),
    ),
    valid: hasLength("_x", "_n", injective("_n", "_n", magnitude)),
  },
};

// A coloured permutation is [image, colours]; its rank is the colours read as a base-k number
// (first colour most significant) times n!, plus the lex rank of the image.
const image = (j: MathJSON): MathJSON => at(at("_x", 1), j);
const colour = (j: MathJSON): MathJSON => at(at("_x", 2), j);
const colours = quotient("_r", ["Factorial", "_n"]);

/** Permutations with one of k colours on each entry, k^n n! of them. */
const colouredPermutations: EpsilFamily = {
  head: "ColoredPermutations",
  paramCount: 2,
  kind: "blocks",
  params: ["_n", "_k"],
  elementType: "tuple<list<integer>, list<integer>>",
  epsil: {
    count: ["If", ["Equal", "_n", 0], 1, ["Multiply", ["Power", "_k", "_n"], ["Factorial", "_n"]]],
    unrank: [
      "List",
      lexUnrank("_n", "_n", ["Mod", "_r", ["Factorial", "_n"]]),
      map(["Mod", quotient(colours, ["Power", "_k", sub("_n", "j")]), "_k"], "j", upTo(1, "_n")),
    ],
    rank: add(
      ["Multiply", fold(add(["Multiply", "c", "_k"], colour("j")), "c", "j", 0, upTo(1, "_n")), ["Factorial", "_n"]],
      lexRank("_n", "_n", image),
    ),
    valid: hasLength(
      "_x",
      2,
      hasLength(
        at("_x", 1),
        "_n",
        hasLength(at("_x", 2), "_n", [
          "And",
          injective("_n", "_n", image),
          all((j) => between(colour(j), 0, sub("_k", 1)), upTo(1, "_n")),
        ]),
      ),
    ),
  },
};

// A cyclic permutation is one n-cycle, written from 1: (1 w_1+1 … w_{n−1}+1), where w is the
// permutation of n − 1 with the same rank. Entry m of the image is the value after m in the
// cycle: w_{p+1} + 1 where m = w_p + 1 (taking w_0 = 0, so m = 1 sits at p = 0), and 1 after the
// last.
const cycleWord = (p: MathJSON): MathJSON => lexEntry(sub("_n", 1), sub("_n", 1), "_r", p);
const successor = (m: MathJSON): MathJSON =>
  fold(
    [
      "If",
      [
        "Or",
        ["And", ["Equal", "p", 0], ["Equal", m, 1]],
        ["And", ["Greater", "p", 0], ["Equal", cycleWord("p"), sub(m, 1)]],
      ],
      ["If", ["Equal", "p", sub("_n", 1)], 1, add(cycleWord(add("p", 1)), 1)],
      "after",
    ],
    "after",
    "p",
    0,
    upTo(0, sub("_n", 1)),
  );
/** The value t steps along the cycle from 1. */
const walk = (t: MathJSON): MathJSON => fold(element("s"), "s", "step", 1, upTo(1, t));

/** The permutations of n that are a single n-cycle, (n − 1)! of them for n ≥ 1. */
const cyclicPermutations: EpsilFamily = {
  head: "CyclicPermutations",
  carrier: "Permutation",
  paramCount: 1,
  kind: "ints",
  params: ["_n"],
  epsil: {
    count: ["If", ["Less", "_n", 1], 0, ["Factorial", sub("_n", 1)]],
    unrank: map(successor("m"), "m", upTo(1, "_n")),
    rank: lexRank(sub("_n", 1), sub("_n", 1), (j) => sub(walk(j), 1)),
    valid: [
      "And",
      ["GreaterEqual", "_n", 1],
      hasLength("_x", "_n", [
        "And",
        injective("_n", "_n", element),
        all((t) => ["NotEqual", walk(t), 1], upTo(1, sub("_n", 1)), "t"),
      ]),
    ],
  },
};

// Involutions and derangements recurse over a shrinking label set. In Epsil that is a fold with
// a list accumulator, which compute-engine compiles from 0.142; the recursion interpreted takes
// about a second an element. They stay TS kernels until then.
export const entries: NumberKernel[] = [
  {
    head: "Involutions",
    carrier: "Permutation",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => InvolutionCount(n),
    unrank: ([n], r) => InvolutionUnrank(n, r),
    valid: (a, [n]) => IsInvolutionOf(a as number[], n),
    rank: (a) => InvolutionRank(a as number[]),
  },
  {
    head: "Derangements",
    carrier: "Permutation",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => DerangementCount(n),
    unrank: ([n], r) => DerangementUnrank(n, r),
    valid: (a, [n]) => IsDerangementOf(a as number[], n),
    rank: (a) => DerangementRank(a as number[]),
  },
];

export const epsilEntries: readonly EpsilFamily[] = [
  symmetricGroup,
  kPermutations,
  signedPermutations,
  cyclicPermutations,
  colouredPermutations,
];

/** Every family here, in catalogue order. */
export const families: readonly AnyFamily[] = [
  symmetricGroup,
  kPermutations,
  signedPermutations,
  cyclicPermutations,
  ...entries.map(numberKernel),
  colouredPermutations,
];
