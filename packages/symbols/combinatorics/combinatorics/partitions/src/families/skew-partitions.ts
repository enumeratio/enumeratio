// SkewPartitions(n) in Epsil: the reduced skew shapes λ/μ of n cells (no empty row, no empty
// column), listed by λ and then μ. Row i is the interval of columns [aᵢ, bᵢ] = [μᵢ + 1, λᵢ]: a and b
// weakly fall, aᵢ ≤ bᵢ, the last a is 1 and aᵢ ≤ bᵢ₊₁ + 1, so no column is skipped. The order is the
// lex order of b (a prefix first), then of a.
//
// _tables holds T[c][a, b], the ways to finish below a row [a, b] with c more cells (a row may be
// the last only if its a is 1). A rank is found in two passes, b and then a. The b pass runs down
// the rows: F[a][c] counts the choices of a so far, the last one a, in c cells, and a row ending
// at β starts Σ F[a][c]·T[n − c − k][a′, β] shapes, k = β − a′ + 1 cells in the row, over the a′ ≤ β
// and the a in a′..β + 1. The a pass walks the a's for the b's found, by H, the ways to choose the
// a's below a row.

import type { EpsilFamily, FastKernel } from "../../../collections/src/families/epsil.ts";
import type { Declared } from "../../../collections/src/families/types.ts";
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
  quotient,
  rowTable,
  sub,
  upTo,
} from "../../../collections/src/families/tables.ts";
import { IsSkewPartitionOf, PAST_DOUBLES, skewShapeCount, skewShapeRank, skewShapeUnrank } from "./skew-shapes.ts";

type MathJSON = unknown;

const n = "_n";
const list = (...xs: MathJSON[]): MathJSON => ["List", ...xs];
const join = (...xs: MathJSON[]): MathJSON => ["Join", ...xs];
const drop = (xs: MathJSON, count: MathJSON): MathJSON => ["Drop", xs, count];
const take = (xs: MathJSON, count: MathJSON): MathJSON => ["Take", xs, count];
const length = (xs: MathJSON): MathJSON => ["Length", xs];
const min = (...xs: MathJSON[]): MathJSON => ["Min", ...xs];
const max = (...xs: MathJSON[]): MathJSON => ["Max", ...xs];
const positive = (x: MathJSON): MathJSON => ["Greater", x, 0];
const zeros = (count: MathJSON): MathJSON => map(0, "sp_z", upTo(1, count));

/** The size, or 0 below it: a negative size has an empty table. */
const size = max(n, 0);
/** The side of the square of (a, c), each 0..n, that F and H hold, flat: a·side + c + 1. */
const side = add(n, 1);
const square = mul(side, side);
const entry = (grid: MathJSON, a: MathJSON, c: MathJSON): MathJSON => at(grid, add(mul(a, side), c, 1));

/** T[c][a, b] of the list `_tables`. */
const ways = (c: MathJSON, a: MathJSON, b: MathJSON): MathJSON =>
  at("_tables", add(mul(c, n, n), mul(sub(a, 1), n), b));

/** How many rows a list of n padded entries has: its positive ones. */
const rowsOf = (padded: MathJSON, tag: string): MathJSON =>
  fold(add(`${tag}_a`, iff(positive(at(padded, `${tag}_i`)), 1, 0)), `${tag}_a`, `${tag}_i`, 0, upTo(1, n));

/** The a's of the row above that a row [a′, β] may follow: a′..β + 1. Row 1 has none above, and reads
 *  F's a = 0 entry, which starts as 1 at c = 0. */
const aboveRange = (t: MathJSON, a1: MathJSON, beta: MathJSON): [MathJSON, MathJSON] => [
  iff(equal(t, 1), 0, a1),
  iff(equal(t, 1), 0, min(add(beta, 1), n)),
];

/** F after a row of row number `t` ending at `beta`, from F = `grid` of the rows before it. */
const advance = (grid: string, t: MathJSON, beta: MathJSON): MathJSON =>
  map(
    lets(
      [
        ["sp_a1", quotient("sp_i", side), "integer"],
        ["sp_c1", ["Mod", "sp_i", side], "integer"],
      ],
      iff(
        and(["GreaterEqual", "sp_a1", 1], ["LessEqual", "sp_a1", beta]),
        lets(
          [["sp_k", add(sub(beta, "sp_a1"), 1), "integer"]],
          iff(
            ["GreaterEqual", "sp_c1", "sp_k"],
            fold(
              add("sp_s", entry(grid, "sp_a", sub("sp_c1", "sp_k"))),
              "sp_s",
              "sp_a",
              0,
              upTo(...aboveRange(t, "sp_a1", beta)),
            ),
            0,
          ),
        ),
        0,
      ),
    ),
    "sp_i",
    upTo(0, sub(square, 1)),
  );

/** The shapes that continue the rows so far (F = `grid`) with a row of number `t` ending at `beta`. */
const started = (grid: string, t: MathJSON, beta: MathJSON): MathJSON =>
  fold(
    add(
      "sp_w",
      lets(
        [["sp_k", add(sub(beta, "sp_b"), 1), "integer"]],
        fold(
          add(
            "sp_u",
            fold(
              add("sp_v", mul(entry(grid, "sp_a", "sp_c"), ways(sub(sub(n, "sp_c"), "sp_k"), "sp_b", beta))),
              "sp_v",
              "sp_c",
              0,
              upTo(0, sub(n, "sp_k")),
            ),
          ),
          "sp_u",
          "sp_a",
          0,
          upTo(...aboveRange(t, "sp_b", beta)),
        ),
      ),
    ),
    "sp_w",
    "sp_b",
    0,
    upTo(1, beta),
  );

/** The shapes that end with row t − 1: those of F with a = 1 and all n cells; a first row has none. */
const stopped = (grid: string, t: MathJSON): MathJSON => entry(grid, iff(equal(t, 1), 0, 1), n);

/** The layers H of the a's below each row for the b's `bs` (rows of them): layer j, for row t = rows − j,
 *  at j·square, entry (a, c) the ways to choose the a's below row t, whose own is a, in c cells. */
const layers = (bs: MathJSON, rows: MathJSON): MathJSON =>
  fold(
    join(
      "sp_h",
      iff(
        equal("sp_j", 0),
        ["ReplaceAt", zeros(square), add(side, 1), 1],
        lets(
          [
            ["sp_below", at(bs, add(sub(rows, "sp_j"), 1)), "integer"],
            ["sp_prev", drop("sp_h", mul(sub("sp_j", 1), square)), "list<integer>"],
          ],
          map(
            lets(
              [
                ["sp_a", quotient("sp_i", side), "integer"],
                ["sp_c", ["Mod", "sp_i", side], "integer"],
              ],
              iff(
                and(["GreaterEqual", "sp_a", 1], ["LessEqual", "sp_a", add("sp_below", 1)]),
                fold(
                  add(
                    "sp_s",
                    iff(
                      ["GreaterEqual", "sp_c", add(sub("sp_below", "sp_a2"), 1)],
                      entry("sp_prev", "sp_a2", sub("sp_c", add(sub("sp_below", "sp_a2"), 1))),
                      0,
                    ),
                  ),
                  "sp_s",
                  "sp_a2",
                  0,
                  upTo(1, min("sp_below", "sp_a")),
                ),
                0,
              ),
            ),
            "sp_i",
            upTo(0, sub(square, 1)),
          ),
        ),
      ),
    ),
    "sp_h",
    "sp_j",
    list(),
    upTo(0, sub(rows, 1)),
  );

/** The ways to choose the a's below row t when its a is `a` and `left` cells remain, from layers `h`. */
const below = (h: string, rows: MathJSON, t: MathJSON, a: MathJSON, left: MathJSON): MathJSON =>
  iff(less(left, 0), 0, at(h, add(mul(sub(rows, t), square), mul(a, side), left, 1)));

const table = rowTable(
  "sk",
  add(size, 1),
  mul(size, size),
  (c) => iff(less(c, n), 1, 0),
  (prev, s, c) =>
    lets(
      [
        ["sk_a", add(quotient(c, n), 1), "integer"],
        ["sk_b", add(["Mod", c, n], 1), "integer"],
      ],
      iff(
        ["Greater", "sk_a", "sk_b"],
        0,
        fold(
          add(
            "sk_x",
            fold(
              add("sk_y", prev(sub(sub(s, "sk_b2"), sub(1, "sk_a2")), add(mul(sub("sk_a2", 1), n), sub("sk_b2", 1)))),
              "sk_y",
              "sk_a2",
              0,
              upTo(max(1, add(sub("sk_b2", s), 1)), min("sk_a", "sk_b2")),
            ),
          ),
          "sk_x",
          "sk_b2",
          0,
          upTo(max(sub("sk_a", 1), 1), "sk_b"),
        ),
      ),
    ),
);

/** F before any row: the start (a = 0) holds one way, with no cells. */
const startGrid = ["ReplaceAt", zeros(square), 1, 1];

/** The a pass over `rows` rows: `step` for each row, a state [rank, cells used, the last a, ...] threaded. */
const aPass = (init: MathJSON, rows: MathJSON, step: MathJSON): MathJSON =>
  fold(iff(["Greater", "sp_t", rows], "sp_q", step), "sp_q", "sp_t", init, upTo(1, n));

const unrank = (() => {
  // The b pass state: [rank left, the last b (0 once the shape has ended), F (square entries), the b's (n)].
  const st = "sp_st";
  const found = fold(
    iff(
      positive(at("sp_f", 2)),
      "sp_f",
      lets(
        [["sp_size", started("sp_g", "sp_t", "sp_o"), "integer"]],
        iff(less(at("sp_f", 1), "sp_size"), list(at("sp_f", 1), "sp_o"), list(sub(at("sp_f", 1), "sp_size"), 0)),
      ),
    ),
    "sp_f",
    "sp_o",
    list(sub(at(st, 1), "sp_end"), 0),
    upTo(1, at(st, 2)),
  );
  const bStep = iff(
    equal(at(st, 2), 0),
    st,
    lets(
      [
        ["sp_g", take(drop(st, 2), square), "list<integer>"],
        ["sp_bs", drop(st, add(2, square)), "list<integer>"],
      ],
      lets(
        [["sp_end", stopped("sp_g", "sp_t"), "integer"]],
        iff(
          less(at(st, 1), "sp_end"),
          join(list(at(st, 1), 0), "sp_g", "sp_bs"),
          lets(
            [["sp_fd", found, "list<integer>"]],
            join(list(at("sp_fd", 1), at("sp_fd", 2)), advance("sp_g", "sp_t", at("sp_fd", 2)), [
              "ReplaceAt",
              "sp_bs",
              "sp_t",
              at("sp_fd", 2),
            ]),
          ),
        ),
      ),
    ),
  );
  const bPass = fold(bStep, st, "sp_t", join(list("_r", n), startGrid, zeros(n)), upTo(1, n));
  // The a pass: [rank left, cells used, the last a, the a's (n)].
  const q = "sp_q";
  const aFound = fold(
    iff(
      positive(at("sp_f", 2)),
      "sp_f",
      lets(
        [
          [
            "sp_size",
            below("sp_h", "sp_rows", "sp_t", "sp_o", sub(sub(n, at(q, 2)), add(sub("sp_b", "sp_o"), 1))),
            "integer",
          ],
        ],
        iff(less(at("sp_f", 1), "sp_size"), list(at("sp_f", 1), "sp_o"), list(sub(at("sp_f", 1), "sp_size"), 0)),
      ),
    ),
    "sp_f",
    "sp_o",
    list(at(q, 1), 0),
    upTo(1, min("sp_b", at(q, 3))),
  );
  const aStep = lets(
    [["sp_b", at("sp_bs", "sp_t"), "integer"]],
    lets(
      [["sp_fd", aFound, "list<integer>"]],
      join(list(at("sp_fd", 1), add(at(q, 2), add(sub("sp_b", at("sp_fd", 2)), 1)), at("sp_fd", 2)), [
        "ReplaceAt",
        drop(q, 3),
        "sp_t",
        at("sp_fd", 2),
      ]),
    ),
  );
  const shape = (as: string): MathJSON => [
    "List",
    take("sp_bs", "sp_rows"),
    take(
      map(sub(at(as, "sp_i"), 1), "sp_i", upTo(1, "sp_rows")),
      fold(add("sp_n", iff(["Greater", at(as, "sp_i"), 1], 1, 0)), "sp_n", "sp_i", 0, upTo(1, "sp_rows")),
    ),
  ];
  return iff(
    less(n, 1),
    list(list(), list()),
    lets(
      [["sp_p1", bPass, "list<integer>"]],
      lets(
        [["sp_bs", drop("sp_p1", add(2, square)), "list<integer>"]],
        lets(
          [["sp_rows", rowsOf("sp_bs", "sr"), "integer"]],
          lets(
            [["sp_h", layers("sp_bs", "sp_rows"), "list<integer>"]],
            lets(
              [["sp_p2", aPass(join(list(at("sp_p1", 1), 0, n), zeros(n)), "sp_rows", aStep), "list<integer>"]],
              lets([["sp_as", drop("sp_p2", 3), "list<integer>"]], shape("sp_as")),
            ),
          ),
        ),
      ),
    ),
  );
})();

const rank = (() => {
  const lam = "sp_lam";
  const mu = "sp_mu";
  const st = "sp_st";
  const q = "sp_q";
  const bStep = lets(
    [
      ["sp_g", drop(st, 1), "list<integer>"],
      ["sp_bt", at(lam, "sp_t"), "integer"],
    ],
    join(
      list(
        add(
          at(st, 1),
          stopped("sp_g", "sp_t"),
          fold(add("sp_x", started("sp_g", "sp_t", "sp_o")), "sp_x", "sp_o", 0, upTo(1, sub("sp_bt", 1))),
        ),
      ),
      advance("sp_g", "sp_t", "sp_bt"),
    ),
  );
  const aStep = lets(
    [
      ["sp_b", at(lam, "sp_t"), "integer"],
      ["sp_a", add(iff(["LessEqual", "sp_t", length(mu)], at(mu, "sp_t"), 0), 1), "integer"],
    ],
    list(
      add(
        at(q, 1),
        fold(
          add("sp_x", below("sp_h", "sp_rows", "sp_t", "sp_o", sub(sub(n, at(q, 2)), add(sub("sp_b", "sp_o"), 1)))),
          "sp_x",
          "sp_o",
          0,
          upTo(1, min(sub("sp_a", 1), "sp_b", at(q, 3))),
        ),
      ),
      add(at(q, 2), add(sub("sp_b", "sp_a"), 1)),
      "sp_a",
    ),
  );
  return iff(
    less(n, 1),
    0,
    lets(
      [
        [lam, at("_x", 1), "list<integer>"],
        [mu, at("_x", 2), "list<integer>"],
      ],
      lets(
        [["sp_rows", length(lam), "integer"]],
        lets(
          [["sp_p1", fold(bStep, st, "sp_t", join(list(0), startGrid), upTo(1, "sp_rows")), "list<integer>"]],
          lets(
            [["sp_h", layers(lam, "sp_rows"), "list<integer>"]],
            at(fold(aStep, q, "sp_t", list(at("sp_p1", 1), 0, n), upTo(1, "sp_rows")), 1),
          ),
        ),
      ),
    ),
  );
})();

/** The partition μ of the element. */
const muOf = at("_x", 2);

export const skewPartitions: EpsilFamily = {
  head: "SkewPartitions",
  paramCount: 1,
  kind: "blocks",
  params: [n],
  elementType: "tuple<list<integer>, list<integer>>",
  // The table is about n⁵/25 steps, and exact integers of it are out of the interpreter's reach: past
  // 2^53 the count declines, before any table is built.
  declinePastDoubles: "count",
  early: { pastDoubles: ([size]) => size >= PAST_DOUBLES },
  epsil: {
    tables: table,
    count: iff(
      less(n, 1),
      iff(equal(n, 0), 1, 0),
      fold(
        add(
          "sc_a",
          fold(
            add("sc_b", ways(sub(n, add(sub("sc_hi", "sc_lo"), 1)), "sc_lo", "sc_hi")),
            "sc_b",
            "sc_lo",
            0,
            upTo(1, "sc_hi"),
          ),
        ),
        "sc_a",
        "sc_hi",
        0,
        upTo(1, n),
      ),
    ),
    unrank,
    rank,
    // One `lets`: a second leaves the interpreter's last fold steps unreduced.
    valid: iff(
      equal(len, 2),
      lets(
        [["sv_lam", at("_x", 1), "list<integer>"]],
        and(
          ["LessEqual", length(muOf), length("sv_lam")],
          all((i) => ["GreaterEqual", at("sv_lam", i), 1], upTo(1, length("sv_lam")), "sv_i"),
          all((i) => ["LessEqual", at("sv_lam", i), at("sv_lam", sub(i, 1))], upTo(2, length("sv_lam")), "sv_j"),
          all((i) => ["GreaterEqual", at(muOf, i), 1], upTo(1, length(muOf)), "sv_k"),
          all((i) => ["LessEqual", at(muOf, i), at(muOf, sub(i, 1))], upTo(2, length(muOf)), "sv_l"),
          all((i) => less(at(muOf, i), at("sv_lam", i)), upTo(1, length(muOf)), "sv_m"),
          ["Or", equal(length("sv_lam"), 0), less(length(muOf), length("sv_lam"))],
          all((i) => ["LessEqual", at(muOf, i), at("sv_lam", add(i, 1))], upTo(1, length(muOf)), "sv_o"),
          equal(
            sub(
              fold(add("sv_x", at("sv_lam", "sv_p")), "sv_x", "sv_p", 0, upTo(1, length("sv_lam"))),
              fold(add("sv_y", at(muOf, "sv_q")), "sv_y", "sv_q", 0, upTo(1, length(muOf))),
            ),
            n,
          ),
        ),
      ),
      "False",
    ),
  },
};

const fast: FastKernel = {
  count: ([size]) => skewShapeCount(size),
  unrank: ([size], r) => skewShapeUnrank(size, r),
  rank: (x, [size]) => {
    const [lam, mu] = x as number[][];
    return skewShapeRank(size, lam, mu);
  },
  valid: (x, [size]) => IsSkewPartitionOf(x, size),
};

// The steps of a call's passes over the rows of a shape, at most about n⁵/20 (measured to n = 33); the
// table, about n⁵/25, is built once per size.
const declared: Declared = {
  carrier: "SkewPartition",
  params: [{ name: "size", role: "axis", min: 0 }],
  cost: { count: "polynomial", unrank: "enumerative", rank: "enumerative", valid: "polynomial" },
  work: ([size]) => (BigInt(size) ** 5n + 19n) / 20n,
  walks: true,
};

export const entries: EpsilFamily[] = [{ ...skewPartitions, fast, declared }];
