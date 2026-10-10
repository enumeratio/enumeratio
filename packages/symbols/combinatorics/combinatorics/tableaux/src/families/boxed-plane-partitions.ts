// BoxedPlanePartitions(a, b, c) in Epsil: the plane partitions in an a × b × c box (at most a rows,
// each at most b long, entries at most c), as lists of rows, listed by shape (the row lengths, a prefix
// first) and then by the entries row by row. The count is MacMahon's box formula, taken exactly.
//
// A row is a unit. The N = C(b + c, b) rows (a weakly falling list of at most b entries of 1..c, the
// empty one included) are numbered by length and then lex order, so those of length ℓ are the block
// starting at C(ℓ + c − 1, ℓ − 1). A row σ fits under ρ when each of its entries is at most the entry of ρ
// above it. _tables holds U[l][ρ], the plane partitions that go on below the row ρ with at most l rows
// more (U[0] = 1, U[l][ρ] = 1 + Σ U[l − 1][σ] over the σ under ρ), then the rows themselves.
//
// A rank is found in two passes. The shape pass chooses the row lengths: F[ρ] counts the choices of rows so
// far that end in ρ, and a row t of length λ starts Σ U[a − t][ρ]·(Σ F[ρ′] over the ρ′ that ρ fits under)
// plane partitions, over the rows ρ of length λ; F then moves down a row. The entries pass walks the rows
// of the shape by W, the ways to finish the shape below each row.

import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import {
  add,
  all,
  and,
  at,
  equal,
  fold,
  iff,
  less,
  lets,
  map,
  mul,
  primeQuotient,
  rowTable,
  sub,
  upTo,
} from "../../../collections/src/families/tables.ts";

type MathJSON = unknown;

const list = (...xs: MathJSON[]): MathJSON => ["List", ...xs];
const join = (...xs: MathJSON[]): MathJSON => ["Join", ...xs];
const drop = (xs: MathJSON, count: MathJSON): MathJSON => ["Drop", xs, count];
const take = (xs: MathJSON, count: MathJSON): MathJSON => ["Take", xs, count];
const length = (xs: MathJSON): MathJSON => ["Length", xs];
const binomial = (n: MathJSON, k: MathJSON): MathJSON => ["Binomial", n, k];
const positive = (x: MathJSON): MathJSON => ["Greater", x, 0];
const zeros = (count: MathJSON, v: string): MathJSON => map(0, v, upTo(1, count));

// Every bound variable is named once, so no fold or lambda is ever inside another that uses its name.
let serial = 0;
const fresh = (stem: string): string => `bp_${stem}${serial++}`;

/** The sum of `body(x)` over the x of `over`. */
const total = (body: (x: string) => MathJSON, over: MathJSON): MathJSON => {
  const [acc, x] = [fresh("s"), fresh("x")];
  return fold(add(acc, body(x)), acc, x, 0, over);
};

// A box with an empty side holds the empty plane partition alone: the effective sides are all 0.
const empty = ["Or", less("_a", 1), less("_b", 1), less("_c", 1)];
const effective = (name: string): MathJSON => iff(empty, 0, name);
const [A, B, C, N] = ["bp_A", "bp_B", "bp_C", "bp_N"];

/** The effective sides and the row count bound as A, B, C and N around `body`. */
const sides = (body: MathJSON): MathJSON =>
  lets(
    [
      [A, effective("_a"), "integer"],
      [B, effective("_b"), "integer"],
      [C, effective("_c"), "integer"],
    ],
    lets([[N, binomial(add(B, C), B), "integer"]], body),
  );

/** Where the rows of length `len` start in the numbering, and how many there are. */
const start = (len: MathJSON): MathJSON => binomial(add(sub(len, 1), C), sub(len, 1));
const blockSize = (len: MathJSON): MathJSON => binomial(add(len, sub(C, 1)), len);
const block = (len: MathJSON): MathJSON => upTo(start(len), sub(add(start(len), blockSize(len)), 1));

/** The row numbered `i`, as the list [length, entries (B of them, 0 after the length)] in `rows`, offset `off`. */
const entryOf = (rows: string, off: MathJSON, i: MathJSON, j: MathJSON): MathJSON =>
  at(rows, add(off, mul(i, add(B, 1)), j, 1));

/** Whether the row `s` fits under the row `r`: no entry of s is above r's (past its length s reads 0). 1 or 0. */
const fits = (read: (i: MathJSON, j: MathJSON) => MathJSON, s: MathJSON, r: MathJSON): MathJSON => {
  const [acc, j] = [fresh("a"), fresh("j")];
  return iff(
    equal(0, fold(add(acc, iff(["Greater", read(s, j), read(r, j)], 1, 0)), acc, j, 0, upTo(1, read(s, 0)))),
    1,
    0,
  );
};

// ─── _tables ───
/** The rows, in the numbering: the empty row, then each length's block in lex order. */
const rowsTable = (() => {
  const [acc, i, prev, last, j, k] = [fresh("a"), fresh("i"), fresh("p"), fresh("l"), fresh("j"), fresh("k")];
  const cap = (at_: MathJSON): MathJSON => iff(equal(at_, 1), C, at(prev, at_));
  // The last entry that can be raised: within the row's length, below the entry before it (or c).
  const raised = fold(
    iff(and(["LessEqual", j, at(prev, 1)], less(at(prev, add(j, 1)), cap(j))), j, last),
    last,
    j,
    0,
    upTo(1, B),
  );
  const next = lets(
    [[prev, take(drop(acc, mul(sub(i, 1), add(B, 1))), add(B, 1)), "list<integer>"]],
    lets(
      [[last, raised, "integer"]],
      iff(
        equal(last, 0),
        join(list(add(at(prev, 1), 1)), map(iff(["LessEqual", k, add(at(prev, 1), 1)], 1, 0), k, upTo(1, B))),
        join(
          list(at(prev, 1)),
          map(
            iff(
              less(k, last),
              at(prev, add(k, 1)),
              iff(equal(k, last), add(at(prev, add(k, 1)), 1), iff(["LessEqual", k, at(prev, 1)], 1, 0)),
            ),
            k,
            upTo(1, B),
          ),
        ),
      ),
    ),
  );
  return fold(join(acc, next), acc, i, zeros(add(B, 1), fresh("z")), upTo(1, sub(N, 1)));
})();

/** U[l][ρ] for l = 0..a, layer by layer, a layer N entries (`rowTable`, rows l, columns ρ). */
const layersU = (rows: string): MathJSON => {
  const read = (r: MathJSON, j: MathJSON): MathJSON => entryOf(rows, 0, r, j);
  return rowTable(
    "bu",
    add(A, 1),
    N,
    () => 1,
    (prev, l, i) =>
      add(
        1,
        total(
          (s) => mul(fits(read, s, i), prev(sub(l, 1), s)),
          // The rows no longer than ρ come first in the numbering.
          upTo(1, sub(binomial(add(read(i, 0), C), read(i, 0)), 1)),
        ),
      ),
  );
};

const tables = sides(lets([["bp_rows", rowsTable, "list<integer>"]], join(layersU("bp_rows"), "bp_rows")));

// ─── operations, reading `_tables` ───
const rowsOff = mul(add(A, 1), N);
const read = (i: MathJSON, j: MathJSON): MathJSON => entryOf("_tables", rowsOff, i, j);
const lengthOf = (i: MathJSON): MathJSON => read(i, 0);
const underAt = (l: MathJSON, i: MathJSON): MathJSON => at("_tables", add(mul(l, N), i, 1));
const fitsRow = (s: MathJSON, r: MathJSON): MathJSON => fits(read, s, r);

/** Σ F[ρ′]·[ρ fits under ρ′] over the rows ρ′ of length `cap`, the F of the rows so far. */
const above = (grid: string, cap: MathJSON, rho: MathJSON): MathJSON =>
  total((s) => iff(positive(at(grid, add(s, 1))), mul(at(grid, add(s, 1)), fitsRow(rho, s)), 0), block(cap));

/** The plans whose row t has length `len`, after rows so far F with the last of length `cap`. */
const started = (grid: string, t: MathJSON, cap: MathJSON, len: MathJSON): MathJSON =>
  total((rho) => mul(underAt(sub(A, t), rho), above(grid, cap, rho)), block(len));

/** F after a row of length `len`. */
const advance = (grid: string, cap: MathJSON, len: MathJSON): MathJSON => {
  const i = fresh("i");
  return map(iff(equal(lengthOf(i), len), above(grid, cap, i), 0), i, upTo(0, sub(N, 1)));
};

/** F before any row: the row of c's of length b, which every row fits under. */
const startGrid = (): MathJSON => {
  const i = fresh("i");
  return map(iff(equal(i, sub(N, 1)), 1, 0), i, upTo(0, sub(N, 1)));
};

/** The number of rows a list of `count` lengths has: its positive entries. */
const rowsOf = (lengths: MathJSON, count: MathJSON): MathJSON =>
  total((t) => iff(positive(at(lengths, t)), 1, 0), upTo(1, count));

/** W layers for the lengths `ls` (k rows): layer j = k − t holds, at the rows of length ℓₜ, the ways to
 *  finish the shape below row t. */
const layersW = (ls: string, k: string): MathJSON => {
  const [acc, j, i, prev] = [fresh("a"), fresh("j"), fresh("i"), fresh("p")];
  const t = sub(k, j);
  const finish = lets(
    [[prev, drop(acc, mul(sub(j, 1), N)), "list<integer>"]],
    map(
      iff(
        equal(lengthOf(i), at(ls, t)),
        total(
          (s) => iff(positive(at(prev, add(s, 1))), mul(at(prev, add(s, 1)), fitsRow(s, i)), 0),
          block(at(ls, add(t, 1))),
        ),
        0,
      ),
      i,
      upTo(0, sub(N, 1)),
    ),
  );
  const last = map(iff(equal(lengthOf(i), at(ls, k)), 1, 0), i, upTo(0, sub(N, 1)));
  return fold(join(acc, iff(equal(j, 0), last, finish)), acc, j, list(), upTo(0, sub(k, 1)));
};
const finishAt = (layers: string, k: string, t: MathJSON, s: MathJSON): MathJSON =>
  at(layers, add(mul(sub(k, t), N), s, 1));

const unrank = (() => {
  // The shape pass state: [rank left, the last length (0 once the shape has ended), F (N entries), the lengths (a)].
  const [st, t, cap] = [fresh("st"), fresh("t"), fresh("cap")];
  const [grid, ls, end, found, lam, size, acc] = ["g", "ls", "end", "fd", "lam", "sz", "f"].map(fresh);
  const search = fold(
    iff(
      positive(at(acc, 2)),
      acc,
      lets(
        [[size, started(grid, t, cap, lam), "integer"]],
        iff(less(at(acc, 1), size), list(at(acc, 1), lam), list(sub(at(acc, 1), size), 0)),
      ),
    ),
    acc,
    lam,
    list(sub(at(st, 1), end), 0),
    upTo(1, cap),
  );
  const shapeStep = iff(
    equal(at(st, 2), 0),
    st,
    lets(
      [
        [grid, take(drop(st, 2), N), "list<integer>"],
        [ls, drop(st, add(2, N)), "list<integer>"],
        [cap, at(st, 2), "integer"],
      ],
      lets(
        [[end, total((s) => at(grid, add(s, 1)), upTo(0, sub(N, 1))), "integer"]],
        iff(
          less(at(st, 1), end),
          join(list(at(st, 1), 0), grid, ls),
          lets(
            [[found, search, "list<integer>"]],
            join(list(at(found, 1), at(found, 2)), advance(grid, cap, at(found, 2)), [
              "ReplaceAt",
              ls,
              t,
              at(found, 2),
            ]),
          ),
        ),
      ),
    ),
  );
  const shapePass = fold(shapeStep, st, t, join(list("_r", B), startGrid(), zeros(A, fresh("z"))), upTo(1, A));

  // The entries pass state: [rank left, the last row's number, the numbers of the rows (a)].
  const [q, u, w, rows, p1, layers, chosen, row, lens, picked, ways, j] = [
    "q",
    "u",
    "w",
    "rows",
    "p1",
    "wl",
    "ch",
    "row",
    "lens",
    "pk",
    "ways",
    "j",
  ].map(fresh);
  // The search of a row's number: [rank left, the number found plus 1, or 0].
  const pick = fold(
    iff(
      positive(at(picked, 2)),
      picked,
      iff(
        equal(fitsRow(w, at(q, 2)), 1),
        lets(
          [[ways, finishAt(layers, rows, u, w), "integer"]],
          iff(less(at(picked, 1), ways), list(at(picked, 1), add(w, 1)), list(sub(at(picked, 1), ways), 0)),
        ),
        picked,
      ),
    ),
    picked,
    w,
    list(at(q, 1), 0),
    block(at(lens, u)),
  );
  const entriesStep = iff(
    ["Greater", u, rows],
    q,
    lets(
      [[row, pick, "list<integer>"]],
      join(list(at(row, 1), sub(at(row, 2), 1)), ["ReplaceAt", drop(q, 2), u, sub(at(row, 2), 1)]),
    ),
  );
  const entriesPass = fold(entriesStep, q, u, join(list(at(p1, 1), sub(N, 1)), zeros(A, fresh("z"))), upTo(1, A));
  const element = map(map(read(at(chosen, t), j), j, upTo(1, lengthOf(at(chosen, t)))), t, upTo(1, rows));
  return sides(
    lets(
      [[p1, shapePass, "list<integer>"]],
      lets(
        [[lens, drop(p1, add(2, N)), "list<integer>"]],
        lets(
          [[rows, rowsOf(lens, A), "integer"]],
          lets(
            [[layers, layersW(lens, rows), "list<integer>"]],
            lets([[chosen, drop(entriesPass, 2), "list<integer>"]], element),
          ),
        ),
      ),
    ),
  );
})();

const rank = (() => {
  const x = "_x";
  const [st, t, grid, cap, lam, ls, k, layers, idx] = ["st", "t", "g", "cap", "lam", "ls", "k", "wl", "ix"].map(fresh);
  const shapeStep = lets(
    [
      [grid, drop(st, 1), "list<integer>"],
      [cap, iff(equal(t, 1), B, at(ls, sub(t, 1))), "integer"],
      [lam, at(ls, t), "integer"],
    ],
    join(
      list(
        add(
          at(st, 1),
          total((s) => at(grid, add(s, 1)), upTo(0, sub(N, 1))),
          total((l) => started(grid, t, cap, l), upTo(1, sub(lam, 1))),
        ),
      ),
      advance(grid, cap, lam),
    ),
  );
  const shapePass = fold(shapeStep, st, t, join(list(0), startGrid()), upTo(1, k));
  // The number of the row x_t: the one of its block that reads the same.
  const numberOf = (row: MathJSON, len: MathJSON): MathJSON => {
    const [acc, s] = [fresh("a"), fresh("n")];
    return fold(
      iff(
        equal(
          0,
          total((j) => iff(["NotEqual", read(s, j), at(row, j)], 1, 0), upTo(1, len)),
        ),
        s,
        acc,
      ),
      acc,
      s,
      0,
      block(len),
    );
  };
  const entriesSt = fresh("st");
  const entriesStep = lets(
    [[idx, numberOf(at(x, t), at(ls, t)), "integer"]],
    list(
      add(
        at(entriesSt, 1),
        total(
          (s) => iff(equal(fitsRow(s, at(entriesSt, 2)), 1), finishAt(layers, k, t, s), 0),
          upTo(start(at(ls, t)), sub(idx, 1)),
        ),
      ),
      idx,
    ),
  );
  return sides(
    iff(
      equal(length(x), 0),
      0,
      lets(
        [[k, length(x), "integer"]],
        lets(
          [[ls, map(length(at(x, t)), t, upTo(1, k)), "list<integer>"]],
          lets(
            [[layers, layersW(ls, k), "list<integer>"]],
            at(fold(entriesStep, entriesSt, t, list(at(shapePass, 1), sub(N, 1)), upTo(1, k)), 1),
          ),
        ),
      ),
    ),
  );
})();

/** The plane partition's own rules, in the box's effective sides: rows of lengths b or less, falling, each
 *  row's entries 1..c and falling along it and down the columns. */
const valid = (() => {
  const x = "_x";
  const [Ae, Be, Ce] = [effective("_a"), effective("_b"), effective("_c")];
  const row = (t: MathJSON): MathJSON => at(x, t);
  const rowLength = (t: MathJSON): MathJSON => length(row(t));
  const shapeOk = all(
    (t) =>
      iff(
        and(["GreaterEqual", rowLength(t), 1], ["LessEqual", rowLength(t), Be]),
        iff(equal(t, 1), "True", ["LessEqual", rowLength(t), rowLength(sub(t, 1))]),
        "False",
      ),
    upTo(1, length(x)),
    "bp_vt",
  );
  const entriesOk = all(
    (t) =>
      all(
        (j) =>
          and(
            ["GreaterEqual", at(row(t), j), 1],
            ["LessEqual", at(row(t), j), Ce],
            iff(equal(j, 1), "True", ["LessEqual", at(row(t), j), at(row(t), sub(j, 1))]),
            iff(equal(t, 1), "True", ["LessEqual", at(row(t), j), at(row(sub(t, 1)), j)]),
          ),
        upTo(1, rowLength(t)),
        "bp_vj",
      ),
    upTo(1, length(x)),
    "bp_vu",
  );
  return iff(["LessEqual", length(x), Ae], iff(shapeOk, entriesOk, "False"), "False");
})();

/** How many pairs (i, j) of 1..a × 1..b have `factor(i + j)` divisible by q. */
const divisible = (q: MathJSON, factor: (s: MathJSON) => MathJSON): MathJSON =>
  total(
    (s) =>
      mul(
        ["Max", 0, add(sub(["Min", A, sub(s, 1)], ["Max", 1, sub(s, B)]), 1)],
        iff(equal(["Mod", factor(s), q], 0), 1, 0),
      ),
    upTo(2, add(A, B)),
  );

export const boxedPlanePartitions: EpsilFamily = {
  head: "BoxedPlanePartitions",
  paramCount: 3,
  kind: "blocks",
  params: ["_a", "_b", "_c"],
  declinePastDoubles: true,
  epsil: {
    tables,
    // The factors (i + j + c − 1)/(i + j − 1) group by s = i + j: s has min(a, s − 1) − max(1, s − b) + 1 pairs.
    count: sides(
      primeQuotient(
        "bc",
        sub(add(A, B, C), 1),
        (q) => divisible(q, (s) => sub(add(s, C), 1)),
        (q) => divisible(q, (s) => sub(s, 1)),
      ),
    ),
    unrank,
    rank,
    valid,
  },
};
