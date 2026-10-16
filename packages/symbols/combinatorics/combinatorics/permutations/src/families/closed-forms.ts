// Permutation-carrier families whose order is a mixed-radix number, defined in Epsil as closed
// forms: EvenPermutations, LehmerCodes and SubexcedantSeqs, and Arrangements (KPermutations
// under its own carrier). Their TS kernels (./permutations.ts) are the independent readings tests/readings/ holds them to.

import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import {
  add,
  all,
  at,
  distinctIn,
  equal,
  fold,
  iff,
  lets,
  map,
  mul,
  quotient,
  sub,
  upTo,
} from "../../../collections/src/families/tables.ts";
import { between, digit, element, falling, hasLength, kPermutations, lexRank, lexUnrank } from "./core.ts";

const n = "_n";

/** The even permutations of n, in the symmetric group's lex order. Lex ranks 2m and 2m + 1 differ
 *  by swapping the last two entries, so exactly one of each pair is even: the m-th even
 *  permutation is that one, and a permutation's place is half its lex rank. A lex rank's
 *  permutation has as many inversions as its digit sum. */
const digitSum = fold(add("ea", digit(n, n, "ev_pair", "ej")), "ea", "ej", 0, upTo(1, n));
const inversions = fold(
  add(
    "ia",
    fold(add("ic", iff(["Greater", at("_x", "ii"), at("_x", "ij")], 1, 0)), "ic", "ii", 0, upTo(1, sub("ij", 1))),
  ),
  "ia",
  "ij",
  0,
  upTo(1, n),
);
export const evenPermutations: EpsilFamily = {
  head: "EvenPermutations",
  carrier: "Permutation",
  paramCount: 1,
  kind: "ints",
  params: [n],
  epsil: {
    count: iff(["LessEqual", n, 1], 1, quotient(["Factorial", n], 2)),
    unrank: lets(
      [
        ["ev_pair", mul(2, "_r"), "integer"],
        ["ev_lex", add("ev_pair", ["Mod", digitSum, 2]), "integer"],
      ],
      lexUnrank(n, n, "ev_lex"),
    ),
    rank: quotient(lexRank(n, n, element), 2),
    valid: hasLength(
      "_x",
      n,
      iff(
        distinctIn(n, n, (j) => at("_x", j), "ev_d"),
        equal(["Mod", inversions, 2], 0),
        "False",
      ),
    ),
  },
};

/** The inversion tables of the permutations of n (digit j of the Lehmer code is at most n − j),
 *  in the order of the factoradic numbers they read as, which is the symmetric group's lex order. */
export const lehmerCodes: EpsilFamily = {
  head: "LehmerCodes",
  carrier: "PermutationInversion",
  paramCount: 1,
  kind: "ints",
  params: [n],
  epsil: {
    count: ["Factorial", n],
    unrank: map(digit(n, n, "_r", "j"), "j", upTo(1, n)),
    rank: fold(add(mul("lr", add(sub(n, "lj"), 1)), at("_x", "lj")), "lr", "lj", 0, upTo(1, n)),
    valid: hasLength(
      "_x",
      n,
      all((j) => between(at("_x", j), 0, sub(n, j)), upTo(1, n), "lj"),
    ),
  },
};

/** The words whose entry j is at most j − 1 (1-based), n! of them: a factoradic odometer with the
 *  radices the other way about from the Lehmer code's. Digit j is worth n!/j!, and has j values. */
export const subexcedantSeqs: EpsilFamily = {
  head: "SubexcedantSeqs",
  carrier: "SubexcedantSeq",
  paramCount: 1,
  kind: "ints",
  params: [n],
  epsil: {
    count: ["Factorial", n],
    unrank: map(["Mod", quotient("_r", falling(n, sub(n, "j"))), "j"], "j", upTo(1, n)),
    rank: fold(add(mul("sr", "sj"), at("_x", "sj")), "sr", "sj", 0, upTo(1, n)),
    valid: hasLength(
      "_x",
      n,
      all((j) => between(at("_x", j), 0, sub(j, 1)), upTo(1, n), "sj"),
    ),
  },
};

/** The k-permutations of n, as KPermutations: the same definitions and kernels, another carrier. */
export const arrangements: EpsilFamily = { ...kPermutations, head: "Arrangements", carrier: "Arrangement" };
