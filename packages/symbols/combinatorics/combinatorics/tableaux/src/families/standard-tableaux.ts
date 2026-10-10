// StandardTableaux and ShiftedStandardTableaux in Epsil. A tableau is listed by its shape first, the
// shapes in the order of the partitions they are (IntegerPartitions, DistinctPartitions), then by
// where n sits: n is always at a removable corner, the corners are tried top row first, and
// what is left is a tableau of the shape without that cell. So the tableaux of a shape are
// counted by a hook-length formula, and a rank is walked down the corners.
//
// A shape is carried as a list of n row lengths, zeros after the last row. The hook-length
// formulas are exact quotients of products (`primeQuotient`): n! over the product of the hooks
// can't be taken in doubles without rounding once n! passes 2^53.

import type { EpsilFamily, FastKernel } from "../../../collections/src/families/epsil.ts";
import {
  IsStandardTableauOf,
  StandardTableauxCount,
  StandardTableauxRank,
  StandardTableauxUnrank,
} from "../../../collections/src/families/tableaux-trees.ts";
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
import { distinctPartitions, integerPartitions } from "../../../partitions/src/families/walks.ts";

type MathJSON = unknown;

const n = "_n";
const list = (...xs: MathJSON[]): MathJSON => ["List", ...xs];
const join = (...xs: MathJSON[]): MathJSON => ["Join", ...xs];
const drop = (xs: MathJSON, k: MathJSON): MathJSON => ["Drop", xs, k];
const take = (xs: MathJSON, k: MathJSON): MathJSON => ["Take", xs, k];
const length = (xs: MathJSON): MathJSON => ["Length", xs];
export const zeros = (count: MathJSON): MathJSON => map(0, "sy_z", upTo(1, count));
const positive = (x: MathJSON): MathJSON => ["Greater", x, 0];

/** `expr` with the symbol `from` named `to`. */
export const renamed = (expr: MathJSON, from: string, to: string): MathJSON =>
  expr === from ? to : Array.isArray(expr) ? expr.map((part) => renamed(part, from, to)) : expr;

/** How many cells a shape (a list of n row lengths) has. */
export const cellsOf = (shape: MathJSON): MathJSON =>
  fold(add("fh_a", at(shape, "fh_r")), "fh_a", "fh_r", 0, upTo(1, n));

/** How many rows a shape (a list of n row lengths) has: its positive entries. */
export const rowsOf = (shape: MathJSON): MathJSON =>
  fold(add("fh_a", iff(positive(at(shape, "fh_r")), 1, 0)), "fh_a", "fh_r", 0, upTo(1, n));

/** The parts of a partition as a shape: n entries, zeros after the parts. */
export const padded = (parts: MathJSON): MathJSON =>
  lets([["sy_parts", parts, "list<integer>"]], join("sy_parts", zeros(sub(n, length("sy_parts")))));

interface Kind {
  readonly head: string;
  readonly carrier: string;
  /** The partitions the shapes are: their tables, count, unrank and rank. */
  readonly shapes: EpsilFamily;
  /** The tableaux of the shape in the list `shape`. */
  readonly tableaux: (shape: string) => MathJSON;
  /** Whether n can sit at the end of row i (1-based) of the list `shape`. */
  readonly corner: (shape: string, i: MathJSON) => MathJSON;
  /** Whether the row `row` (nonempty) sits right under `above`. */
  readonly rowFits: (row: string, above: string) => MathJSON;
  /** Whether the entry k of `row` is greater than what is above it in `above`. */
  readonly columnFits: (above: string, row: string, k: MathJSON) => MathJSON;
  /** Their count, where it is not the sum over the shapes. */
  readonly count?: MathJSON;
  readonly declinePastDoubles: true | "count";
}

/** The family: shapes in order, a shape's tableaux by the corner n sits at. */
function cornerFamily(kind: Kind): EpsilFamily {
  const { tables: shapeTables, count: shapeCount, unrank: shapeUnrank, rank: shapeRank } = kind.shapes.epsil;
  // The shape of the partition at place `index`, as n entries.
  const shapeAt = (index: MathJSON): MathJSON =>
    padded(lets([["sy_pr", index, "integer"]], renamed(shapeUnrank, "_r", "sy_pr")));
  // The tableaux of the shape that row `i` of `shape` loses a cell from.
  const without = (shape: string, i: MathJSON): MathJSON =>
    lets([["sy_less", ["ReplaceAt", shape, i, sub(at(shape, i), 1)], "list<integer>"]], kind.tableaux("sy_less"));

  // _tables: the partitions' own, then the tableaux of each shape in turn.
  const shapeBase = mul(add(n, 1), add(n, 1));
  const countOfShape = (index: MathJSON): MathJSON => at("_tables", add(shapeBase, index, 1));
  const tables = lets(
    [["_tables", shapeTables, "list<integer>"]],
    join(
      "_tables",
      map(
        lets([["sy_shape", shapeAt("sy_i"), "list<integer>"]], kind.tableaux("sy_shape")),
        "sy_i",
        upTo(0, sub(shapeCount, 1)),
      ),
    ),
  );
  const count = kind.count ?? fold(add("sy_b", countOfShape("sy_i")), "sy_b", "sy_i", 0, upTo(0, sub(shapeCount, 1)));

  // Unrank. The shape is the first whose tableaux hold the rank; the state is [rank left, the
  // place of the shape, −1 until it is found].
  const findShape = fold(
    iff(
      ["GreaterEqual", at("sy_f", 2), 0],
      "sy_f",
      lets(
        [["sy_w", countOfShape("sy_i"), "integer"]],
        iff(less(at("sy_f", 1), "sy_w"), list(at("sy_f", 1), "sy_i"), list(sub(at("sy_f", 1), "sy_w"), -1)),
      ),
    ),
    "sy_f",
    "sy_i",
    list("_r", -1),
    upTo(0, sub(shapeCount, 1)),
  );
  // Then n down to 1: n sits in the first corner whose tableaux hold the rank left. The state is
  // [rank left, the shape's n row lengths, the row each value sits in…], and the scan down the
  // rows [rank left, the row, 0 until it is found].
  const scan = fold(
    iff(
      ["NotEqual", at("sy_c", 2), 0],
      "sy_c",
      iff(
        kind.corner("sy_s", "sy_j"),
        lets(
          [["sy_k", without("sy_s", "sy_j"), "integer"]],
          iff(less(at("sy_c", 1), "sy_k"), list(at("sy_c", 1), "sy_j"), list(sub(at("sy_c", 1), "sy_k"), 0)),
        ),
        "sy_c",
      ),
    ),
    "sy_c",
    "sy_j",
    list(at("sy_u", 1), 0),
    upTo(1, n),
  );
  const down = lets(
    [
      ["sy_s", take(drop("sy_u", 1), n), "list<integer>"],
      ["sy_o", drop("sy_u", add(n, 1)), "list<integer>"],
      ["sy_p", scan, "list<integer>"],
    ],
    join(
      list(at("sy_p", 1)),
      ["ReplaceAt", "sy_s", at("sy_p", 2), sub(at("sy_s", at("sy_p", 2)), 1)],
      ["ReplaceAt", "sy_o", sub(add(n, 1), "sy_t"), at("sy_p", 2)],
    ),
  );
  const unrank = lets(
    [
      ["sy_found", findShape, "list<integer>"],
      ["sy_shape", shapeAt(at("sy_found", 2)), "list<integer>"],
      [
        "sy_end",
        fold(down, "sy_u", "sy_t", join(list(at("sy_found", 1)), "sy_shape", zeros(n)), upTo(1, n)),
        "list<integer>",
      ],
      ["sy_rows", drop("sy_end", add(n, 1)), "list<integer>"],
    ],
    map(
      ["Filter", upTo(1, n), ["Function", equal(at("sy_rows", "sy_v"), "sy_i"), "sy_v"]],
      "sy_i",
      upTo(1, rowsOf("sy_shape")),
    ),
  );

  // Rank: the shape's place, the tableaux of the shapes before it, then the same walk down the
  // corners, adding the tableaux of each corner above the one n sits in.
  const rowLengths = map(lets([["sy_r", at("_x", "sy_i"), "list<integer>"]], length("sy_r")), "sy_i", upTo(1, len));
  const rowOfValue = fold(
    lets(
      [["sy_r", at("_x", "sy_i"), "list<integer>"]],
      fold(["ReplaceAt", "sy_m", at("sy_r", "sy_k"), "sy_i"], "sy_m", "sy_k", "sy_a", upTo(1, length("sy_r"))),
    ),
    "sy_a",
    "sy_i",
    zeros(n),
    upTo(1, len),
  );
  const above = fold(
    add(
      "sy_a",
      iff(
        and(less("sy_j", "sy_t"), kind.corner("sy_s", "sy_j")),
        lets([["sy_k", without("sy_s", "sy_j"), "integer"]], "sy_k"),
        0,
      ),
    ),
    "sy_a",
    "sy_j",
    0,
    upTo(1, n),
  );
  const up = lets(
    [
      ["sy_s", drop("sy_u", 1), "list<integer>"],
      ["sy_t", at("sy_o", "sy_v"), "integer"],
    ],
    join(list(add(at("sy_u", 1), above)), ["ReplaceAt", "sy_s", "sy_t", sub(at("sy_s", "sy_t"), 1)]),
  );
  const rank = lets(
    [
      ["sy_h", rowLengths, "list<integer>"],
      ["sy_place", renamed(shapeRank, "_x", "sy_h"), "integer"],
      ["sy_o", rowOfValue, "list<integer>"],
    ],
    add(
      fold(add("sy_b", countOfShape("sy_i")), "sy_b", "sy_i", 0, upTo(0, sub("sy_place", 1))),
      at(fold(up, "sy_u", "sy_v", join(list(0), padded("sy_h")), ["Range", n, 1, -1]), 1),
    ),
  );

  // Valid: rows nonempty and each fitting the one above; entries 1..n, each once; rows and
  // columns increasing.
  const row = (i: MathJSON, name: string, body: MathJSON): MathJSON =>
    lets([[name, at("_x", i), "list<integer>"]], body);
  const entries = (name: string, k: string, condition: (k: string) => MathJSON): MathJSON =>
    all(condition, upTo(1, length(name)), k);
  const seen = fold(
    row(
      "va_i",
      "va_r",
      fold(
        ["ReplaceAt", "va_m", at("va_r", "va_k"), add(at("va_m", at("va_r", "va_k")), 1)],
        "va_m",
        "va_k",
        "va_a",
        upTo(1, length("va_r")),
      ),
    ),
    "va_a",
    "va_i",
    zeros(n),
    upTo(1, len),
  );
  const valid = iff(
    equal(n, 0),
    equal(len, 0),
    and(
      all((i) => row(i, "va_r", ["GreaterEqual", length("va_r"), 1]), upTo(1, len), "va_i"),
      all((i) => row(i, "va_r", row(sub(i, 1), "va_q", kind.rowFits("va_r", "va_q"))), upTo(2, len), "va_h"),
      equal(fold(add("va_t", row("va_i", "va_r", length("va_r"))), "va_t", "va_i", 0, upTo(1, len)), n),
      all(
        (i) =>
          row(
            i,
            "va_r",
            entries("va_r", "va_k", (k) => and(["GreaterEqual", at("va_r", k), 1], ["LessEqual", at("va_r", k), n])),
          ),
        upTo(1, len),
        "va_j",
      ),
      lets(
        [["va_c", seen, "list<integer>"]],
        all((v) => equal(at("va_c", v), 1), upTo(1, n), "va_v"),
      ),
      all(
        (i) =>
          row(
            i,
            "va_r",
            all((k) => ["Less", at("va_r", sub(k, 1)), at("va_r", k)], upTo(2, length("va_r")), "va_l"),
          ),
        upTo(1, len),
        "va_g",
      ),
      all(
        (i) =>
          row(
            i,
            "va_r",
            row(
              sub(i, 1),
              "va_q",
              entries("va_r", "va_m", (k) => kind.columnFits("va_q", "va_r", k)),
            ),
          ),
        upTo(2, len),
        "va_f",
      ),
    ),
  );

  return {
    head: kind.head,
    carrier: kind.carrier,
    paramCount: 1,
    kind: "blocks",
    params: [n],
    declinePastDoubles: kind.declinePastDoubles,
    epsil: { count, tables, unrank, rank, valid },
  };
}

/**
 * `body` where `fh_L` is the shape's row count, `fh_M` its cells and `divisible(q)` how many of its
 * hook lengths q divides: the hook (r, c) is the arm, the leg and the cell.
 */
export const hooked = (shape: string, body: (divisible: (q: MathJSON) => MathJSON) => MathJSON): MathJSON => {
  const conjugate = map(
    fold(add("fh_a", iff(["GreaterEqual", at(shape, "fh_r"), "fh_c"], 1, 0)), "fh_a", "fh_r", 0, upTo(1, "fh_L")),
    "fh_c",
    upTo(1, n),
  );
  const hook = add(sub(at(shape, "fh_r"), "fh_c"), sub(at("fh_C", "fh_c"), "fh_r"), 1);
  const hooksDivisibleBy = (q: MathJSON): MathJSON =>
    fold(
      add(
        "fh_a",
        fold(add("fh_b", iff(equal(["Mod", hook, q], 0), 1, 0)), "fh_b", "fh_c", 0, upTo(1, at(shape, "fh_r"))),
      ),
      "fh_a",
      "fh_r",
      0,
      upTo(1, "fh_L"),
    );
  return lets(
    [
      ["fh_L", rowsOf(shape), "integer"],
      ["fh_M", cellsOf(shape), "integer"],
      ["fh_C", conjugate, "list<integer>"],
    ],
    body(hooksDivisibleBy),
  );
};

/** The tableaux of a shape: n!/∏ hooks. */
const hookLengths = (shape: string): MathJSON =>
  hooked(shape, (divisible) => primeQuotient("fh", n, (q) => quotient("fh_M", q), divisible));

/** The tableaux of a strict shape, by Thrall's formula: n!/∏ λᵢ! · ∏ᵢ<ⱼ (λᵢ − λⱼ)/(λᵢ + λⱼ). */
const shiftedHookLengths = (shape: string): MathJSON => {
  const pairs = (divides: (a: MathJSON, b: MathJSON) => MathJSON): MathJSON =>
    fold(
      add(
        "fh_a",
        fold(
          add("fh_b", iff(divides(at(shape, "fh_x"), at(shape, "fh_y")), 1, 0)),
          "fh_b",
          "fh_y",
          0,
          upTo(add("fh_x", 1), "fh_L"),
        ),
      ),
      "fh_a",
      "fh_x",
      0,
      upTo(1, "fh_L"),
    );
  return lets(
    [
      ["fh_L", rowsOf(shape), "integer"],
      ["fh_M", cellsOf(shape), "integer"],
    ],
    primeQuotient(
      "fh",
      n,
      (q) =>
        add(
          quotient("fh_M", q),
          pairs((a, b) => equal(["Mod", sub(a, b), q], 0)),
        ),
      (q) =>
        add(
          fold(add("fh_a", quotient(at(shape, "fh_x"), q)), "fh_a", "fh_x", 0, upTo(1, "fh_L")),
          pairs((a, b) => equal(["Mod", add(a, b), q], 0)),
        ),
    ),
  );
};

/** Whether the entry at row i of the list `shape` is positive, and below it a row is as short as a corner needs. */
const corner =
  (strict: boolean) =>
  (shape: string, i: MathJSON): MathJSON => {
    const here = at(shape, i);
    const next = at(shape, add(i, 1));
    // A shifted shape must stay strict: a row can lose a cell only if it ends two past the next.
    const room = strict ? ["Greater", here, add(next, 1)] : ["Greater", here, next];
    return iff(equal(i, n), positive(here), and(positive(here), strict ? ["Or", equal(next, 0), room] : room));
  };

// ─── StandardTableaux(n): n! / ∏ hooks over every partition of n. They are counted by the
// involutions of n (RSK pairs a tableau with a permutation's other half), I(m) = I(m − 1) + (m − 1)
// I(m − 2).
export const standardTableaux: EpsilFamily = cornerFamily({
  head: "StandardTableaux",
  carrier: "StandardTableau",
  shapes: integerPartitions,
  tableaux: hookLengths,
  corner: corner(false),
  rowFits: (row, above) => ["LessEqual", length(row), length(above)],
  columnFits: (above, row, k) => ["Less", at(above, k), at(row, k)],
  count: at(
    fold(
      list(at("sy_i", 2), add(at("sy_i", 2), mul(sub("sy_m", 1), at("sy_i", 1)))),
      "sy_i",
      "sy_m",
      list(1, 1),
      upTo(2, n),
    ),
    2,
  ),
  declinePastDoubles: true,
});

// ─── ShiftedStandardTableaux(n): the strict partitions of n, each cell right of the one above it
// being larger as well as the one below.
export const shiftedStandardTableaux: EpsilFamily = cornerFamily({
  head: "ShiftedStandardTableaux",
  carrier: "ShiftedStandardTableau",
  shapes: distinctPartitions,
  tableaux: shiftedHookLengths,
  corner: corner(true),
  rowFits: (row, above) => ["Less", length(row), length(above)],
  columnFits: (above, row, k) =>
    iff(["LessEqual", add(k, 1), length(above)], ["Less", at(above, add(k, 1)), at(row, k)], "True"),
  declinePastDoubles: "count",
});

/** The TS kernel in tableaux-trees.ts, which lists the tableaux in the same order. */
export const standardTableauxFast: FastKernel = {
  count: ([m]) => StandardTableauxCount(m),
  unrank: ([m], r) => StandardTableauxUnrank(m, r),
  rank: (e, [m]) => StandardTableauxRank(e as number[][], m),
  valid: (e, [m]) => IsStandardTableauOf(e, m),
};

export const standardTableauxEntries: EpsilFamily[] = [{ ...standardTableaux, fast: standardTableauxFast }];
