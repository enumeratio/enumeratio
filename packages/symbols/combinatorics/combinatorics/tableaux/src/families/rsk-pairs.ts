// StandardTableauPairs in Epsil: RSK is a bijection from the permutations of n, so a pair is the
// RSK of the permutation of its rank, and its rank that of the permutation inverse RSK reads
// back. The element is nested (no compiled type), so the definitions are interpreted.

import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import {
  add,
  all,
  and,
  at,
  equal,
  fold,
  iff,
  len,
  less,
  lets,
  map,
  sub,
  upTo,
} from "../../../collections/src/families/tables.ts";
import { symmetricGroup } from "../../../permutations/src/families/core.ts";
import { rskPair } from "../tableau.ts";
import { standardTableaux } from "./standard-tableaux.ts";

type MathJSON = unknown;

const n = "_n";
const list = (...xs: MathJSON[]): MathJSON => ["List", ...xs];
const count = (xs: MathJSON): MathJSON => ["Count", xs];
/** Whether the nested value `x` is an integer, not a list. */
const isInteger = (x: MathJSON): MathJSON => ["Element", x, "Integers"];

/** `expr` with the symbol `from` named `to`. */
const renamed = (expr: MathJSON, from: string, to: string): MathJSON =>
  Array.isArray(expr) ? expr.map((part) => renamed(part, from, to)) : expr === from ? to : expr;

/** The row of the tableau `q` that ends with the entry `k`. */
const rowEndingWith = (q: MathJSON, k: MathJSON): MathJSON =>
  fold(iff(equal(at(at(q, "rk_i"), count(at(q, "rk_i"))), k), "rk_i", "rk_f"), "rk_f", "rk_i", 0, upTo(1, count(q)));

/** The tableau without the last cell of row `r`, the row going with it when that was its only cell. */
const withoutLast = (tableau: MathJSON, r: MathJSON): MathJSON =>
  iff(
    equal(count(at(tableau, r)), 1),
    ["Take", tableau, sub(count(tableau), 1)],
    ["ReplaceAt", tableau, r, ["Take", at(tableau, r), sub(count(at(tableau, r)), 1)]],
  );

/**
 * One step of inverse RSK, on the state [P, Q, the letters read so far]: the entry k = n + 1 − c is
 * at the end of a row r of Q, and its cell leaves both tableaux; the entry of P that was there
 * bumps back up the rows above, each time taking the place of the largest entry smaller than it,
 * and what comes out of row 1 is the k-th letter.
 */
const unbump = lets(
  [
    ["rk_t", "rk_s", "list<any>"],
    ["rk_p", at("rk_t", 1), "list<any>"],
    ["rk_q", at("rk_t", 2), "list<any>"],
    ["rk_k", sub(add(n, 1), "rk_c"), "integer"],
  ],
  lets(
    [["rk_r", rowEndingWith("rk_q", "rk_k"), "integer"]],
    lets(
      [
        [
          "rk_u",
          fold(
            lets(
              [
                ["rk_b", "rk_a", "list<any>"],
                ["rk_w", sub("rk_r", "rk_j"), "integer"],
              ],
              lets(
                [["rk_row", at(at("rk_b", 1), "rk_w"), "list<integer>"]],
                lets(
                  [
                    [
                      "rk_pos",
                      fold(
                        iff(less(at("rk_row", "rk_m"), at("rk_b", 2)), "rk_m", "rk_g"),
                        "rk_g",
                        "rk_m",
                        0,
                        upTo(1, count("rk_row")),
                      ),
                      "integer",
                    ],
                  ],
                  list(
                    ["ReplaceAt", at("rk_b", 1), "rk_w", ["ReplaceAt", "rk_row", "rk_pos", at("rk_b", 2)]],
                    at("rk_row", "rk_pos"),
                  ),
                ),
              ),
            ),
            "rk_a",
            "rk_j",
            list(withoutLast("rk_p", "rk_r"), at(at("rk_p", "rk_r"), count(at("rk_p", "rk_r")))),
            upTo(1, sub("rk_r", 1)),
          ),
          "list<any>",
        ],
      ],
      list(at("rk_u", 1), withoutLast("rk_q", "rk_r"), ["ReplaceAt", at("rk_t", 3), "rk_k", at("rk_u", 2)]),
    ),
  ),
);

/** Whether `m` is a list of lists of integers. */
const shaped = (m: MathJSON): MathJSON =>
  iff(
    isInteger(m),
    "False",
    all(
      (i) =>
        iff(
          isInteger(at(m, i)),
          "False",
          all((k) => isInteger(at(at(m, i), k)), upTo(1, count(at(m, i))), "rk_k"),
        ),
      upTo(1, count(m)),
      "rk_i",
    ),
  );

/** Whether the part `i` of `_x` is a standard tableau of n: bound alone, since a second binding
 *  around it leaves the interpreter's answer unreduced. */
const standard = (i: number): MathJSON =>
  lets([["rk_a", at("_x", i), "list<list<integer>>"]], renamed(standardTableaux.epsil.valid, "_x", "rk_a"));

/** Whether the two parts of `_x` have the same row lengths. */
const sameShape = and(
  equal(count(at("_x", 1)), count(at("_x", 2))),
  equal(
    0,
    fold(
      add("rk_d", ["Abs", sub(count(at(at("_x", 1), "rk_h")), count(at(at("_x", 2), "rk_h")))]),
      "rk_d",
      "rk_h",
      0,
      upTo(1, count(at("_x", 1))),
    ),
  ),
);

export const standardTableauPairs: EpsilFamily = {
  head: "StandardTableauPairs",
  paramCount: 1,
  kind: "nested",
  carrier: "StandardTableauPair",
  carrierElements: ["StandardTableau", "StandardTableau"],
  params: [n],
  // The count is exact past 2^53; unrank and rank take the interpreter's seconds there.
  declinePastDoubles: true,
  // The last step of inverse RSK's folds is left unreduced by compute-engine.
  settle: true,
  epsil: {
    count: ["Factorial", n],
    unrank: lets([["rk_raw", symmetricGroup.epsil.unrank, "list<integer>"]], renamed(rskPair, "_raw", "rk_raw")),
    rank: lets(
      [
        [
          "rk_word",
          at(fold(unbump, "rk_s", "rk_c", list(at("_x", 1), at("_x", 2), map(0, "rk_z", upTo(1, n))), upTo(1, n)), 3),
          "list<integer>",
        ],
      ],
      renamed(symmetricGroup.epsil.rank, "_x", "rk_word"),
    ),
    // A pair of standard tableaux of one shape. The parts are checked for being lists of lists
    // before they are read as such.
    valid: iff(
      equal(len, 2),
      iff(shaped(at("_x", 1)), iff(shaped(at("_x", 2)), and(standard(1), standard(2), sameShape), "False"), "False"),
      "False",
    ),
  },
};
