// PermutationsAsCycles(n), defined in Epsil: every permutation of n as a cycle decomposition,
// fixed points kept. The order is graded by cycle type, the types in reverse lex order (the
// n-cycles first, the identity last), and within a type lex over the cycle lists: each cycle
// from its least point, the cycles in order of those points, a shorter cycle before a longer one
// it begins.
//
// Unrank walks the types, subtracting each type's count n!/z, then unranks within the type, one
// point at a time. Neither enumerates the n! permutations. The TS kernel in ../families/
// permutations.ts, which does, stays as the independent reading the agreement test checks it by.
//
// The types are walked as (a, m): the largest part a, taken m times, the rest parts below a, in
// reverse lex order (a descending, then m descending). W(b, r), the permutations of r points
// whose cycles all have length at most b, counts each block.
//
// Within a type, with s the points not in a closed cycle, j the open cycle's length so far and
// c the type's remaining multiplicities, an open cycle either ends (the first choice: T options)
// or goes on with any of the free points, each with C completions; both are exact integers:
//   T = (s − j)! j c_j / z    and    C = (s − j − 1)! (Σ_{l > j} l c_l) / z,    z = Π k^c_k c_k!.

import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import {
  add,
  all,
  and,
  at,
  cell,
  equal,
  fold,
  iff,
  less,
  lets,
  map,
  mul,
  quotient,
  rowTable,
  sub,
  upTo,
  withTable,
} from "../../../collections/src/families/tables.ts";

type MathJSON = unknown;

// Every Range states its step: compute-engine counts down when the end is below the start.
const downTo = (from: MathJSON, to: MathJSON): MathJSON => ["Range", from, to, -1];
const factorial = (n: MathJSON): MathJSON => ["Factorial", n];

/** `list` with each `[index, value]` replaced, in order: a chain of `ReplaceAt`, which a fold
 *  carries in place. Every read of the list is an `At`. */
const replacing = (list: MathJSON, ...updates: (readonly [MathJSON, MathJSON])[]): MathJSON =>
  updates.reduce<MathJSON>((inner, [index, value]) => ["ReplaceAt", inner, index, value], list);

/** The ways to cut m cycles of length a out of `rem` points: rem! / ((rem − am)! a^m m!). */
const cycles = (rem: MathJSON, a: MathJSON, m: MathJSON): MathJSON => [
  "Divide",
  factorial(rem),
  mul(factorial(sub(rem, mul(a, m))), ["Power", a, m], factorial(m)),
];

// W(b, r), for b and r in 0..n: W(b, r) = Σ_m cycles(r, b, m) W(b − 1, r − bm).
const width = add("_n", 1);
const wTable = rowTable(
  "w",
  add("_n", 1),
  width,
  (r) => iff(equal(r, 0), 1, 0),
  (prev, b, r) =>
    fold(
      add("wa", mul(cycles(r, b, "wm"), prev(sub(b, 1), sub(r, mul(b, "wm"))))),
      "wa",
      "wm",
      0,
      upTo(0, quotient(r, b)),
    ),
);
const W = cell("w", width);
const withW = (body: MathJSON): MathJSON => withTable("w", wTable, body);

// The type walk's state is [r, rem, F, c_1 … c_n]: r the rank left within what is chosen so far,
// rem the points not yet in a part, F the permutations a placement of the parts so far leaves
// room for (the product of `cycles` over the parts), c the multiplicities chosen.
const state = (parts: MathJSON): MathJSON => ["Join", ["List", "_r", "_n", 1], parts];

/** The block of types whose next part is a, taken m times: F · cycles(rem, a, m) · W(a − 1, rem − am). */
const typeBlock = (f: MathJSON, rem: MathJSON, a: MathJSON, m: MathJSON): MathJSON =>
  mul(f, cycles(rem, a, m), W(sub(a, 1), sub(rem, mul(a, m))));

/** One part size a, from n down: the m (from the most that fit, down) whose block holds r, if
 *  any, skipping the blocks before it. */
const typeStep = lets(
  [
    ["tr", at("ts", 1), "integer"],
    ["tm", at("ts", 2), "integer"],
    ["tf", at("ts", 3), "integer"],
    ["tt", quotient("tm", "ta"), "integer"],
    [
      "tp",
      fold(
        iff(
          less(0, at("sc", 2)),
          "sc",
          lets(
            [["sb", typeBlock("tf", "tm", "ta", sub(add("tt", 1), "ti")), "integer"]],
            iff(
              less(at("sc", 1), "sb"),
              ["List", at("sc", 1), sub(add("tt", 1), "ti")],
              ["List", sub(at("sc", 1), "sb"), 0],
            ),
          ),
        ),
        "sc",
        "ti",
        ["List", "tr", 0],
        upTo(1, "tt"),
      ),
      "list<integer>",
    ],
  ],
  replacing(
    "ts",
    [1, at("tp", 1)],
    [2, sub("tm", mul("ta", at("tp", 2)))],
    [3, mul("tf", cycles("tm", "ta", at("tp", 2)))],
    [add("ta", 3), at("tp", 2)],
  ),
);
const typeWalk: MathJSON = fold(typeStep, "ts", "ta", state(map(0, "tz", upTo(1, "_n"))), downTo("_n", 1));

// The cycle walk's state: [t, s, j, z, nc], then four arrays of n: c (the multiplicities left),
// used (points placed), val (the point placed at each step) and cyc (its cycle's number).
const BASE = 5;
const cI = (k: MathJSON): MathJSON => add(k, BASE);
const uI = (k: MathJSON): MathJSON => add("_n", k, BASE);
const vI = (k: MathJSON): MathJSON => add(mul(2, "_n"), k, BASE);
const yI = (k: MathJSON): MathJSON => add(mul(3, "_n"), k, BASE);

/** z = Π k^c_k c_k! of the multiplicities c_k = `count(k)`. */
const zOf = (count: (k: MathJSON) => MathJSON): MathJSON =>
  fold(mul("zz", ["Power", "zk", count("zk")], factorial(count("zk"))), "zz", "zk", 1, upTo(1, "_n"));

/** 1 in the first slot of n, 0 after: point 1 placed. */
const first: MathJSON = ["Join", ["List", 1], map(0, "fz", upTo(2, "_n"))];

/** Σ_{l > j} l c_l, read from a state `list` laid out as above. */
const longer = (list: MathJSON, j: MathJSON): MathJSON =>
  fold(add("la", mul("lq", at(list, cI("lq")))), "la", "lq", 0, upTo(add(j, 1), "_n"));

/** One point of the cycles, after the first: the open cycle ends (a new one starts at the least
 *  free point) when the rank falls among its T endings, else it goes on with the free point the
 *  rest of the rank picks, the d-th smallest, each worth C completions. */
const unrankStep = lets(
  [
    ["ct", at("cs", 1), "integer"],
    ["cn", at("cs", 2), "integer"],
    ["cj", at("cs", 3), "integer"],
    ["cz", at("cs", 4), "integer"],
    ["cnc", at("cs", 5), "integer"],
    ["cm", at("cs", cI("cj")), "integer"],
    ["cends", quotient(mul(factorial(sub("cn", "cj")), "cj", "cm"), "cz"), "integer"],
    ["cfree", ["Filter", upTo(1, "_n"), ["Function", equal(at("cs", uI("fq")), 0), "fq"]], "list<integer>"],
  ],
  iff(
    less("ct", "cends"),
    lets(
      [["cx", at("cfree", 1), "integer"]],
      replacing(
        "cs",
        [2, sub("cn", "cj")],
        [3, 1],
        [4, quotient("cz", mul("cj", "cm"))],
        [5, add("cnc", 1)],
        [cI("cj"), sub("cm", 1)],
        [uI("cx"), 1],
        [vI("ck"), "cx"],
        [yI("ck"), add("cnc", 1)],
      ),
    ),
    lets(
      [
        ["cr", sub("ct", "cends"), "integer"],
        ["cper", quotient(mul(factorial(sub(sub("cn", "cj"), 1)), longer("cs", "cj")), "cz"), "integer"],
        ["cd", quotient("cr", "cper"), "integer"],
        ["cx", at("cfree", add("cd", 1)), "integer"],
      ],
      replacing(
        "cs",
        [1, sub("cr", mul("cd", "cper"))],
        [3, add("cj", 1)],
        [uI("cx"), 1],
        [vI("ck"), "cx"],
        [yI("ck"), "cnc"],
      ),
    ),
  ),
);

const unrank: MathJSON = withW(
  iff(
    equal("_n", 0),
    ["List"],
    lets(
      [
        ["ty", typeWalk, "list<integer>"],
        [
          "cend",
          fold(
            unrankStep,
            "cs",
            "ck",
            [
              "Join",
              ["List", at("ty", 1), "_n", 1, zOf((k) => at("ty", add(k, 3))), 1],
              ["Drop", "ty", 3],
              first,
              first,
              first,
            ],
            upTo(2, "_n"),
          ),
          "list<integer>",
        ],
      ],
      map(
        map(at("cend", vI("ep")), "ep", [
          "Filter",
          upTo(1, "_n"),
          ["Function", equal(at("cend", yI("eq")), "eu"), "eq"],
        ]),
        "eu",
        upTo(1, at("cend", 5)),
      ),
    ),
  ),
);

// Rank walks the same two levels, driven by the element instead of the rank.

/** The permutations in the blocks before the element's type, in the type walk's state
 *  [offset, rem, F]: each part size a from n down skips the blocks of more copies of it. */
const typeRankStep = lets(
  [
    ["oo", at("os", 1), "integer"],
    ["orm", at("os", 2), "integer"],
    ["of", at("os", 3), "integer"],
    ["om", at("rc", "oa"), "integer"],
  ],
  [
    "List",
    add(
      "oo",
      mul(
        "of",
        fold(
          add("os2", mul(cycles("orm", "oa", "oj"), W(sub("oa", 1), sub("orm", mul("oa", "oj"))))),
          "os2",
          "oj",
          0,
          upTo(add("om", 1), quotient("orm", "oa")),
        ),
      ),
    ),
    sub("orm", mul("oa", "om")),
    mul("of", cycles("orm", "oa", "om")),
  ],
);

const rankStep = lets(
  [
    ["rx", at("flat", "rk"), "integer"],
    ["rt", at("rs", 1), "integer"],
    ["rn", at("rs", 2), "integer"],
    ["rj", at("rs", 3), "integer"],
    ["rz", at("rs", 4), "integer"],
    ["rm", at("rs", cI("rj")), "integer"],
  ],
  iff(
    ["Contains", "starts", "rk"],
    replacing(
      "rs",
      [2, sub("rn", "rj")],
      [3, 1],
      [4, quotient("rz", mul("rj", "rm"))],
      [cI("rj"), sub("rm", 1)],
      [uI("rx"), 1],
    ),
    lets(
      [
        ["rends", quotient(mul(factorial(sub("rn", "rj")), "rj", "rm"), "rz"), "integer"],
        ["rper", quotient(mul(factorial(sub(sub("rn", "rj"), 1)), longer("rs", "rj")), "rz"), "integer"],
        [
          "rd",
          ["Count", ["Filter", upTo(1, sub("rx", 1)), ["Function", equal(at("rs", uI("rq")), 0), "rq"]]],
          "integer",
        ],
      ],
      replacing("rs", [1, add("rt", "rends", mul("rd", "rper"))], [3, add("rj", 1)], [uI("rx"), 1]),
    ),
  ),
);

const rank: MathJSON = withW(
  iff(
    equal("_n", 0),
    0,
    lets(
      [
        ["flat", ["Flatten", "_x"], "list<integer>"],
        ["lens", map(["Length", "lc"], "lc", "_x"), "list<integer>"],
        [
          "rc",
          map(["Count", ["Filter", "lens", ["Function", equal("ll", "ra"), "ll"]]], "ra", upTo(1, "_n")),
          "list<integer>",
        ],
        [
          "starts",
          fold(
            ["Join", "sa", ["List", add(at("sa", ["Length", "sa"]), at("lens", "si"))]],
            "sa",
            "si",
            ["List", 1],
            upTo(1, sub(["Length", "lens"], 1)),
          ),
          "list<integer>",
        ],
        ["off", at(fold(typeRankStep, "os", "oa", ["List", 0, "_n", 1], downTo("_n", 1)), 1), "integer"],
      ],
      add(
        "off",
        at(
          fold(
            rankStep,
            "rs",
            "rk",
            ["Join", ["List", 0, "_n", 1, zOf((k) => at("rc", k)), 0], "rc", first],
            upTo(2, "_n"),
          ),
          1,
        ),
      ),
    ),
  ),
);

/** Cycles that are nonempty, each from its least point, with first points ascending, covering 1..n. */
const valid: MathJSON = lets(
  [["flat", ["Flatten", "_x"], "list<integer>"]],
  and(
    all((i) => ["GreaterEqual", ["Length", at("_x", i)], 1], upTo(1, ["Length", "_x"]), "vi"),
    equal(["Length", "flat"], "_n"),
    all((i) => ["Contains", "flat", i], upTo(1, "_n"), "vp"),
    all(
      (i) =>
        all((p) => ["GreaterEqual", at(at("_x", i), p), at(at("_x", i), 1)], upTo(1, ["Length", at("_x", i)]), "vq"),
      upTo(1, ["Length", "_x"]),
      "vc",
    ),
    all((i) => less(at(at("_x", i), 1), at(at("_x", add(i, 1)), 1)), upTo(1, sub(["Length", "_x"], 1)), "vk"),
  ),
);

export const permutationsAsCycles: EpsilFamily = {
  head: "PermutationsAsCycles",
  carrier: "CycleDecomposition",
  paramCount: 1,
  kind: "blocks",
  params: ["_n"],
  declared: {
    carrier: "CycleDecomposition",
    params: [{ name: "n", role: "axis", min: 0 }],
    cost: { count: "closed", unrank: "polynomial", rank: "polynomial", valid: "polynomial" },
  },
  epsil: { count: factorial("_n"), unrank, rank, valid },
};
