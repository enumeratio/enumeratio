// SkewStandardTableaux(n) in Epsil: the standard fillings of every reduced skew shape λ/μ of n cells
// (entries 1..n, each once, rising along rows and down columns), as [λ, μ, row word], the row word
// listing the 0-based row of entry 1, 2, … in turn. They come shape by shape in SkewPartitions' order,
// then by row word, lex, which is the order of a walk placing 1..n and trying the lowest legal row first.
//
// The cells placed so far are an order ideal of the shape: each row filled from the left, so that the
// filled part ν = μ + (the cells in each row) stays a partition. A row is legal next when it has a cell
// left and ν stays a partition after adding it. A shape's ideals are numbered by the cells left in each
// row, d, as digits of a mixed radix (row i's digit runs 0..lenᵢ, lenᵢ = λᵢ − μᵢ, its stride the
// product of the radices before it), so placing in row r is a step down by its stride, and
// f[d] = Σ f[d − e_r] over the legal rows r counts the ways to finish: f[0] = 1 and the shape's count
// is f at the digits d = len. The numbers of digits that are no ideal are filled too and never read.
//
// _tables holds SkewPartitions' own, then the count of each shape in turn. A call makes f again for
// the one shape it reads, so that no table of every shape's ideals is held.

import type { EpsilFamily, FastKernel } from "../../../collections/src/families/epsil.ts";
import type { Declared } from "../../../collections/src/families/types.ts";
import {
  add,
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
  sub,
  upTo,
} from "../../../collections/src/families/tables.ts";
import { skewPartitions } from "../../../partitions/src/families/skew-partitions.ts";
import {
  IsSkewPartitionOf,
  skewShapeCount,
  skewShapeRank,
  skewShapeUnrank,
} from "../../../partitions/src/families/skew-shapes.ts";
import { renamed } from "./standard-tableaux.ts";

type MathJSON = unknown;

const n = "_n";
const list = (...xs: MathJSON[]): MathJSON => ["List", ...xs];
const join = (...xs: MathJSON[]): MathJSON => ["Join", ...xs];
const drop = (xs: MathJSON, count: MathJSON): MathJSON => ["Drop", xs, count];
const length = (xs: MathJSON): MathJSON => ["Length", xs];
const replaceAt = (xs: MathJSON, i: MathJSON, value: MathJSON): MathJSON => ["ReplaceAt", xs, i, value];
const lessEqual = (a: MathJSON, b: MathJSON): MathJSON => ["LessEqual", a, b];
const greaterEqual = (a: MathJSON, b: MathJSON): MathJSON => ["GreaterEqual", a, b];
const zeros = (count: MathJSON): MathJSON => map(0, "ss_z", upTo(1, count));
const pairType = "list<list<integer>>";
// What SkewPartitions' unrank gives: the compiler allows a missing entry.
const unrankedType = "list<list<integer | nan>>";

// Every bound variable is named once, so no fold or lambda is ever inside another that uses its name.
let serial = 0;
const fresh = (stem: string): string => `ss_${stem}${serial++}`;

/** The names `shaped` binds: the shape's λ and μ, its row count, row lengths, strides and number of states. */
const [lam, mu, rows, lens, strides, size] = ["lam", "mu", "L", "len", "st", "M"].map((name) => `ss_${name}`);

/** `body` with the shape named `of` (a pair [λ, μ]) bound by the names of its λ, μ, row count and row lengths. */
const sized = (of: string, body: MathJSON): MathJSON => {
  const i = fresh("i");
  const lensOf = map(sub(at(lam, i), iff(lessEqual(i, length(mu)), at(mu, i), 0)), i, upTo(1, rows));
  return lets(
    [
      [lam, at(of, 1), "list<integer>"],
      [mu, at(of, 2), "list<integer>"],
    ],
    lets([[rows, length(lam), "integer"]], lets([[lens, lensOf, "list<integer>"]], body)),
  );
};

/** `body` with the shape named `of` (a pair [λ, μ] of n ≥ 1 cells) bound as well by its strides and number of states. */
const shaped = (of: string, body: MathJSON): MathJSON => {
  const [i, acc] = [fresh("i"), fresh("s")];
  const stridesOf = fold(
    join(acc, list(mul(at(acc, sub(i, 1)), add(at(lens, sub(i, 1)), 1)))),
    acc,
    i,
    list(1),
    upTo(2, rows),
  );
  return sized(
    of,
    lets(
      [[strides, stridesOf, "list<integer>"]],
      lets([[size, mul(at(strides, rows), add(at(lens, rows), 1)), "integer"]], body),
    ),
  );
};

/** The digit of row `r` in the state `p`: the cells left in that row. */
const digit = (r: MathJSON, p: MathJSON): MathJSON => ["Mod", quotient(p, at(strides, r)), add(at(lens, r), 1)];

/** Whether row `r` can take the next cell in the state `p`: one is left, and the row above, if any, is at
 *  least a cell further on (ν stays a partition). */
const legal = (r: MathJSON, p: MathJSON): MathJSON => {
  const d = fresh("d");
  return lets(
    [[d, digit(r, p), "integer"]],
    and(
      greaterEqual(d, 1),
      iff(equal(r, 1), "True", lessEqual(digit(sub(r, 1), p), sub(add(sub(at(lam, sub(r, 1)), at(lam, r)), d), 1))),
    ),
  );
};

/** f for the states 0..M − 1 of the shape bound by `shaped`: f[0] = 1, f[p] the sum over the legal rows of f[p − stride]. */
const waysTable = (): MathJSON => {
  const [f, p, r, acc] = [fresh("f"), fresh("p"), fresh("r"), fresh("a")];
  const cell = fold(add(acc, iff(legal(r, p), at(f, add(sub(p, at(strides, r)), 1)), 0)), acc, r, 0, upTo(1, rows));
  return fold(replaceAt(f, add(p, 1), cell), f, p, replaceAt(zeros(size), 1, 1), upTo(1, sub(size, 1)));
};

// _tables: SkewPartitions', then the count of each shape, in order.
const shapeCount = skewPartitions.epsil.count;
const shapeBase = mul(add(n, 1), n, n);
const countOfShape = (index: MathJSON): MathJSON => at("_tables", add(shapeBase, index, 1));
const shapeAt = (index: MathJSON): MathJSON =>
  lets([["ss_ix", index, "integer"]], renamed(skewPartitions.epsil.unrank, "_r", "ss_ix"));

const tables = lets(
  [["_tables", skewPartitions.epsil.tables, "list<integer>"]],
  join(
    "_tables",
    iff(
      less(n, 1),
      list(),
      map(
        (() => {
          const s = fresh("s");
          return lets([[s, shapeAt("ss_s"), unrankedType]], shaped(s, at(waysTable(), size)));
        })(),
        "ss_s",
        upTo(0, sub(shapeCount, 1)),
      ),
    ),
  ),
);

const count = iff(
  less(n, 1),
  iff(equal(n, 0), 1, 0),
  fold(add("ss_b", countOfShape("ss_i")), "ss_b", "ss_i", 0, upTo(0, sub(shapeCount, 1))),
);

const unrank = (() => {
  const [found, f, u, pick, row, w, r, state, shape, t] = [
    "found",
    "f",
    "u",
    "pick",
    "row",
    "w",
    "r",
    "state",
    "shape",
    "t",
  ].map(fresh);
  // The shape is the first whose count holds the rank: the state is the pair [rank left, the shape's place or −1 until found].
  const findShape = fold(
    iff(
      greaterEqual(at(state, 2), 0),
      state,
      lets(
        [[w, countOfShape("ss_i"), "integer"]],
        iff(less(at(state, 1), w), list(at(state, 1), "ss_i"), list(sub(at(state, 1), w), -1)),
      ),
    ),
    state,
    "ss_i",
    list("_r", -1),
    upTo(0, sub(shapeCount, 1)),
  );
  // Then entry t = 1..n takes the first legal row whose ways hold the rank left. The state is
  // [rank left, the state p, the rows so far (n)]; the scan down the rows is [rank left, the row or 0].
  const p = at(u, 2);
  const scan = fold(
    iff(
      ["NotEqual", at(pick, 2), 0],
      pick,
      iff(
        legal(r, p),
        lets(
          [[w, at(f, add(sub(p, at(strides, r)), 1)), "integer"]],
          iff(less(at(pick, 1), w), list(at(pick, 1), r), list(sub(at(pick, 1), w), 0)),
        ),
        pick,
      ),
    ),
    pick,
    r,
    list(at(u, 1), 0),
    upTo(1, rows),
  );
  const step = lets(
    [[row, scan, "list<integer>"]],
    join(list(at(row, 1), sub(p, at(strides, at(row, 2)))), replaceAt(drop(u, 2), t, sub(at(row, 2), 1))),
  );
  const walk = fold(step, u, t, join(list(at(found, 1), sub(size, 1)), zeros(n)), upTo(1, n));
  return iff(
    less(n, 1),
    list(list(), list(), list()),
    lets(
      [[found, findShape, "list<integer>"]],
      lets(
        [[shape, shapeAt(at(found, 2)), unrankedType]],
        shaped(shape, lets([[f, waysTable(), "list<integer>"]], list(lam, mu, drop(walk, 2)))),
      ),
    ),
  );
})();

const rank = (() => {
  const [f, u, pair, place, t, before, r, a, i] = ["f", "u", "pair", "place", "t", "before", "r", "a", "i"].map(fresh);
  const p = at(u, 2);
  const row = add(at(at("_x", 3), t), 1);
  // Entry t takes its row: the ways of the legal rows before it are added, and the state steps down.
  const step = list(
    add(
      at(u, 1),
      fold(add(a, iff(legal(r, p), at(f, add(sub(p, at(strides, r)), 1)), 0)), a, r, 0, upTo(1, sub(row, 1))),
    ),
    sub(p, at(strides, row)),
  );
  return iff(
    less(n, 1),
    0,
    lets(
      [[pair, list(at("_x", 1), at("_x", 2)), pairType]],
      lets(
        [[place, renamed(skewPartitions.epsil.rank, "_x", pair), "integer"]],
        shaped(
          pair,
          lets(
            [[f, waysTable(), "list<integer>"]],
            add(
              fold(add(before, countOfShape(i)), before, i, 0, upTo(0, sub(place, 1))),
              at(fold(step, u, t, list(0, sub(size, 1)), upTo(1, n)), 1),
            ),
          ),
        ),
      ),
    ),
  );
})();

const valid = (() => {
  const [pair, state, e, mus, t] = ["pair", "state", "e", "mus", "t"].map(fresh);
  const word = at("_x", 3);
  const dead = join(list(0), zeros(rows));
  // The state is [1 while every entry fit, the cells placed in each row (L)]; entry e (a 0-based row) fills
  // the next cell of row r = e + 1, which must be free, and as far on as the row above, if any, is.
  const r = add(e, 1);
  const placed = (row: MathJSON): MathJSON => at(state, add(row, 1));
  const fits = and(
    less(placed(r), at(lens, r)),
    iff(equal(r, 1), "True", greaterEqual(add(at(mus, sub(r, 1)), placed(sub(r, 1))), add(at(mus, r), placed(r), 1))),
  );
  const step = lets(
    [[e, at(word, t), "integer"]],
    iff(
      equal(at(state, 1), 0),
      state,
      iff(
        and(greaterEqual(e, 0), less(e, rows)),
        iff(fits, replaceAt(state, add(r, 1), add(placed(r), 1)), dead),
        dead,
      ),
    ),
  );
  const wordOk = lets(
    [[mus, join(mu, zeros(sub(rows, length(mu)))), "list<integer>"]],
    equal(at(fold(step, state, t, join(list(1), zeros(rows)), upTo(1, length(word))), 1), 1),
  );
  return iff(
    equal(len, 3),
    lets(
      [[pair, list(at("_x", 1), at("_x", 2)), pairType]],
      iff(
        renamed(skewPartitions.epsil.valid, "_x", pair),
        // No cells: the empty shape, and the empty word it was just checked to be.
        iff(equal(length(word), n), iff(equal(n, 0), "True", sized(pair, wordOk)), "False"),
        "False",
      ),
    ),
    "False",
  );
})();

/** The count at n = 0..14, exact (summed per shape over the tables above, in doubles: each is below 2^53). */
export const EXACT_COUNTS = [
  1, 1, 4, 24, 194, 1960, 23770, 336322, 5438496, 98936250, 1999814916, 44464855512, 1078530770196, 28340682384300,
  801997011421320,
];

/** The first size whose count is surely past 2^53. A tableau of n cells gives n + 1 tableaux of n + 1: a new top
 *  row of one cell, touching the shape's corner, with its entry put anywhere in the word. So the count of n + 1 is
 *  at least n + 1 times that of n, from the last exact one (n = 14: 15 times 8.0e14 passes 2^53). */
const PAST_DOUBLES = (() => {
  let size = EXACT_COUNTS.length - 1;
  let bound = BigInt(EXACT_COUNTS[size]);
  while (bound <= BigInt(Number.MAX_SAFE_INTEGER)) bound *= BigInt(++size);
  return size;
})();

export const skewStandardTableaux: EpsilFamily = {
  head: "SkewStandardTableaux",
  paramCount: 1,
  kind: "blocks",
  params: [n],
  elementType: "tuple<list<integer>, list<integer>, list<integer>>",
  // Past 2^53 the table is out of the interpreter's reach, so the count declines, before any table is built.
  declinePastDoubles: "count",
  early: { pastDoubles: ([size]) => size >= PAST_DOUBLES },
  epsil: { tables, count, unrank, rank, valid },
};

// ─── the fast path: the same table in plain numbers ───

/** Past this size the fast path builds no table (its cost is a size or two past what `work` allows) and leaves the question to Epsil. */
const TABLE_LIMIT = 8;

interface Plan {
  readonly lam: readonly number[];
  readonly lens: readonly number[];
  readonly strides: readonly number[];
  readonly size: number;
}

function planOf(lam: readonly number[], mu: readonly number[]): Plan {
  const lens = lam.map((l, i) => l - (mu[i] ?? 0));
  const strides: number[] = [];
  let size = 1;
  for (const len of lens) {
    strides.push(size);
    size *= len + 1;
  }
  return { lam, lens, strides, size };
}

const digitOf = (plan: Plan, row: number, state: number): number =>
  Math.floor(state / plan.strides[row]) % (plan.lens[row] + 1);

/** Whether row `row` (0-based) can take the next cell in `state`: a cell is left, and the row above is a cell further on. */
function legalRow(plan: Plan, row: number, state: number): boolean {
  const d = digitOf(plan, row, state);
  if (d < 1) return false;
  return row === 0 || digitOf(plan, row - 1, state) <= plan.lam[row - 1] - plan.lam[row] + d - 1;
}

/** f[state]: the ways to place the cells left. */
function waysOf(plan: Plan): Float64Array {
  const f = new Float64Array(plan.size);
  f[0] = 1;
  for (let state = 1; state < plan.size; state++) {
    let sum = 0;
    for (let row = 0; row < plan.lens.length; row++)
      if (legalRow(plan, row, state)) sum += f[state - plan.strides[row]];
    f[state] = sum;
  }
  return f;
}

const CACHED = 4;
const cumulative = new Map<number, Float64Array>();

/** sums[s]: the tableaux of the shapes before the one at place s, for s = 0..the number of shapes; undefined
 *  past the table limit, which the fast path declines to Epsil (a rank outside the fiber throws instead). */
function cumulativeOf(size: number): Float64Array | undefined {
  if (size > TABLE_LIMIT) return undefined;
  let sums = cumulative.get(size);
  if (sums !== undefined) {
    cumulative.delete(size);
    cumulative.set(size, sums);
    return sums;
  }
  const shapes = skewShapeCount(size);
  sums = new Float64Array(shapes + 1);
  for (let s = 0; s < shapes; s++) {
    const [lam, mu] = skewShapeUnrank(size, s);
    const plan = planOf(lam, mu);
    sums[s + 1] = sums[s] + waysOf(plan)[plan.size - 1];
  }
  cumulative.set(size, sums);
  if (cumulative.size > CACHED) cumulative.delete(cumulative.keys().next().value!);
  return sums;
}

function countFast(size: number): number | undefined {
  if (size < 0) return 0;
  if (size === 0) return 1;
  const sums = cumulativeOf(size);
  return sums && sums[sums.length - 1];
}

function unrankFast(size: number, rank: number): [number[], number[], number[]] | undefined {
  if (size === 0) return [[], [], []];
  const sums = cumulativeOf(size);
  if (sums === undefined) return undefined;
  if (!(rank >= 0 && rank < sums[sums.length - 1]))
    throw new RangeError(`SkewStandardTableaux(${size}): rank out of range`);
  // The last shape whose tableaux start at or before the rank.
  let lo = 0;
  let hi = sums.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (sums[mid] <= rank) lo = mid;
    else hi = mid - 1;
  }
  const [lam, mu] = skewShapeUnrank(size, lo);
  const plan = planOf(lam, mu);
  const f = waysOf(plan);
  let left = rank - sums[lo];
  let state = plan.size - 1;
  const word: number[] = [];
  for (let t = 0; t < size; t++) {
    for (let row = 0; row < plan.lens.length; row++) {
      if (!legalRow(plan, row, state)) continue;
      const ways = f[state - plan.strides[row]];
      if (left < ways) {
        word.push(row);
        state -= plan.strides[row];
        break;
      }
      left -= ways;
    }
  }
  return [lam, mu, word];
}

function rankFast(element: [number[], number[], number[]], size: number): number | undefined {
  const [lam, mu, word] = element;
  if (size === 0) return 0;
  const sums = cumulativeOf(size);
  if (sums === undefined) return undefined;
  const plan = planOf(lam, mu);
  const f = waysOf(plan);
  let place = sums[skewShapeRank(size, lam, mu)];
  let state = plan.size - 1;
  for (const row of word) {
    for (let before = 0; before < row; before++)
      if (legalRow(plan, before, state)) place += f[state - plan.strides[before]];
    state -= plan.strides[row];
  }
  return place;
}

/** Whether `e` is [λ, μ, row word]: a reduced skew shape of n cells and a word that places 1..n, each in a row
 *  with a cell left and no cell above it still empty. */
export function IsSkewStandardTableauOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== 3) return false;
  const [lam, mu, word] = e as [number[], number[], number[]];
  if (!IsSkewPartitionOf([lam, mu], n)) return false;
  if (!Array.isArray(word) || word.length !== n) return false;
  const placed = Array.from({ length: lam.length }, () => 0);
  for (const r of word) {
    if (!Number.isInteger(r) || r < 0 || r >= lam.length) return false;
    const column = (mu[r] ?? 0) + placed[r] + 1;
    if (placed[r] >= lam[r] - (mu[r] ?? 0)) return false;
    if (r > 0 && column > (mu[r - 1] ?? 0) + placed[r - 1] && column <= lam[r - 1]) return false;
    placed[r]++;
  }
  return true;
}

const fast: FastKernel = {
  count: ([size]) => countFast(size),
  unrank: ([size], r) => unrankFast(size, r),
  rank: (e, [size]) => rankFast(e as [number[], number[], number[]], size),
  valid: (e, [size]) => IsSkewStandardTableauOf(e, size),
};

/** Over the shapes of n cells, the sum of states times rows: the cells of a shape's table, each read across the
 *  rows, for n = 0..14 (tests/skew-standard-tableaux.test.ts recomputes the first of them). */
export const TABLE_CELLS = [
  0, 2, 19, 148, 1067, 7302, 48388, 313012, 1989240, 12466992, 77270656, 474586380, 2892846088, 17520655944,
  105533129928,
];

/** The steps of the tables of every shape, which a call builds once for its size (a call then reads one
 *  shape's, far less): twice the cells, a step costing about what the other families' do (some 4 million a
 *  second compiled). Past the list each size takes at most 7 times the last, the ratio falling still (6.0 at n = 14). */
const tableSteps = (size: number): bigint =>
  size < 0
    ? 0n
    : size < TABLE_CELLS.length
      ? 2n * BigInt(TABLE_CELLS[size])
      : 2n * BigInt(TABLE_CELLS[TABLE_CELLS.length - 1]) * 7n ** BigInt(size - TABLE_CELLS.length + 1);

const declared: Declared = {
  carrier: "SkewTableau",
  params: [{ name: "size", role: "axis", min: 0 }],
  cost: { count: "enumerative", unrank: "enumerative", rank: "enumerative", valid: "polynomial" },
  work: ([size]) => tableSteps(size),
  walks: true,
};

export const entries: EpsilFamily[] = [{ ...skewStandardTableaux, fast, declared }];
