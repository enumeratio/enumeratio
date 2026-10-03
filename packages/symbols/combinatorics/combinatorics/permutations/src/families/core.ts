// The permutation families, defined in Epsil (see collections/src/families/epsil.ts): the
// symmetric group, k-permutations, signed, coloured and cyclic permutations, involutions and
// derangements. Each is ordered by rank, and the rank is read off the element: a mixed-radix
// number for most, a fold peeling off the largest free label for involutions and derangements.

import type { AnyFamily, EpsilFamily } from "../../../collections/src/families/epsil.ts";
import { permutationRestriction } from "../../../collections/src/families/lex-restriction.ts";
import { cell, lets, rowTable } from "../../../collections/src/families/tables.ts";

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

// Restrictions of the symmetric group, in its lex order: the k-th member is the k-th
// permutation of n, in lex order, that the restriction contains. Each is defined by how many
// of its members start with a given prefix (`permutationRestriction`): `prefix` holds n slots,
// the first `filled` set, the rest 0.

const pre = (q: MathJSON): MathJSON => at("prefix", q);
const filledSlots = upTo(1, "filled");

/**
 * Following the prefix from slot s: the cycle's length when it returns to s, as −length; −(n + 1)
 * when it runs into an unfilled slot first; and with `leaderOnly`, −(n + 2) when it meets a slot
 * smaller than s, so that a cycle is counted once, at its least point.
 */
const walk = (s: string, leaderOnly = false): MathJSON =>
  fold(
    [
      "If",
      ["LessEqual", `w_${s}`, 0],
      `w_${s}`,
      [
        "If",
        ["Equal", `w_${s}`, s],
        ["Negate", `k_${s}`],
        [
          "If",
          ["Greater", `w_${s}`, "filled"],
          ["Negate", add("_n", 1)],
          leaderOnly ? ["If", ["Less", `w_${s}`, s], ["Negate", add("_n", 2)], pre(`w_${s}`)] : pre(`w_${s}`),
        ],
      ],
    ],
    `w_${s}`,
    `k_${s}`,
    pre(s),
    upTo(1, "_n"),
  );
/** `body` over the result of the walk from s, bound once: read twice, it would walk twice. */
const walked = (s: string, leaderOnly: boolean, body: (w: string) => MathJSON): MathJSON =>
  lets([[`wk_${s}`, walk(s, leaderOnly), "integer"]], body(`wk_${s}`));
/** Whether the walk from s came back to s, closing a cycle. */
const closes = (result: MathJSON): MathJSON => ["And", ["Less", result, 0], ["GreaterEqual", result, ["Negate", "_n"]]];

/** The permutations of n that are a single n-cycle, (n − 1)! of them for n ≥ 1. A prefix
 *  extends to one unless it already closes a cycle; its paths (one per label nothing maps to
 *  yet, n − filled of them) join into a single cycle in (n − filled − 1)! ways. */
const cyclicPermutations: EpsilFamily = permutationRestriction({
  head: "CyclicPermutations",
  carrier: "Permutation",
  paramCount: 1,
  params: ["_n"],
  completions: [
    "If",
    ["Less", "_n", 1],
    0,
    [
      "If",
      fold(
        ["Or", "short", walked("cs", false, (w) => ["And", closes(w), ["Less", ["Negate", w], "_n"]])],
        "short",
        "cs",
        "False",
        filledSlots,
      ),
      0,
      ["If", ["Equal", "filled", "_n"], 1, ["Factorial", sub(sub("_n", "filled"), 1)]],
    ],
  ],
});

/** The permutations of n with exactly k cycles, c(n, k) of them (unsigned Stirling numbers of
 *  the first kind). A prefix has closed some cycles already, q of them; its n − filled open
 *  paths close into the remaining k − q cycles in c(n − filled, k − q) ways. */
const stirlingWidth = add("_n", 1);
const stirling = cell("stirling", stirlingWidth);
export const kCyclePermutations: EpsilFamily = permutationRestriction({
  head: "KCyclePermutations",
  carrier: "Permutation",
  paramCount: 2,
  params: ["_n", "_k"],
  tables: [
    "stirling",
    rowTable(
      "st",
      add("_n", 1),
      stirlingWidth,
      (c) => ["If", ["Equal", c, 0], 1, 0],
      (prev, r, c) => [
        "If",
        ["Equal", c, 0],
        0,
        add(prev(sub(r, 1), sub(c, 1)), ["Multiply", sub(r, 1), prev(sub(r, 1), c)]),
      ],
    ),
  ],
  completions: lets(
    [
      [
        "left",
        sub(
          "_k",
          fold(
            add(
              "q",
              walked("ks", true, (w) => ["If", closes(w), 1, 0]),
            ),
            "q",
            "ks",
            0,
            filledSlots,
          ),
        ),
        "integer",
      ],
      ["open", sub("_n", "filled"), "integer"],
    ],
    ["If", ["Or", ["Less", "left", 0], ["Greater", "left", "open"]], 0, stirling("open", "left")],
  ),
});

/** The permutations of n with no fixed point, D(n) of them. Of the open slots, m have their own
 *  label still free; by inclusion–exclusion over those, Σ (−1)^i C(m, i) (n − filled − i)!. */
const derangements: EpsilFamily = permutationRestriction({
  head: "Derangements",
  carrier: "Permutation",
  paramCount: 1,
  params: ["_n"],
  completions: [
    "If",
    all((q) => ["NotEqual", pre(q), q], filledSlots, "dq"),
    lets(
      [
        [
          "m",
          fold(
            add("dm", [
              "If",
              fold(["Or", "taken", ["Equal", pre("dt"), "dp"]], "taken", "dt", "False", filledSlots),
              0,
              1,
            ]),
            "dm",
            "dp",
            0,
            upTo(add("filled", 1), "_n"),
          ),
          "integer",
        ],
      ],
      fold(
        add("dsum", [
          "Multiply",
          ["Power", -1, "di"],
          ["Binomial", "m", "di"],
          ["Factorial", sub(sub("_n", "filled"), "di")],
        ]),
        "dsum",
        "di",
        0,
        upTo(0, "m"),
      ),
    ),
    0,
  ],
});

/** T(0..n), the involutions of 0..n: T(i) = T(i − 1) + (i − 1) T(i − 2). The list is its full
 *  length from the seed on, so each step is one `ReplaceAt` and the compiled fold fills it in
 *  place; the step only reads the list through `At`. */
const telephoneTable = fold(
  ["ReplaceAt", "tt", add("ti", 1), add(at("tt", "ti"), ["Multiply", sub("ti", 1), at("tt", sub("ti", 1))])],
  "tt",
  "ti",
  ["Join", ["List", 1, 1], map(0, "tz", upTo(3, add("_n", 1)))],
  upTo(2, "_n"),
);

/** The self-inverse permutations of n, T(n) of them (telephone numbers). A prefix is consistent
 *  when each slot that points back into the prefix is pointed back at; the labels it hasn't
 *  touched (neither a filled slot nor pointed at by one) pair up or stay fixed in T(free) ways. */
const involutions: EpsilFamily = permutationRestriction({
  head: "Involutions",
  carrier: "Permutation",
  paramCount: 1,
  params: ["_n"],
  tables: ["telephones", telephoneTable],
  completions: [
    "If",
    all((q) => ["If", ["LessEqual", pre(q), "filled"], ["Equal", pre(pre(q)), q], "True"], filledSlots, "iq"),
    at(
      "telephones",
      add(
        sub(
          sub("_n", "filled"),
          fold(add("ahead", ["If", ["Greater", pre("ip"), "filled"], 1, 0]), "ahead", "ip", 0, filledSlots),
        ),
        1,
      ),
    ),
    0,
  ],
});

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
