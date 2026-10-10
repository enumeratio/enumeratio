// SemistandardTableaux(n, k) in Epsil: the tableaux of n cells with entries 1..k, rows weakly and
// columns strictly increasing, listed by shape first (the row lengths in lex order, so the
// partitions of n smallest first) and then by their entries read along the rows.
//
// A shape's tableaux are counted by the hook-content formula ∏ (k + c − r)/hook (zero when the
// shape has more than k rows), exact through `primeQuotient`. Within a shape the rows are chosen
// one at a time, each among the rows that sit under the one above, in lex order; how many
// tableaux a row starts is a table over the shape's rows: W for the last row is 1, and for a
// row it adds up W over the rows of the next that fit under it. A row of m entries is a number
// 0 … C(m + k − 1, m) − 1 in lex order, and the next row in order raises the last entry that can rise.

import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import {
  add,
  all,
  and,
  at,
  choose,
  equal,
  fold,
  iff,
  len,
  less,
  lets,
  map,
  mul,
  primeQuotient,
  sub,
  upTo,
} from "../../../collections/src/families/tables.ts";
import { integerPartitions } from "../../../partitions/src/families/walks.ts";
import { hooked, padded, renamed, rowsOf, zeros } from "./standard-tableaux.ts";

type MathJSON = unknown;

const n = "_n";
const k = "_k";
const list = (...xs: MathJSON[]): MathJSON => ["List", ...xs];
const join = (...xs: MathJSON[]): MathJSON => ["Join", ...xs];
const drop = (xs: MathJSON, count: MathJSON): MathJSON => ["Drop", xs, count];
const take = (xs: MathJSON, count: MathJSON): MathJSON => ["Take", xs, count];
const length = (xs: MathJSON): MathJSON => ["Length", xs];
const ones = (count: MathJSON): MathJSON => map(1, "ss_o", upTo(1, count));

/** How many rows of m entries 1..k rise weakly: the multisets of m from k. */
const rowCount = (m: MathJSON): MathJSON => choose(add(m, sub(k, 1)), m);

/** The row after `cur` (of m entries) in lex order: the last entry below k rises, those after it with it. */
const next = (cur: string, m: MathJSON): MathJSON =>
  lets(
    [["ss_at", fold(iff(less(at(cur, "ss_i"), k), "ss_i", "ss_r"), "ss_r", "ss_i", 0, upTo(1, m)), "integer"]],
    iff(
      equal("ss_at", 0),
      cur,
      map(iff(less("ss_j", "ss_at"), at(cur, "ss_j"), add(at(cur, "ss_at"), 1)), "ss_j", upTo(1, m)),
    ),
  );

/** Whether the row `row` of m entries sits under the row `up` (each entry below a smaller one). */
const fits = (up: MathJSON, row: MathJSON, m: MathJSON): MathJSON =>
  all((c) => ["Greater", at(row, c), at(up, c)], upTo(1, m), "ss_fc");

/** Whether two rows of m entries are the same. */
const same = (a: MathJSON, b: MathJSON, m: MathJSON): MathJSON =>
  equal(0, fold(add("ss_d", ["Abs", sub(at(a, "ss_sc"), at(b, "ss_sc"))]), "ss_d", "ss_sc", 0, upTo(1, m)));

/** Where the rows of level j (1-based) of the shape `S` start in a list of every level's rows. */
const rowsBefore = (shape: string, j: MathJSON): MathJSON =>
  fold(add("ss_q", rowCount(at(shape, "ss_u"))), "ss_q", "ss_u", 0, upTo(1, sub(j, 1)));
/** Where the entries of row j start in the shape's n entries read along its rows. */
const cellsBefore = (shape: string, j: MathJSON): MathJSON =>
  fold(add("ss_q", at(shape, "ss_u")), "ss_q", "ss_u", 0, upTo(1, sub(j, 1)));

/**
 * W over the shape's rows, level by level: the tableaux of the rows below a row, itself included,
 * as one list. The state of the walk over a level's rows is [the row at hand, W so far]; of the
 * walk over the next level's, [the sum so far, the row at hand].
 */
const ways = (shape: string): MathJSON => {
  // The walk over the next level's rows: [the sum so far, the row at hand].
  const below = fold(
    lets(
      [
        ["ss_acc", at("ss_y", 1), "integer"],
        ["ss_row", drop("ss_y", 1), "list<integer>"],
      ],
      join(
        list(iff(fits("ss_cur", "ss_row", "ss_m2"), add("ss_acc", at("ss_w", add("ss_next", "ss_h"))), "ss_acc")),
        next("ss_row", "ss_m2"),
      ),
    ),
    "ss_y",
    "ss_h",
    join(list(0), ones("ss_m2")),
    upTo(1, rowCount("ss_m2")),
  );
  // The walk over a level's rows: [the row at hand, W so far].
  const level = fold(
    lets(
      [
        ["ss_cur", take("ss_s", "ss_m"), "list<integer>"],
        ["ss_w", drop("ss_s", "ss_m"), "list<integer>"],
      ],
      lets(
        [["ss_sum", at(below, 1), "integer"]],
        join(next("ss_cur", "ss_m"), ["ReplaceAt", "ss_w", add("ss_here", "ss_g"), "ss_sum"]),
      ),
    ),
    "ss_s",
    "ss_g",
    join(ones("ss_m"), "ss_state"),
    upTo(1, rowCount("ss_m")),
  );
  return lets(
    [["ss_L", rowsOf(shape), "integer"]],
    fold(
      lets(
        [
          ["ss_j", sub("ss_L", "ss_t"), "integer"],
          ["ss_m", at(shape, "ss_j"), "integer"],
          ["ss_m2", at(shape, add("ss_j", 1)), "integer"],
          ["ss_here", rowsBefore(shape, "ss_j"), "integer"],
          ["ss_next", rowsBefore(shape, add("ss_j", 1)), "integer"],
        ],
        drop(level, "ss_m"),
      ),
      "ss_state",
      "ss_t",
      // The last level's rows each finish in one way.
      ones(rowsBefore(shape, add("ss_L", 1))),
      upTo(1, sub("ss_L", 1)),
    ),
  );
};

export const semistandardTableaux: EpsilFamily = (() => {
  const { tables: shapeTables, count: shapeCount, unrank: shapeUnrank, rank: shapeRank } = integerPartitions.epsil;
  // Shapes smallest first: the partitions of n from the last.
  const shapeAt = (index: MathJSON): MathJSON =>
    padded(lets([["ss_pr", sub(sub(shapeCount, 1), index), "integer"]], renamed(shapeUnrank, "_r", "ss_pr")));
  // The tableaux of the shape in the list `shape`: none with more rows than entries.
  const hookContent = (shape: string): MathJSON =>
    hooked(shape, (divisible) =>
      iff(
        ["Greater", "fh_L", k],
        0,
        primeQuotient(
          "fh",
          add(k, n),
          (q) =>
            fold(
              add(
                "fh_a",
                fold(
                  add("fh_b", iff(equal(["Mod", sub(add(k, "fh_c"), "fh_r"), q], 0), 1, 0)),
                  "fh_b",
                  "fh_c",
                  0,
                  upTo(1, at(shape, "fh_r")),
                ),
              ),
              "fh_a",
              "fh_r",
              0,
              upTo(1, "fh_L"),
            ),
          divisible,
        ),
      ),
    );
  const shapeBase = mul(add(n, 1), add(n, 1));
  const countOfShape = (index: MathJSON): MathJSON => at("_tables", add(shapeBase, index, 1));
  const tables = lets(
    [["_tables", shapeTables, "list<integer>"]],
    join(
      "_tables",
      map(
        lets([["ss_shape", shapeAt("ss_i"), "list<integer>"]], hookContent("ss_shape")),
        "ss_i",
        upTo(0, sub(shapeCount, 1)),
      ),
    ),
  );
  const count = fold(add("ss_b", countOfShape("ss_i")), "ss_b", "ss_i", 0, upTo(0, sub(shapeCount, 1)));

  // Unrank: the shape holding the rank, then each row of it in turn, the rows chosen among those that
  // fit under the row above. The state is [rank left, the entries read along the rows so far].
  const findShape = fold(
    iff(
      ["GreaterEqual", at("ss_f", 2), 0],
      "ss_f",
      lets(
        [["ss_w", countOfShape("ss_i"), "integer"]],
        iff(less(at("ss_f", 1), "ss_w"), list(at("ss_f", 1), "ss_i"), list(sub(at("ss_f", 1), "ss_w"), -1)),
      ),
    ),
    "ss_f",
    "ss_i",
    list("_r", -1),
    upTo(0, sub(shapeCount, 1)),
  );
  const rowSearch = fold(
    iff(
      equal(at("ss_c", 2), 1),
      "ss_c",
      lets(
        [["ss_row", drop("ss_c", 2), "list<integer>"]],
        iff(
          fits("ss_up", "ss_row", "ss_m"),
          lets(
            [["ss_v", at("ss_W", add("ss_o", "ss_i")), "integer"]],
            iff(
              less(at("ss_c", 1), "ss_v"),
              join(list(at("ss_c", 1), 1), "ss_row"),
              join(list(sub(at("ss_c", 1), "ss_v"), 0), next("ss_row", "ss_m")),
            ),
          ),
          join(list(at("ss_c", 1), 0), next("ss_row", "ss_m")),
        ),
      ),
    ),
    "ss_c",
    "ss_i",
    join(list(at("ss_u", 1), 0), ones("ss_m")),
    upTo(1, rowCount("ss_m")),
  );
  const unrank = lets(
    [
      ["ss_found", findShape, "list<integer>"],
      ["ss_S", shapeAt(at("ss_found", 2)), "list<integer>"],
    ],
    lets(
      [["ss_W", ways("ss_S"), "list<integer>"]],
      lets(
        [
          [
            "ss_end",
            fold(
              lets(
                [
                  ["ss_m", at("ss_S", "ss_j"), "integer"],
                  ["ss_o", rowsBefore("ss_S", "ss_j"), "integer"],
                  ["ss_at", cellsBefore("ss_S", "ss_j"), "integer"],
                ],
                lets(
                  [
                    [
                      "ss_up",
                      iff(
                        equal("ss_j", 1),
                        zeros("ss_m"),
                        take(drop(drop("ss_u", 1), cellsBefore("ss_S", sub("ss_j", 1))), "ss_m"),
                      ),
                      "list<integer>",
                    ],
                  ],
                  lets(
                    [["ss_found2", rowSearch, "list<integer>"]],
                    join(list(at("ss_found2", 1)), take(drop("ss_u", 1), "ss_at"), drop("ss_found2", 2)),
                  ),
                ),
              ),
              "ss_u",
              "ss_j",
              list(at("ss_found", 1)),
              upTo(1, rowsOf("ss_S")),
            ),
            "list<integer>",
          ],
        ],
        map(
          take(drop(drop("ss_end", 1), cellsBefore("ss_S", "ss_j")), at("ss_S", "ss_j")),
          "ss_j",
          upTo(1, rowsOf("ss_S")),
        ),
      ),
    ),
  );

  // Rank: the shape's place from the smallest, the tableaux of the shapes before it, then at each
  // row the tableaux of the rows that fit under the row above and come before it.
  const rowLengths = map(lets([["ss_r", at("_x", "ss_i"), "list<integer>"]], length("ss_r")), "ss_i", upTo(1, len));
  const rowSearchRank = fold(
    iff(
      equal(at("ss_c", 2), 1),
      "ss_c",
      lets(
        [["ss_row", drop("ss_c", 2), "list<integer>"]],
        iff(
          same("ss_row", "ss_target", "ss_m"),
          join(list(at("ss_c", 1), 1), "ss_row"),
          join(
            list(
              iff(fits("ss_up", "ss_row", "ss_m"), add(at("ss_c", 1), at("ss_W", add("ss_o", "ss_i"))), at("ss_c", 1)),
              0,
            ),
            next("ss_row", "ss_m"),
          ),
        ),
      ),
    ),
    "ss_c",
    "ss_i",
    join(list(0, 0), ones("ss_m")),
    upTo(1, rowCount("ss_m")),
  );
  const rank = lets(
    [
      ["ss_h", rowLengths, "list<integer>"],
      ["ss_place", sub(sub(shapeCount, 1), renamed(shapeRank, "_x", "ss_h")), "integer"],
    ],
    lets(
      [["ss_S", padded("ss_h"), "list<integer>"]],
      lets(
        [["ss_W", ways("ss_S"), "list<integer>"]],
        add(
          fold(add("ss_b", countOfShape("ss_i")), "ss_b", "ss_i", 0, upTo(0, sub("ss_place", 1))),
          fold(
            lets(
              [
                ["ss_m", at("ss_S", "ss_j"), "integer"],
                ["ss_o", rowsBefore("ss_S", "ss_j"), "integer"],
                ["ss_target", at("_x", "ss_j"), "list<integer>"],
              ],
              lets(
                [
                  [
                    "ss_up",
                    iff(
                      equal("ss_j", 1),
                      zeros("ss_m"),
                      lets([["ss_above", at("_x", sub("ss_j", 1)), "list<integer>"]], take("ss_above", "ss_m")),
                    ),
                    "list<integer>",
                  ],
                ],
                add("ss_acc", at(rowSearchRank, 1)),
              ),
            ),
            "ss_acc",
            "ss_j",
            0,
            upTo(1, rowsOf("ss_S")),
          ),
        ),
      ),
    ),
  );

  // Valid: rows nonempty and no longer than the one above, entries 1..k, rows weakly and columns
  // strictly increasing, n cells.
  const valid = and(
    all(
      (i) => lets([["sv_r", at("_x", i), "list<integer>"]], ["GreaterEqual", length("sv_r"), 1]),
      upTo(1, len),
      "sv_i",
    ),
    all(
      (i) =>
        lets(
          [["sv_r", at("_x", i), "list<integer>"]],
          lets(
            [["sv_q", at("_x", sub(i, 1)), "list<integer>"]],
            and(
              ["LessEqual", length("sv_r"), length("sv_q")],
              all((c) => ["Less", at("sv_q", c), at("sv_r", c)], upTo(1, length("sv_r")), "sv_c"),
            ),
          ),
        ),
      upTo(2, len),
      "sv_h",
    ),
    all(
      (i) =>
        lets(
          [["sv_r", at("_x", i), "list<integer>"]],
          and(
            all(
              (c) => and(["GreaterEqual", at("sv_r", c), 1], ["LessEqual", at("sv_r", c), k]),
              upTo(1, length("sv_r")),
              "sv_d",
            ),
            all((c) => ["LessEqual", at("sv_r", sub(c, 1)), at("sv_r", c)], upTo(2, length("sv_r")), "sv_e"),
          ),
        ),
      upTo(1, len),
      "sv_j",
    ),
    equal(
      fold(
        add("sv_t", lets([["sv_r", at("_x", "sv_i"), "list<integer>"]], length("sv_r"))),
        "sv_t",
        "sv_i",
        0,
        upTo(1, len),
      ),
      n,
    ),
  );

  return {
    head: "SemistandardTableaux",
    paramCount: 2,
    kind: "blocks",
    params: [n, k],
    // Interpreting the shape table past 2^53 takes the interpreter's minutes.
    declinePastDoubles: "count",
    epsil: { count, tables, unrank, rank, valid },
  };
})();
