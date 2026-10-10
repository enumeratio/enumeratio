// AlternatingSignMatrices(n) in Epsil: the n × n matrices of 1, 0 and −1 whose rows and columns
// add up to 1 along every prefix as well as in all, listed row by row, each row's entries in the order
// −1, 0, 1. After i rows the column sums form a set S of i columns (a bit mask, column 1 the
// highest bit); the next row is S' − S for the sets S' of i + 1 columns whose differences from S
// alternate +1, −1, …, +1 along the row. Rows go in the numeric order of S', and each S' starts
// T[S'] matrices, the ways to finish from it: T[full set] = 1, and T[S] adds up T[S'] over the S'
// that follow S. The count is the product formula ∏ⱼ (3j + 1)!/(n + j)!.

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
  mul,
  primeQuotient,
  quotient,
  sub,
  upTo,
} from "../../../collections/src/families/tables.ts";

type MathJSON = unknown;

const n = "_n";
const list = (...xs: MathJSON[]): MathJSON => ["List", ...xs];
const join = (...xs: MathJSON[]): MathJSON => ["Join", ...xs];
const drop = (xs: MathJSON, count: MathJSON): MathJSON => ["Drop", xs, count];
const take = (xs: MathJSON, count: MathJSON): MathJSON => ["Take", xs, count];
const zeros = (count: MathJSON): MathJSON => map(0, "as_z", upTo(1, count));

const masks = ["Power", 2, n];
/** Column c (1-based) is the bit worth 2^(n − c). */
const weight = (c: MathJSON): MathJSON => ["Power", 2, sub(n, c)];
const bit = (mask: MathJSON, c: MathJSON): MathJSON => ["Mod", quotient(mask, weight(c)), 2];
const popcount = (mask: MathJSON, tag: string): MathJSON =>
  fold(add(`${tag}_a`, bit(mask, `${tag}_c`)), `${tag}_a`, `${tag}_c`, 0, upTo(1, n));

/** Whether the set `to` follows the set `from`: along the columns the difference is a row whose
 *  prefix sums stay 0 or 1 and end at 1. 1 or 0. */
const follows = (from: MathJSON, to: MathJSON, tag: string): MathJSON =>
  lets(
    [
      [
        `${tag}_s`,
        fold(
          lets(
            [[`${tag}_p`, add(at(`${tag}_a`, 1), sub(bit(to, `${tag}_c`), bit(from, `${tag}_c`))), "integer"]],
            list(
              `${tag}_p`,
              iff(
                and(equal(at(`${tag}_a`, 2), 1), ["GreaterEqual", `${tag}_p`, 0], ["LessEqual", `${tag}_p`, 1]),
                1,
                0,
              ),
            ),
          ),
          `${tag}_a`,
          `${tag}_c`,
          list(0, 1),
          upTo(1, n),
        ),
        "list<integer>",
      ],
    ],
    iff(and(equal(at(`${tag}_s`, 1), 1), equal(at(`${tag}_s`, 2), 1)), 1, 0),
  );

// _tables: the number of columns in each set, then T over the sets, each indexed by the mask + 1.
const popAt = (mask: MathJSON): MathJSON => at("_tables", add(mask, 1));
const waysAt = (mask: MathJSON): MathJSON => at("_tables", add(masks, mask, 1));

const tables = lets(
  [["as_pop", map(popcount("as_m", "as_pc"), "as_m", upTo(0, sub(masks, 1))), "list<integer>"]],
  join(
    "as_pop",
    fold(
      lets(
        [["as_i", sub(sub(n, 1), "as_l"), "integer"]],
        fold(
          iff(
            equal(at("as_pop", add("as_m", 1)), "as_i"),
            [
              "ReplaceAt",
              "as_t",
              add("as_m", 1),
              fold(
                add(
                  "as_w",
                  iff(
                    equal(at("as_pop", add("as_o", 1)), add("as_i", 1)),
                    mul(follows("as_m", "as_o", "as_f"), at("as_t", add("as_o", 1))),
                    0,
                  ),
                ),
                "as_w",
                "as_o",
                0,
                upTo(0, sub(masks, 1)),
              ),
            ],
            "as_t",
          ),
          "as_t",
          "as_m",
          "as_u",
          upTo(0, sub(masks, 1)),
        ),
      ),
      "as_u",
      "as_l",
      ["ReplaceAt", zeros(masks), masks, 1],
      upTo(0, sub(n, 1)),
    ),
  ),
);

/** The set after a row `row` (a list of n entries) from the set `from`. */
const after = (from: MathJSON, row: MathJSON): MathJSON =>
  fold(add("as_k", mul(add(bit(from, "as_c"), at(row, "as_c")), weight("as_c"))), "as_k", "as_c", 0, upTo(1, n));

export const alternatingSignMatrices: EpsilFamily = {
  head: "AlternatingSignMatrices",
  paramCount: 1,
  kind: "blocks",
  params: [n],
  // The table over every set of columns is out of the interpreter's reach past 2^53, from n = 12.
  declinePastDoubles: true,
  epsil: {
    count: primeQuotient(
      "ac",
      mul(3, n),
      (q) => fold(add("ac_a", quotient(add(mul(3, "ac_j"), 1), q)), "ac_a", "ac_j", 0, upTo(0, sub(n, 1))),
      (q) => fold(add("ac_a", quotient(add(n, "ac_j"), q)), "ac_a", "ac_j", 0, upTo(0, sub(n, 1))),
    ),
    tables,
    // The state is [rank left, the set, the entries of the rows so far]; each level walks the sets
    // in order, [rank left, the set found or −1 until it is].
    unrank: (() => {
      const search = fold(
        iff(
          ["GreaterEqual", at("au_s", 2), 0],
          "au_s",
          iff(
            and(equal(popAt("au_o"), add("au_i", 1)), equal(follows(at("au_u", 2), "au_o", "au_f"), 1)),
            lets(
              [["au_w", waysAt("au_o"), "integer"]],
              iff(less(at("au_s", 1), "au_w"), list(at("au_s", 1), "au_o"), list(sub(at("au_s", 1), "au_w"), -1)),
            ),
            "au_s",
          ),
        ),
        "au_s",
        "au_o",
        list(at("au_u", 1), -1),
        upTo(0, sub(masks, 1)),
      );
      const row = map(sub(bit("au_to", "au_c"), bit(at("au_u", 2), "au_c")), "au_c", upTo(1, n));
      const step = lets(
        [["au_f", search, "list<integer>"]],
        lets([["au_to", at("au_f", 2), "integer"]], join(list(at("au_f", 1), "au_to"), drop("au_u", 2), row)),
      );
      return lets(
        [["au_end", fold(step, "au_u", "au_i", list("_r", 0), upTo(0, sub(n, 1))), "list<integer>"]],
        map(take(drop("au_end", add(2, mul("au_j", n))), n), "au_j", upTo(0, sub(n, 1))),
      );
    })(),
    // Rank: each row adds the ways to finish from the sets that come before the row's in order.
    rank: (() => {
      const step = lets(
        [["ar_row", at("_x", add("ar_i", 1)), "list<integer>"]],
        lets(
          [["ar_to", after(at("ar_a", 2), "ar_row"), "integer"]],
          list(
            add(
              at("ar_a", 1),
              fold(
                add(
                  "ar_w",
                  iff(
                    and(equal(popAt("ar_o"), add("ar_i", 1)), equal(follows(at("ar_a", 2), "ar_o", "ar_f"), 1)),
                    waysAt("ar_o"),
                    0,
                  ),
                ),
                "ar_w",
                "ar_o",
                0,
                upTo(0, sub("ar_to", 1)),
              ),
            ),
            "ar_to",
          ),
        ),
      );
      return at(fold(step, "ar_a", "ar_i", list(0, 0), upTo(0, sub(n, 1))), 1);
    })(),
    // n rows of n entries whose prefix sums, along each row and each column, stay 0 or 1 and end at 1
    // (which keeps every entry among −1, 0, 1).
    valid: (() => {
      const walk = (entry: (k: MathJSON) => MathJSON, tag: string): MathJSON =>
        lets(
          [
            [
              `${tag}_s`,
              fold(
                lets(
                  [[`${tag}_p`, add(at(`${tag}_a`, 1), entry(`${tag}_k`)), "integer"]],
                  list(
                    `${tag}_p`,
                    iff(
                      and(equal(at(`${tag}_a`, 2), 1), ["GreaterEqual", `${tag}_p`, 0], ["LessEqual", `${tag}_p`, 1]),
                      1,
                      0,
                    ),
                  ),
                ),
                `${tag}_a`,
                `${tag}_k`,
                list(0, 1),
                upTo(1, n),
              ),
              "list<integer>",
            ],
          ],
          and(equal(at(`${tag}_s`, 1), 1), equal(at(`${tag}_s`, 2), 1)),
        );
      const rows = all(
        (i) =>
          lets(
            [["av_r", at("_x", i), "list<integer>"]],
            iff(
              equal(["Length", "av_r"], n),
              walk((k) => at("av_r", k), "av_w"),
              "False",
            ),
          ),
        upTo(1, len),
        "av_i",
      );
      const columns = all(
        (j) => walk((k) => lets([["av_q", at("_x", k), "list<integer>"]], at("av_q", j)), "av_v"),
        upTo(1, n),
        "av_j",
      );
      return iff(equal(len, n), iff(rows, columns, "False"), "False");
    })(),
  },
};
