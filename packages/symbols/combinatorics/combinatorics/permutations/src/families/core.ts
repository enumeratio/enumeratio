// The permutation families, defined in Epsil (see collections/src/families/epsil.ts): the
// symmetric group, k-permutations, signed, coloured and cyclic permutations, involutions and
// derangements. Each is ordered by rank, and the rank is read off the element: a mixed-radix
// number for most, a fold peeling off the largest free label for involutions and derangements.

import type { AnyFamily, EpsilFamily } from "../../../collections/src/families/epsil.ts";
import { bind } from "../../../src/map-helpers.ts";

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

// Involutions and derangements are ranked by peeling off the largest label still free, which
// leaves a smaller set to rank in turn. The set is a fold's list state: one slot per label (0
// while it is free, else its image, or 1 for "taken" when ranking), with the running rank or
// leftover r after them. Each step binds the free labels once.

// map-helpers' MathJSON is structural; definitions here are built as `unknown`.
const typedBind = bind as (name: string, value: MathJSON, body: MathJSON, type?: string) => MathJSON;
const lets = (bindings: readonly [string, MathJSON, string][], body: MathJSON): MathJSON =>
  bindings.reduceRight<MathJSON>((inner, [name, value, type]) => typedBind(name, value, inner, type), body);
const freeLabels = (state: string): MathJSON => [
  "Filter",
  upTo(1, "_n"),
  ["Function", ["Equal", at(state, "x"), 0], "x"],
];
/** The state after one step: each slot of `state` rewritten to `value(slot)`. */
const rewrite = (state: string, size: MathJSON, value: (slot: string) => MathJSON): MathJSON =>
  map(value("slot"), "slot", upTo(1, size));
const slots = add("_n", 1);

// Telephone and subfactorial numbers come from a table built once per call by their
// recurrences, then read by index: summing factorials afresh at every step costs more than the
// rest of the step.

/** T(0..n), the involutions of 0..n: T(i) = T(i − 1) + (i − 1) T(i − 2). */
const telephoneTable = fold(
  ["Append", "tt", add(at("tt", "ti"), ["Multiply", sub("ti", 1), at("tt", sub("ti", 1))])],
  "tt",
  "ti",
  ["List", 1, 1],
  upTo(2, "_n"),
);
/** D(0..n), the derangements of 0..n: D(i) = (i − 1) (D(i − 1) + D(i − 2)). */
const subfactorialTable = fold(
  ["Append", "dt", ["Multiply", sub("di", 1), add(at("dt", "di"), at("dt", sub("di", 1)))]],
  "dt",
  "di",
  ["List", 1, 0],
  upTo(2, "_n"),
);
/** T(m), from the table bound as `telephones`. */
const telephone = (m: MathJSON): MathJSON => at("telephones", add(m, 1));
/** D(m), from the table bound as `subfactorials`, and 0 for m < 0. */
const subfactorial = (m: MathJSON): MathJSON => ["If", ["Less", m, 0], 0, at("subfactorials", add(m, 1))];
const withTelephones = (body: MathJSON): MathJSON => typedBind("telephones", telephoneTable, body, "list<integer>");
const withSubfactorials = (body: MathJSON): MathJSON =>
  typedBind("subfactorials", subfactorialTable, body, "list<integer>");

const permutationOfN = (then: MathJSON): MathJSON =>
  hasLength("_x", "_n", ["If", injective("_n", "_n", element), then, "False"]);

// Involutions: of m free labels, the largest is either fixed (the first T(m − 1) ranks) or
// paired with the j-th free label below it (T(m − 2) ranks each).
const involutionUnrankStep = lets(
  [
    ["L", freeLabels("s"), "list<integer>"],
    ["m", ["Length", "L"], "integer"],
  ],
  [
    "If",
    ["Equal", "m", 0],
    "s",
    lets(
      [
        ["r", at("s", slots), "integer"],
        ["t1", telephone(sub("m", 1)), "integer"],
        ["last", at("L", "m"), "integer"],
      ],
      [
        "If",
        ["Less", "r", "t1"],
        rewrite("s", slots, (p) => ["If", ["Equal", p, "last"], "last", at("s", p)]),
        lets(
          [
            ["t2", telephone(sub("m", 2)), "integer"],
            ["left", sub("r", "t1"), "integer"],
            ["partner", at("L", add(quotient("left", "t2"), 1)), "integer"],
          ],
          rewrite("s", slots, (p) => [
            "If",
            ["Equal", p, "last"],
            "partner",
            ["If", ["Equal", p, "partner"], "last", ["If", ["Equal", p, slots], ["Mod", "left", "t2"], at("s", p)]],
          ]),
        ),
      ],
    ),
  ],
);

const involutionRankStep = lets(
  [
    ["L", freeLabels("s"), "list<integer>"],
    ["m", ["Length", "L"], "integer"],
  ],
  [
    "If",
    ["LessEqual", "m", 1],
    "s",
    lets(
      [
        ["last", at("L", "m"), "integer"],
        ["partner", element("last"), "integer"],
      ],
      [
        "If",
        ["Equal", "partner", "last"],
        rewrite("s", slots, (p) => ["If", ["Equal", p, "last"], 1, at("s", p)]),
        rewrite("s", slots, (p) => [
          "If",
          ["Or", ["Equal", p, "last"], ["Equal", p, "partner"]],
          1,
          [
            "If",
            ["Equal", p, slots],
            add(at("s", slots), telephone(sub("m", 1)), [
              "Multiply",
              ["Count", ["Filter", "L", ["Function", ["Less", "y", "partner"], "y"]]],
              telephone(sub("m", 2)),
            ]),
            at("s", p),
          ],
        ]),
      ],
    ),
  ],
);

/** The self-inverse permutations of n, T(n) of them. */
const involutions: EpsilFamily = {
  head: "Involutions",
  carrier: "Permutation",
  paramCount: 1,
  kind: "ints",
  params: ["_n"],
  epsil: {
    count: withTelephones(telephone("_n")),
    unrank: withTelephones([
      "Most",
      fold(involutionUnrankStep, "s", "step", ["Append", map(0, "y", upTo(1, "_n")), "_r"], upTo(1, "_n")),
    ]),
    rank: withTelephones(
      at(fold(involutionRankStep, "s", "step", ["Append", map(0, "y", upTo(1, "_n")), 0], upTo(1, "_n")), slots),
    ),
    valid: permutationOfN(all((j) => ["Equal", element(element(j)), j], upTo(1, "_n"))),
  },
};

// Derangements: of s free labels, the largest m goes to the label of index ⌊r / (D(s−2) + D(s−1))⌋
// below it. Either the two swap (the first D(s − 2) of those ranks), or m is spliced into a
// derangement of the other s − 1 labels: the label that went to p goes to m instead. A splice
// needs the smaller derangement first, so unranking records each step's choice in a slot of its
// own (p for a swap, −p for a splice, at m), then applies the choices smallest m first.
const derangementChoiceStep = lets(
  [
    ["L", freeLabels("s"), "list<integer>"],
    ["size", ["Length", "L"], "integer"],
  ],
  [
    "If",
    ["Equal", "size", 0],
    "s",
    lets(
      [
        ["r", at("s", add(["Multiply", 2, "_n"], 1)), "integer"],
        ["swaps", subfactorial(sub("size", 2)), "integer"],
        ["block", add("swaps", subfactorial(sub("size", 1))), "integer"],
        ["m", at("L", "size"), "integer"],
        ["p", at("L", add(quotient("r", "block"), 1)), "integer"],
        ["left", ["Mod", "r", "block"], "integer"],
      ],
      [
        "If",
        ["Less", "left", "swaps"],
        rewrite("s", add(["Multiply", 2, "_n"], 1), (q) => [
          "If",
          ["Or", ["Equal", q, "m"], ["Equal", q, "p"]],
          1,
          [
            "If",
            ["Equal", q, add("_n", "m")],
            "p",
            ["If", ["Equal", q, add(["Multiply", 2, "_n"], 1)], "left", at("s", q)],
          ],
        ]),
        rewrite("s", add(["Multiply", 2, "_n"], 1), (q) => [
          "If",
          ["Equal", q, "m"],
          1,
          [
            "If",
            ["Equal", q, add("_n", "m")],
            ["Negate", "p"],
            ["If", ["Equal", q, add(["Multiply", 2, "_n"], 1)], sub("left", "swaps"), at("s", q)],
          ],
        ]),
      ],
    ),
  ],
);
/** Choice at m applied to the image built so far, `t`: a swap sets both ends, a splice reroutes. */
const derangementApplyStep = lets(
  [["c", at("choices", "m"), "integer"]],
  [
    "If",
    ["Equal", "c", 0],
    "t",
    [
      "If",
      ["Greater", "c", 0],
      map(["If", ["Equal", "q", "m"], "c", ["If", ["Equal", "q", "c"], "m", at("t", "q")]], "q", upTo(1, "_n")),
      map(
        [
          "If",
          ["Equal", "q", "m"],
          ["Negate", "c"],
          ["If", ["Equal", at("t", "q"), ["Negate", "c"]], "m", at("t", "q")],
        ],
        "q",
        upTo(1, "_n"),
      ),
    ],
  ],
);
const derangementChoices = lets(
  [
    [
      "final",
      fold(
        derangementChoiceStep,
        "s",
        "step",
        ["Append", map(0, "y", upTo(1, ["Multiply", 2, "_n"])), "_r"],
        upTo(1, "_n"),
      ),
      "list<integer>",
    ],
  ],
  map(at("final", add("_n", "m")), "m", upTo(1, "_n")),
);

// Ranking reverses it, largest label first: a swap adds its block's start; a splice adds the
// swaps too, and undoes the reroute (the label that went to m goes to p) before going on.
const derangementRankStep = lets(
  [
    ["L", freeLabels("s"), "list<integer>"],
    ["size", ["Length", "L"], "integer"],
  ],
  [
    "If",
    ["Equal", "size", 0],
    "s",
    lets(
      [
        ["m", at("L", "size"), "integer"],
        ["p", at("s", add("_n", "m")), "integer"],
        ["swaps", subfactorial(sub("size", 2)), "integer"],
        [
          "start",
          [
            "Multiply",
            ["Count", ["Filter", "L", ["Function", ["Less", "y", "p"], "y"]]],
            add("swaps", subfactorial(sub("size", 1))),
          ],
          "integer",
        ],
      ],
      [
        "If",
        ["Equal", at("s", add("_n", "p")), "m"],
        rewrite("s", add(["Multiply", 2, "_n"], 1), (q) => [
          "If",
          ["Or", ["Equal", q, "m"], ["Equal", q, "p"]],
          1,
          ["If", ["Equal", q, add(["Multiply", 2, "_n"], 1)], add(at("s", q), "start"), at("s", q)],
        ]),
        rewrite("s", add(["Multiply", 2, "_n"], 1), (q) => [
          "If",
          ["Equal", q, "m"],
          1,
          [
            "If",
            ["Equal", q, add(["Multiply", 2, "_n"], 1)],
            add(at("s", q), "start", "swaps"),
            ["If", ["And", ["Greater", q, "_n"], ["Equal", at("s", q), "m"]], "p", at("s", q)],
          ],
        ]),
      ],
    ),
  ],
);

/** The permutations of n with no fixed point, D(n) of them. */
const derangements: EpsilFamily = {
  head: "Derangements",
  carrier: "Permutation",
  paramCount: 1,
  kind: "ints",
  params: ["_n"],
  epsil: {
    count: withSubfactorials(subfactorial("_n")),
    unrank: withSubfactorials(
      typedBind(
        "choices",
        derangementChoices,
        fold(derangementApplyStep, "t", "m", map(0, "y", upTo(1, "_n")), upTo(1, "_n")),
        "list<integer>",
      ),
    ),
    rank: withSubfactorials(
      at(
        fold(
          derangementRankStep,
          "s",
          "step",
          ["Append", ["Join", map(0, "y", upTo(1, "_n")), "_x"], 0],
          upTo(1, "_n"),
        ),
        add(["Multiply", 2, "_n"], 1),
      ),
    ),
    valid: permutationOfN(all((j) => ["NotEqual", element(j), j], upTo(1, "_n"))),
  },
};

export const epsilEntries: readonly EpsilFamily[] = [
  symmetricGroup,
  kPermutations,
  signedPermutations,
  cyclicPermutations,
  involutions,
  derangements,
  colouredPermutations,
];

/** Every family here, in catalogue order. */
export const families: readonly AnyFamily[] = [
  symmetricGroup,
  kPermutations,
  signedPermutations,
  cyclicPermutations,
  involutions,
  derangements,
  colouredPermutations,
];
