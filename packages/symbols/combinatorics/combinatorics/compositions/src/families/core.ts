// Compositions-area families split out of collections/src/families/core.ts (which mixed every
// area) per https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5: IntegerCompositions and its two siblings. The generic kernel math they call stays in
// collections/src/families/kernels*.ts — reused across areas, not compositions-specific machinery.
//
// All three are defined in Epsil (see collections/src/families/epsil.ts, and the permutations
// area's core.ts for the pattern): count, unrank, rank and valid are closed expressions, no list
// built up along the way.
import type { AnyFamily, EpsilFamily } from "../../../collections/src/families/epsil.ts";

type MathJSON = unknown;

// Every Range states its step: compute-engine counts down when the end is below the start.
const upTo = (from: MathJSON, to: MathJSON): MathJSON => ["Range", from, to, 1];
const downTo = (from: MathJSON, to: MathJSON): MathJSON => ["Range", from, to, -1];
const sub = (a: MathJSON, b: MathJSON): MathJSON => ["Subtract", a, b];
const add = (...xs: MathJSON[]): MathJSON => ["Add", ...xs];
const at = (list: MathJSON, index: MathJSON): MathJSON => ["At", list, index];
const fold = (body: MathJSON, accumulator: string, variable: string, init: MathJSON, over: MathJSON): MathJSON => [
  "Fold",
  ["Function", body, accumulator, variable],
  init,
  over,
];
/** ⌊a / b⌋ for integers, exactly: compute-engine's `Floor` of a big rational rounds through a
 *  double, so ⌊(25! − 1) / 24!⌋ would be 25. */
const quotient = (a: MathJSON, b: MathJSON): MathJSON => ["Divide", sub(a, ["Mod", a, b]), b];
const binom = (n: MathJSON, k: MathJSON): MathJSON => ["Binomial", n, k];
const element = (j: MathJSON): MathJSON => at("_x", j);
const lengthOf = (x: MathJSON): MathJSON => ["Length", x];

// ─── IntegerCompositions(n): mask IS the rank (the gap-cut bijection) ──────────────────────────
// Bit (i − 1) of the rank, for i = 1..n − 1, marks a cut right after position i; a composition's
// parts are the run-lengths between cuts (and the two ends). n = 0 has one (empty) composition.
const bitSet = (i: MathJSON): MathJSON => ["Equal", ["Mod", quotient("_r", ["Power", 2, sub(i, 1)]), 2], 1];
/** The cut positions in 1.._n − 1, ascending. */
const cutPositions: MathJSON = ["Filter", upTo(1, sub("_n", 1)), ["Function", bitSet("i"), "i"]];
/** 0, every cut, then _n: parts are its consecutive differences. */
const boundaries: MathJSON = ["Join", ["List", 0], cutPositions, ["List", "_n"]];

/** The sum of `_x`'s first `i` entries. */
const prefixSum = (i: MathJSON): MathJSON => fold(add("acc2", element("t")), "acc2", "t", 0, upTo(1, i));

const integerCompositions: EpsilFamily = {
  head: "IntegerCompositions",
  carrier: "Composition",
  paramCount: 1,
  kind: "ints",
  params: ["_n"],
  epsil: {
    count: ["If", ["Equal", "_n", 0], 1, ["Power", 2, sub("_n", 1)]],
    unrank: [
      "If",
      ["Equal", "_n", 0],
      ["List"],
      [
        "Map",
        ["Function", sub(at(boundaries, add("j", 1)), at(boundaries, "j")), "j"],
        upTo(1, sub(lengthOf(boundaries), 1)),
      ],
    ],
    rank: fold(
      add("acc", ["If", ["LessEqual", "i", sub(lengthOf("_x"), 1)], ["Power", 2, sub(prefixSum("i"), 1)], 0]),
      "acc",
      "i",
      0,
      upTo(1, sub(lengthOf("_x"), 1)),
    ),
    // A composition of n: positive parts summing to n. Summing to n already forces the n = 0 /
    // empty-list coupling (positive parts can't sum to 0 unless there are none of them).
    valid: [
      "And",
      ["Equal", prefixSum(lengthOf("_x")), "_n"],
      fold(["And", "ok", ["GreaterEqual", element("j"), 1]], "ok", "j", "True", upTo(1, lengthOf("_x"))),
    ],
  },
};

// ─── CompositionsIntoKParts(n,k) / WeakCompositions(n,k): the colex combinatorial-number-system ──
// A composition of `total` into k positive parts: its k − 1 cuts are a colex (k − 1)-subset of
// 1..total − 1 (the TS reading in kernels-extra.ts: KSubsetRank/KSubsetUnrank). Digit i (from
// k − 1 downto 1) is the greatest c with Binomial(c, i) ≤ the r left after the digits above it --
// each depends on the previous digit's leftover r, unlike a k-permutation's independent
// mixed-radix digits. `digitAt`/`rBefore` chase that dependency with nested scalar folds (no list
// accumulator, no recursion): `rBefore` folds the leftover r down through the digits above i;
// `digitAt` is the greedy search at one digit. `tag` gives every nested Fold its own bound-variable
// names -- a fold's variable/accumulator must not collide with one from an outer or sibling fold
// in the same expression tree.
const digitAt = (i: MathJSON, rIn: MathJSON, universe: MathJSON, tag: string): MathJSON => {
  const c = `c_${tag}`;
  const best = `best_${tag}`;
  return fold(["If", ["LessEqual", binom(c, i), rIn], c, best], best, c, sub(i, 1), upTo(sub(i, 1), sub(universe, 1)));
};
const rBefore = (i: MathJSON, digits: MathJSON, universe: MathJSON, tag: string): MathJSON => {
  const hi = `hi_${tag}`;
  const acc = `racc_${tag}`;
  return fold(sub(acc, binom(digitAt(hi, acc, universe, `${tag}i`), hi)), acc, hi, "_r", downTo(digits, add(i, 1)));
};
/** The m-th smallest (1-based, ascending) cut position. */
const cutAt = (m: MathJSON, digits: MathJSON, universe: MathJSON, tag: string): MathJSON =>
  add(digitAt(m, rBefore(m, digits, universe, `${tag}r`), universe, `${tag}d`), 1);

/** A composition of `total` into `_k` positive parts, `offset` added to each part (−1 turns it
 *  into a weak composition of `total` − `_k` = `_n`: its parts are ≥ 0, built as a positive
 *  composition of `_n` + `_k` minus 1 per part). */
function kSubsetComposition(head: string, total: MathJSON, offset: number, carrier?: string): EpsilFamily {
  const digits = sub("_k", 1);
  const universe = sub(total, 1);
  /** 0, every cut, then `total`: the positive-part composition's boundaries. */
  const cutValue = (m: MathJSON, tag: string): MathJSON => [
    "If",
    ["Equal", m, 0],
    0,
    ["If", ["Equal", m, "_k"], total, cutAt(m, digits, universe, tag)],
  ];
  const partAt = (pos: MathJSON, tagA: string, tagB: string): MathJSON =>
    add(sub(cutValue(pos, tagA), cutValue(sub(pos, 1), tagB)), offset);
  /** `_x`'s entry j, read back as a positive part (undoing `offset`). */
  const positivePart = (j: MathJSON): MathJSON => sub(element(j), offset);
  const prefixSumPositive = (i: MathJSON): MathJSON => fold(add("acc2", positivePart("t")), "acc2", "t", 0, upTo(1, i));
  return {
    head,
    ...(carrier === undefined ? {} : { carrier }),
    paramCount: 2,
    kind: "ints",
    params: ["_n", "_k"],
    epsil: {
      count: ["If", ["Equal", total, 0], ["If", ["Equal", "_k", 0], 1, 0], binom(universe, digits)],
      unrank: ["Map", ["Function", partAt("pos", "A", "B"), "pos"], upTo(1, "_k")],
      rank: fold(add("acc3", binom(sub(prefixSumPositive("i"), 1), "i")), "acc3", "i", 0, upTo(1, digits)),
      valid: [
        "And",
        ["Equal", lengthOf("_x"), "_k"],
        ["Equal", prefixSumPositive(lengthOf("_x")), total],
        fold(["And", "okv", ["GreaterEqual", element("jv"), offset + 1]], "okv", "jv", "True", upTo(1, lengthOf("_x"))),
      ],
    },
  };
}

const compositionsIntoKParts = kSubsetComposition("CompositionsIntoKParts", "_n", 0, "Composition");
const weakCompositions = kSubsetComposition("WeakCompositions", add("_n", "_k"), -1);

export const epsilEntries: readonly EpsilFamily[] = [integerCompositions, compositionsIntoKParts, weakCompositions];

/** Every family here, in catalogue order. */
export const families: readonly AnyFamily[] = epsilEntries;
