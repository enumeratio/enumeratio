// Families whose count, unrank, rank and membership are closed expressions: a rank is a number
// read in a fixed radix off the element, so nothing is built up along the way. Defined in Epsil
// (see ./epsil.ts). Shared by the areas that carry them (collections, words, trees), each giving a
// family its own head and carrier.
//
// The TS kernels these replaced (kernels-extra.ts: SubsetUnrank, TupleRank, …, words.ts's Gray
// code) stay as the independent reading the agreement tests check against.

import type { EpsilFamily } from "./epsil.ts";
import { choose } from "./tables.ts";

type MathJSON = unknown;

// Every Range states its step: compute-engine counts down when the end is below the start.
const upTo = (from: MathJSON, to: MathJSON): MathJSON => ["Range", from, to, 1];
const binomial = (n: MathJSON, k: MathJSON): MathJSON => ["Binomial", n, k];
const sub = (a: MathJSON, b: MathJSON): MathJSON => ["Subtract", a, b];
const add = (...xs: MathJSON[]): MathJSON => ["Add", ...xs];
const mul = (...xs: MathJSON[]): MathJSON => ["Multiply", ...xs];
const pow = (a: MathJSON, b: MathJSON): MathJSON => ["Power", a, b];
const at = (list: MathJSON, index: MathJSON): MathJSON => ["At", list, index];
const equal = (a: MathJSON, b: MathJSON): MathJSON => ["Equal", a, b];
const fold = (body: MathJSON, accumulator: string, variable: string, init: MathJSON, over: MathJSON): MathJSON => [
  "Fold",
  ["Function", body, accumulator, variable],
  init,
  over,
];
const map = (body: MathJSON, variable: string, over: MathJSON): MathJSON => ["Map", ["Function", body, variable], over];
/** ⌊a / b⌋ for integers, exactly: compute-engine's `Floor` of a big rational rounds through a
 *  double, so ⌊(2^60 − 1) / 2^59⌋ would be 2. */
const quotient = (a: MathJSON, b: MathJSON): MathJSON => ["Divide", sub(a, ["Mod", a, b]), b];
const between = (x: MathJSON, low: MathJSON, high: MathJSON): MathJSON => [
  "And",
  ["LessEqual", low, x],
  ["LessEqual", x, high],
];
const all = (condition: (j: string) => MathJSON, over: MathJSON, j: string, ok = `ok_${j}`): MathJSON =>
  fold(["And", ok, condition(j)], ok, j, "True", over);
const element = (j: MathJSON): MathJSON => at("_x", j);
const len: MathJSON = ["Length", "_x"];

/** Digit `place` (0 = least significant) of `value` in `radix`. */
const digitOf = (value: MathJSON, radix: MathJSON, place: MathJSON): MathJSON => [
  "Mod",
  quotient(value, pow(radix, place)),
  radix,
];

interface Shape {
  readonly head: string;
  readonly carrier?: string;
  readonly carrierParams?: number;
  readonly params: readonly string[];
}
const shapeOf = (s: Shape) => ({
  head: s.head,
  ...(s.carrier === undefined ? {} : { carrier: s.carrier }),
  ...(s.carrierParams === undefined ? {} : { carrierParams: s.carrierParams }),
  paramCount: s.params.length as 1 | 2,
  kind: "ints" as const,
  params: s.params,
});

/**
 * Words of `length` over `base` letters, in lex order (position 1 most significant): the letters
 * are `offset .. offset + base − 1`, and the rank is the word read as a base-`base` number.
 * `count` overrides the default base^length (1 for the empty word).
 */
export function digitWords(
  shape: Shape & {
    readonly base: MathJSON;
    readonly length: MathJSON;
    readonly offset: 0 | 1;
    readonly count?: MathJSON;
  },
): EpsilFamily {
  const { base, length, offset } = shape;
  const letter = (j: MathJSON): MathJSON => sub(element(j), offset);
  return {
    ...shapeOf(shape),
    epsil: {
      count: shape.count ?? ["If", equal(length, 0), 1, pow(base, length)],
      unrank: map(add(digitOf("_r", base, sub(length, "j")), offset), "j", upTo(1, length)),
      rank: fold(add(mul("acc", base), letter("j")), "acc", "j", 0, upTo(1, length)),
      valid: [
        "And",
        equal(len, length),
        all((j) => between(element(j), offset, add(base, offset, -1)), upTo(1, len), "j"),
      ],
    },
  };
}

/** Tuples(n, k): the k-tuples over 1..n. */
export const tuples = (shape: Shape): EpsilFamily => digitWords({ ...shape, base: "_n", length: "_k", offset: 1 });

/** Words(size, base): Tuples with the two params the other way round. */
export const words = (shape: Shape): EpsilFamily => digitWords({ ...shape, base: "_base", length: "_size", offset: 1 });

/** The 0/1 words of length n. */
export const binaryStrings = (shape: Shape): EpsilFamily => digitWords({ ...shape, base: 2, length: "_n", offset: 0 });

/** Endofunctions(n): the functions 1..n → 1..n, as their length-n tuples of values. */
export const endofunctions = (shape: Shape): EpsilFamily =>
  digitWords({ ...shape, base: "_n", length: "_n", offset: 1 });

/** Prüfer sequences of the labeled trees on n vertices: n − 2 entries over 1..n; the empty one
 *  for n = 1 and 2, and none for n ≤ 0. */
export const pruferSequences = (shape: Shape): EpsilFamily =>
  digitWords({
    ...shape,
    base: "_n",
    length: ["Max", sub("_n", 2), 0],
    offset: 1,
    count: ["If", ["LessEqual", "_n", 0], 0, ["If", ["LessEqual", "_n", 2], 1, pow("_n", sub("_n", 2))]],
  });

/** The ascending members of 1..`n` whose bit (i − 1) of `mask` satisfies `keep(i)`. */
const membersWhere = (n: MathJSON, keep: (i: string) => MathJSON): MathJSON => [
  "Filter",
  upTo(1, n),
  ["Function", keep("i"), "i"],
];

/** Whether `_x` lists distinct values in 1..n (any order). */
const distinctMembers = (n: MathJSON): MathJSON =>
  all(
    (j) => [
      "And",
      between(element(j), 1, n),
      all((i) => ["NotEqual", element(i), element(j)], upTo(1, sub(j, 1)), "i"),
    ],
    upTo(1, len),
    "j",
  );

// ─── Subsets, lex within a size and graded by size ───────────────────────────────────────────
// A subset is a set, so its order is by size, then lex on its ascending members (Wolfram's
// `Subsets` order). The bitmask order is `BinaryWords(n)` through `Finset(word)`.

/** The k-subset of 1..N with lex rank R, ascending: member j is the smallest value above member
 *  j − 1 whose subsets (C(N − v, K − j) of them, choosing the rest above v) hold the rank left.
 *  The fold's state is the rank left, then the members so far. */
const lexKSubset = (N: MathJSON, K: MathJSON, R: MathJSON, tag: string): MathJSON => {
  const [state, slot, pick, v] = [`ls_${tag}`, `lj_${tag}`, `lp_${tag}`, `lv_${tag}`];
  const previous = ["If", equal(slot, 1), 0, at(state, slot)];
  const choose = fold(
    [
      "If",
      ["Or", ["NotEqual", at(pick, 2), 0], ["LessEqual", v, previous]],
      pick,
      [
        "If",
        ["Less", at(pick, 1), binomial(sub(N, v), sub(K, slot))],
        ["List", at(pick, 1), v],
        ["List", sub(at(pick, 1), binomial(sub(N, v), sub(K, slot))), 0],
      ],
    ],
    pick,
    v,
    ["List", at(state, 1), 0],
    upTo(1, N),
  );
  return [
    "Rest",
    fold(
      [
        "Apply",
        [
          "Function",
          ["Join", ["List", at("lc", 1)], ["Rest", state], ["List", at("lc", 2)]],
          ["Typed", "lc", "'list<integer>'"],
        ],
        choose,
      ],
      state,
      slot,
      ["List", R],
      upTo(1, K),
    ),
  ];
};

/** The lex rank of the K-subset `y` (ascending) of 1..N: before each member, the subsets that
 *  have a smaller value there. */
const lexKSubsetRank = (N: MathJSON, K: MathJSON, y: string): MathJSON =>
  fold(
    add(
      "kr",
      fold(
        add("kq", binomial(sub(N, "kv"), sub(K, "kj"))),
        "kq",
        "kv",
        0,
        upTo(add(["If", equal("kj", 1), 0, at(y, sub("kj", 1))], 1), sub(at(y, "kj"), 1)),
      ),
    ),
    "kr",
    "kj",
    0,
    upTo(1, K),
  );

interface Graded extends Shape {
  /** Whether subsets of this size belong. */
  readonly size?: (k: MathJSON) => MathJSON;
  /** No two members consecutive: a k-subset is a k-subset of 1..n − k + 1 with member i raised
   *  by i − 1, which keeps lex order. */
  readonly spread?: boolean;
}

/** Subsets of 1..n graded by size (the sizes `size` allows), lex within a size. */
function gradedSubsets(shape: Graded): EpsilFamily {
  const { size = () => "True", spread = false } = shape;
  const universe = (k: MathJSON): MathJSON => (spread ? add(sub("_n", k), 1) : "_n");
  const block = (k: MathJSON): MathJSON => ["If", size(k), binomial(universe(k), k), 0];
  const blocksBelow = (k: MathJSON): MathJSON => fold(add("gb", block("gt")), "gb", "gt", 0, upTo(0, sub(k, 1)));
  // Unrank: the size first (the first block holding the rank), then the lex member list.
  const sizeAndLeft = fold(
    [
      "If",
      ["GreaterEqual", at("gs", 2), 0],
      "gs",
      [
        "If",
        ["Less", at("gs", 1), block("gk")],
        ["List", at("gs", 1), "gk"],
        ["List", sub(at("gs", 1), block("gk")), -1],
      ],
    ],
    "gs",
    "gk",
    ["List", "_r", -1],
    upTo(0, "_n"),
  );
  const members = lexKSubset(universe(at("gp", 2)), at("gp", 2), at("gp", 1), "g");
  const unrank = [
    "Apply",
    [
      "Function",
      spread ? map(add(at("gm", "gi"), sub("gi", 1)), "gi", upTo(1, ["Length", "gm"])) : "gm",
      ["Typed", "gm", "'list<integer>'"],
    ],
    members,
  ];
  // Rank: the blocks of smaller sizes, then the lex rank among subsets of its own size.
  const lowered = spread ? map(sub(at("gx", "gi"), sub("gi", 1)), "gi", upTo(1, len)) : "gx";
  const rank = [
    "Apply",
    ["Function", add(blocksBelow(len), lexKSubsetRank(universe(len), len, "gy")), ["Typed", "gy", "'list<integer>'"]],
    ["Apply", ["Function", lowered, ["Typed", "gx", "'list<integer>'"]], ["Sort", "_x"]],
  ];
  const noneAdjacent = all((j) => ["Greater", sub(at("gz", j), at("gz", sub(j, 1))), 1], upTo(2, len), "ga");
  return {
    ...shapeOf(shape),
    epsil: {
      count: fold(add("gc", block("gn")), "gc", "gn", 0, upTo(0, "_n")),
      unrank: ["Apply", ["Function", unrank, ["Typed", "gp", "'list<integer>'"]], sizeAndLeft],
      rank,
      valid: [
        "And",
        distinctMembers("_n"),
        size(len),
        ...(spread ? [["Apply", ["Function", noneAdjacent, ["Typed", "gz", "'list<integer>'"]], ["Sort", "_x"]]] : []),
      ],
    },
  };
}

/** The subsets of 1..n, 2^n of them, graded by size and lex within a size. */
export const subsets = (shape: Shape): EpsilFamily => gradedSubsets(shape);

/** The k-subsets of 1..n in lex order, C(n, k) of them. */
export const kSubsets = (shape: Shape): EpsilFamily => gradedSubsets({ ...shape, size: (k) => equal(k, "_k") });

/** LatticePaths(a, b): the 0/1 words of a + b steps with a ones (the N steps), C(a + b, a) of them,
 *  in colex order of the ones' positions. The c-th one, at position j, has C(j − 1, c) words before
 *  it. Unrank walks from the end, its state [rank left, ones left, the steps found…]; rank's state
 *  is [rank, ones seen, j]. */
export function latticePaths(shape: Shape): EpsilFamily {
  const total = add("_a", "_b");
  const us = (i: number): MathJSON => at("lu_s", i);
  const rs = (i: number): MathJSON => at("lr_s", i);
  const unrankStep = [
    "Apply",
    [
      "Function",
      [
        "If",
        ["GreaterEqual", us(1), "lu_o"],
        ["Join", ["List", sub(us(1), "lu_o"), sub(us(2), 1), 1], ["Drop", "lu_s", 2]],
        ["Join", ["List", us(1), us(2), 0], ["Drop", "lu_s", 2]],
      ],
      ["Typed", "lu_o", "'integer'"],
    ],
    choose(sub("lu_j", 1), us(2)),
  ];
  const one = equal("lr_t", 1);
  const rankStep = [
    "List",
    add(rs(1), ["If", one, choose(sub(rs(3), 1), add(rs(2), 1)), 0]),
    add(rs(2), ["If", one, 1, 0]),
    add(rs(3), 1),
  ];
  return {
    ...shapeOf(shape),
    epsil: {
      count: choose(total, "_a"),
      unrank: ["Drop", fold(unrankStep, "lu_s", "lu_j", ["List", "_r", "_a"], ["Range", total, 1, -1]), 2],
      rank: at(fold(rankStep, "lr_s", "lr_t", ["List", 0, 0, 1], "_x"), 1),
      valid: [
        "And",
        equal(len, total),
        all((t) => between(t, 0, 1), "_x", "lv_t"),
        equal(fold(add("lv_c", "lv_u"), "lv_c", "lv_u", 0, "_x"), "_a"),
      ],
    },
  };
}

/** The subsets of 1..n with at most k members, graded by size. */
export const subsetsOfSizeAtMost = (shape: Shape): EpsilFamily =>
  gradedSubsets({ ...shape, size: (k) => ["LessEqual", k, "_k"] });

/** The subsets of 1..n of even (or odd) size, graded by size. */
export const subsetsOfParity = (shape: Shape, odd: boolean): EpsilFamily =>
  gradedSubsets({ ...shape, size: (k) => equal(["Mod", k, 2], odd ? 1 : 0) });

/** The subsets of 1..n with no two consecutive members, graded by size. */
export const subsetsWithoutConsecutive = (shape: Shape): EpsilFamily => gradedSubsets({ ...shape, spread: true });

/** The subsets of 1..n in binary-reflected Gray-code order: the mask is g = r xor (r >> 1), so
 *  bit i of g is bit i of r differing from bit i + 1; the rank is g's inverse, bit i of r being the
 *  parity of g's bits from i up, that is of how many members are at least i + 1. */
export function grayCodeSubsets(shape: Shape): EpsilFamily {
  const rankBit = (m: MathJSON): MathJSON => [
    "Mod",
    fold(add("c", ["If", ["GreaterEqual", element("t"), add(m, 1)], 1, 0]), "c", "t", 0, upTo(1, len)),
    2,
  ];
  return {
    ...shapeOf(shape),
    epsil: {
      count: pow(2, "_n"),
      unrank: membersWhere("_n", (i) => ["NotEqual", digitOf("_r", 2, sub(i, 1)), digitOf("_r", 2, i)]),
      rank: fold(add("acc", mul(pow(2, "m"), rankBit("m"))), "acc", "m", 0, upTo(0, sub("_n", 1))),
      valid: distinctMembers("_n"),
    },
  };
}

/** Length-n 0/1 words in binary-reflected Gray-code order (most significant bit first): entry j
 *  is bit n − j of r differing from bit n − j + 1; the rank is the prefix parity read back. */
export function grayCodes(shape: Shape): EpsilFamily {
  const prefixParity = (j: MathJSON): MathJSON => ["Mod", fold(add("c", element("t")), "c", "t", 0, upTo(1, j)), 2];
  return {
    ...shapeOf(shape),
    epsil: {
      count: pow(2, "_n"),
      unrank: map(
        ["Mod", add(digitOf("_r", 2, sub("_n", "j")), digitOf("_r", 2, add(sub("_n", "j"), 1))), 2],
        "j",
        upTo(1, "_n"),
      ),
      rank: fold(add("acc", mul(pow(2, sub("_n", "j")), prefixParity("j"))), "acc", "j", 0, upTo(1, "_n")),
      valid: ["And", equal(len, "_n"), all((j) => between(element(j), 0, 1), upTo(1, len), "j")],
    },
  };
}

/** Length-n binary words that read the same reversed: the first ⌈n/2⌉ entries are free, read as
 *  a binary number, and the rest mirror them. */
export function binaryPalindromes(shape: Shape): EpsilFamily {
  const half = quotient(add("_n", 1), 2);
  // The free entry an entry j mirrors: j itself in the first half, n + 1 − j after it.
  const free = (j: MathJSON): MathJSON => ["If", ["LessEqual", j, half], j, sub(add("_n", 1), j)];
  return {
    ...shapeOf(shape),
    epsil: {
      count: pow(2, half),
      unrank: map(digitOf("_r", 2, sub(half, free("j"))), "j", upTo(1, "_n")),
      rank: fold(add(mul("acc", 2), element("j")), "acc", "j", 0, upTo(1, half)),
      valid: [
        "And",
        equal(len, "_n"),
        all((j) => between(element(j), 0, 1), upTo(1, len), "j"),
        all((j) => equal(element(j), element(sub(add("_n", 1), j))), upTo(1, quotient("_n", 2)), "k"),
      ],
    },
  };
}

/** Length-n words over {0,1,2} in the base-3 reflected Gray code (most significant digit first):
 *  a digit of the rank is reflected (d ↦ 2 − d) when the digits before it have an odd sum,
 *  and d and 2 − d have the same parity, so the flip is the same read either way. */
export function ternaryGrayCodes(shape: Shape): EpsilFamily {
  const parityBefore = (digit: (k: MathJSON) => MathJSON, j: MathJSON): MathJSON => [
    "Mod",
    fold(add("c", digit("k")), "c", "k", 0, upTo(1, sub(j, 1))),
    2,
  ];
  const reflect = (digit: (k: MathJSON) => MathJSON, j: MathJSON): MathJSON => [
    "If",
    equal(parityBefore(digit, j), 0),
    digit(j),
    sub(2, digit(j)),
  ];
  const rankDigit = (k: MathJSON): MathJSON => digitOf("_r", 3, sub("_n", k));
  return {
    ...shapeOf(shape),
    epsil: {
      count: pow(3, "_n"),
      unrank: map(reflect(rankDigit, "j"), "j", upTo(1, "_n")),
      rank: fold(
        add(
          "acc",
          mul(
            pow(3, sub("_n", "j")),
            reflect((k) => element(k), "j"),
          ),
        ),
        "acc",
        "j",
        0,
        upTo(1, "_n"),
      ),
      valid: ["And", equal(len, "_n"), all((j) => between(element(j), 0, 2), upTo(1, len), "j")],
    },
  };
}

// ─── k-subsets and k-multisets: the colex combinatorial number system ─────────────────────────
// The rank-th k-subset of 1..n in colex order has, for i = k down to 1, its i-th smallest member
// one more than the greatest c with C(c, i) ≤ what is left of the rank after the larger members.
// Each digit depends on the one above's leftover, so `rBefore` folds the leftover down through
// the digits above i and `digitAt` is the greedy search at one digit. `tag` gives every nested
// Fold its own bound names, since a fold's variable must not collide with an enclosing or sibling
// fold's in one expression tree. (The same search writes CompositionsIntoKParts' cuts.)

const downTo = (from: MathJSON, to: MathJSON): MathJSON => ["Range", from, to, -1];

const digitAt = (i: MathJSON, left: MathJSON, universe: MathJSON, tag: string): MathJSON => {
  const c = `c_${tag}`;
  const best = `best_${tag}`;
  return fold(
    ["If", ["LessEqual", binomial(c, i), left], c, best],
    best,
    c,
    sub(i, 1),
    upTo(sub(i, 1), sub(universe, 1)),
  );
};
const leftover = (i: MathJSON, size: MathJSON, universe: MathJSON, tag: string): MathJSON => {
  const hi = `hi_${tag}`;
  const acc = `racc_${tag}`;
  return fold(sub(acc, binomial(digitAt(hi, acc, universe, `${tag}i`), hi)), acc, hi, "_r", downTo(size, add(i, 1)));
};
/** The m-th smallest member, 0-based, of the `size`-subset of 0..universe − 1 with rank `_r`. */
const colexMember = (m: MathJSON, size: MathJSON, universe: MathJSON): MathJSON =>
  digitAt(m, leftover(m, size, universe, "r"), universe, "d");

/** The k-multisets of 1..n as non-decreasing lists: the k-subset of 1..n + k − 1 with its i-th
 *  member lowered by i − 1. */
export function multisets(shape: Shape): EpsilFamily {
  const universe = sub(add("_n", "_k"), 1);
  return {
    ...shapeOf(shape),
    epsil: {
      count: binomial(universe, "_k"),
      unrank: map(sub(add(colexMember("m", "_k", universe), 2), "m"), "m", upTo(1, "_k")),
      rank: fold(add("acc", binomial(sub(add(element("j"), "j"), 2), "j")), "acc", "j", 0, upTo(1, len)),
      valid: [
        "And",
        equal(len, "_k"),
        all((j) => between(element(j), 1, "_n"), upTo(1, len), "j"),
        all((j) => ["LessEqual", element(sub(j, 1)), element(j)], upTo(2, len), "v"),
      ],
    },
  };
}
