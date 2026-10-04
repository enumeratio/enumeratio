// Words-area families defined in Epsil. Their TS kernels (words.ts, binary-word-families.ts,
// tableaux-trees.ts) stay exported: the independent reading the agreement tests check these against.
//   - closed form: BinaryWordsByWeight (a walk over the binomials), StirlingPermutations (mixed radix)
//   - completion table (`FamilyEpsil.tables`): FibStrings, LucasStrings, NonDecreasingParkingFunctions
import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import {
  add,
  all,
  and,
  at,
  cell,
  choose,
  equal,
  fold,
  iff,
  less,
  lets,
  mul,
  quotient,
  rowTable,
  sub,
  upTo,
} from "../../../collections/src/families/tables.ts";

type MathJSON = unknown;

const list = (...xs: MathJSON[]): MathJSON => ["List", ...xs];
const join = (...xs: MathJSON[]): MathJSON => ["Join", ...xs];
const drop = (xs: MathJSON, n: MathJSON): MathJSON => ["Drop", xs, n];
const x = (j: MathJSON): MathJSON => at("_x", j);
const len: MathJSON = ["Length", "_x"];
const between = (v: MathJSON, low: MathJSON, high: MathJSON): MathJSON =>
  and(["LessEqual", low, v], ["LessEqual", v, high]);
const bits = (): MathJSON => all((j) => between(x(j), 0, 1), upTo(1, len), "j");

// ─── BinaryWordsByWeight(n, k): lex order, 0 before 1. Placing a 0 at position i leaves the words
// of the n − i later positions holding all the k ones left: C(n − i, ones) of them, which sort
// first (the count is 0 once the ones outnumber the positions, and 1 with no ones left). ──────────
export const binaryWordsByWeight: EpsilFamily = {
  head: "BinaryWordsByWeight",
  carrier: "BinaryWord",
  paramCount: 2,
  kind: "ints",
  params: ["_n", "_k"],
  epsil: {
    count: choose("_n", "_k"),
    // The state is [rank left, ones left, the bits so far…]; a 1 goes in when the rank is not
    // under the zero block. The block is bound as an integer: untyped, the compiler reads the
    // state as complex.
    unrank: drop(
      fold(
        lets(
          [["bz", choose(sub("_n", "bi"), at("bs", 2)), "integer"]],
          iff(
            less(at("bs", 1), "bz"),
            join(list(at("bs", 1), at("bs", 2)), drop("bs", 2), list(0)),
            join(list(sub(at("bs", 1), "bz"), sub(at("bs", 2), 1)), drop("bs", 2), list(1)),
          ),
        ),
        "bs",
        "bi",
        list("_r", "_k"),
        upTo(1, "_n"),
      ),
      2,
    ),
    // The state is [rank so far, ones left].
    rank: at(
      fold(
        lets(
          [["rz", choose(sub("_n", "ri"), at("rs", 2)), "integer"]],
          list(add(at("rs", 1), mul(x("ri"), "rz")), sub(at("rs", 2), x("ri"))),
        ),
        "rs",
        "ri",
        list(0, "_k"),
        upTo(1, "_n"),
      ),
      1,
    ),
    valid: and(equal(len, "_n"), bits(), equal(fold(add("vs", "vt"), "vs", "vt", 0, "_x"), "_k")),
  },
};

// ─── Fibonacci tables: T[m + 1] is the number of length-m binary words without two consecutive 1s. ──
const fibTable: MathJSON = fold(
  join("ft", list(add(at("ft", "fm"), at("ft", sub("fm", 1))))),
  "ft",
  "fm",
  list(1, 2),
  upTo(2, "_n"),
);
/** The words of length m: T[m + 1]. */
const fibCount = (m: MathJSON): MathJSON => at("_tables", add(m, 1));

/** The word of `size` positions holding the rank-`r` such word: a 0 goes in position j when the
 *  rank is under the words that start with 0 (T[size − j + 1]). */
const fibWord = (tag: string, size: MathJSON, r: MathJSON): MathJSON => {
  const [state, j] = [`${tag}s`, `${tag}j`];
  const zeros = fibCount(sub(size, j));
  return drop(
    fold(
      iff(
        less(at(state, 1), zeros),
        join(list(at(state, 1)), drop(state, 1), list(0)),
        join(list(sub(at(state, 1), zeros)), drop(state, 1), list(1)),
      ),
      state,
      j,
      list(r),
      upTo(1, size),
    ),
    1,
  );
};

/** The rank of `_x`'s entries `from` to `to` among the words of that many positions. */
const fibRank = (tag: string, from: MathJSON, to: MathJSON): MathJSON =>
  fold(
    add(`${tag}a`, iff(equal(x(`${tag}j`), 1), fibCount(sub(to, `${tag}j`)), 0)),
    `${tag}a`,
    `${tag}j`,
    0,
    upTo(from, to),
  );

export const fibStrings: EpsilFamily = {
  head: "FibStrings",
  carrier: "BinaryWord",
  paramCount: 1,
  kind: "ints",
  params: ["_n"],
  epsil: {
    tables: fibTable,
    count: fibCount("_n"),
    unrank: fibWord("fu", "_n", "_r"),
    rank: fibRank("fr", 1, "_n"),
    valid: and(
      equal(len, "_n"),
      bits(),
      all((j) => ["LessEqual", add(x(j), x(sub(j, 1))), 1], upTo(2, len), "k"),
    ),
  },
};

// ─── LucasStrings(n): circular words with no two consecutive 1s. A leading 0 leaves a free
// Fibonacci word of n − 1 positions; a leading 1 forces 0 after it and last, around a free
// Fibonacci word of n − 3 positions (n = 2: just [1, 0]). The leading-0 block sorts first. ────────
export const lucasStrings: EpsilFamily = {
  head: "LucasStrings",
  carrier: "BinaryWord",
  paramCount: 1,
  kind: "ints",
  params: ["_n"],
  epsil: {
    tables: fibTable,
    count: iff(["LessEqual", "_n", 1], 1, add(fibCount(sub("_n", 1)), fibCount(["Max", sub("_n", 3), 0]))),
    unrank: iff(
      equal("_n", 0),
      list(),
      iff(
        equal("_n", 1),
        list(0),
        iff(
          less("_r", fibCount(sub("_n", 1))),
          join(list(0), fibWord("lu", sub("_n", 1), "_r")),
          iff(
            equal("_n", 2),
            list(1, 0),
            join(list(1, 0), fibWord("lw", sub("_n", 3), sub("_r", fibCount(sub("_n", 1)))), list(0)),
          ),
        ),
      ),
    ),
    rank: iff(
      ["LessEqual", "_n", 1],
      0,
      iff(equal(x(1), 0), fibRank("lr", 2, "_n"), add(fibCount(sub("_n", 1)), fibRank("lq", 3, sub("_n", 1)))),
    ),
    valid: and(
      equal(len, "_n"),
      bits(),
      all((j) => equal(mul(x(j), x(iff(equal(j, "_n"), 1, add(j, 1)))), 0), upTo(1, len), "k"),
    ),
  },
};

// ─── StirlingPermutations(n): the pair (k, k) is inserted, for k = 2..n, into one of 2k − 1 gaps
// of the word so far; the gaps are the digits of the rank in the mixed radix 3, 5, …, 2n − 1 (k = 2
// most significant). Rank reads a pair's gap back as the entries below k that precede its first
// copy: the larger pairs, inserted later, are not counted. ──────────────────────────────────────────
/** (2n − 1)(2n − 3)… over the radixes of k = from..n. */
const radixProduct = (from: MathJSON): MathJSON =>
  fold(mul("sp", sub(mul(2, "sj"), 1)), "sp", "sj", 1, upTo(from, "_n"));

/** Where the pair k goes: digit k of the rank. */
const gap = (k: MathJSON): MathJSON => ["Mod", quotient("_r", radixProduct(add(k, 1))), sub(mul(2, k), 1)];

export const stirlingPermutations: EpsilFamily = {
  head: "StirlingPermutations",
  carrier: "StirlingPermutation",
  paramCount: 1,
  kind: "ints",
  params: ["_n"],
  epsil: {
    count: radixProduct(2),
    unrank: iff(
      equal("_n", 0),
      list(),
      fold(
        join(["Take", "uw", gap("uk")], list("uk", "uk"), drop("uw", gap("uk"))),
        "uw",
        "uk",
        list(1, 1),
        upTo(2, "_n"),
      ),
    ),
    rank: fold(
      add(
        mul("ra", sub(mul(2, "rk"), 1)),
        at(
          fold(
            iff(
              equal(x("rj"), "rk"),
              list(1, at("rs", 2)),
              iff(equal(at("rs", 1), 1), "rs", list(0, add(at("rs", 2), iff(less(x("rj"), "rk"), 1, 0)))),
            ),
            "rs",
            "rj",
            list(0, 0),
            upTo(1, len),
          ),
          2,
        ),
      ),
      "ra",
      "rk",
      0,
      upTo(2, "_n"),
    ),
    valid: and(
      equal(len, mul(2, "_n")),
      all((j) => between(x(j), 1, "_n"), upTo(1, len), "j"),
      all(
        (i) => equal(fold(add("vc", iff(equal(x("vj"), i), 1, 0)), "vc", "vj", 0, upTo(1, len)), 2),
        upTo(1, "_n"),
        "i",
      ),
      // Between the two copies of a value, every entry is larger.
      all(
        (a) =>
          all(
            (b) =>
              iff(
                and(less(a, b), equal(x(a), x(b))),
                all((c) => iff(and(less(a, c), less(c, b)), ["Greater", x(c), x(a)], "True"), upTo(1, len), "c"),
                "True",
              ),
            upTo(1, len),
            "b",
          ),
        upTo(1, len),
        "a",
      ),
    ),
  },
};

// ─── NonDecreasingParkingFunctions(n): 1 ≤ a_1 ≤ … ≤ a_n with a_i ≤ i. T(s, v) is the ways to
// place the last s entries when the one before was v: entry i (s = n + 1 − i of them left) takes
// any a in v..i, leaving T(s − 1, a). Unrank takes the first a whose block holds the rank. ────────
const width = add("_n", 2);
const completions = cell("_tables", width);

export const nonDecreasingParkingFunctions: EpsilFamily = {
  head: "NonDecreasingParkingFunctions",
  carrier: "ParkingFunction",
  paramCount: 1,
  kind: "ints",
  params: ["_n"],
  epsil: {
    tables: rowTable(
      "pf",
      add("_n", 1),
      width,
      () => 1,
      (prev, s, c) => fold(add("pt", prev(sub(s, 1), "pa")), "pt", "pa", 0, upTo(c, sub(add("_n", 1), s))),
    ),
    count: completions("_n", 1),
    // The state is [rank left, the last entry, the entries so far…].
    unrank: drop(
      fold(
        lets(
          [
            [
              "up",
              fold(
                iff(
                  equal(at("uq", 2), 0),
                  iff(
                    less(at("uq", 1), completions(sub("_n", "ui"), "ua")),
                    list(at("uq", 1), "ua"),
                    list(sub(at("uq", 1), completions(sub("_n", "ui"), "ua")), 0),
                  ),
                  "uq",
                ),
                "uq",
                "ua",
                list(at("us", 1), 0),
                upTo(at("us", 2), "ui"),
              ),
              "list<integer>",
            ],
          ],
          join(list(at("up", 1), at("up", 2)), drop("us", 2), list(at("up", 2))),
        ),
        "us",
        "ui",
        list("_r", 1),
        upTo(1, "_n"),
      ),
      2,
    ),
    // The state is [rank so far, the last entry].
    rank: at(
      fold(
        list(
          add(
            at("rs", 1),
            fold(add("rt", completions(sub("_n", "ri"), "ra")), "rt", "ra", 0, upTo(at("rs", 2), sub(x("ri"), 1))),
          ),
          x("ri"),
        ),
        "rs",
        "ri",
        list(0, 1),
        upTo(1, "_n"),
      ),
      1,
    ),
    valid: and(
      equal(len, "_n"),
      all(
        (i) => and(between(x(i), 1, i), iff(equal(i, 1), "True", ["LessEqual", x(sub(i, 1)), x(i)])),
        upTo(1, len),
        "i",
      ),
    ),
  },
};
