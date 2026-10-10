// SemistandardTableaux, GelfandTsetlin, AlternatingSignMatrices, SkewStandardTableaux,
// PlanePartitions and BoxedPlanePartitions split out of collections/src/families/tableaux-plane.ts
// (which mixed every area) per
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5 -- every family in that file carrying a `declared.carrier` (all six do; none has a
// top-level `carrier` yet). ShiftedStandardTableaux joined them (wire-carriers lane A-92): it
// now carries the new "ShiftedStandardTableau" carrier (its element already is one, kind
// "blocks" = rows). StandardTableauPairs now carries "StandardTableauPair" too, wired via
// `carrierElements` (declare.ts) -- see ./standard-tableau-pairs.ts.
// `normRank`, `cmpNumArrays`, `cmpRowsShapeThenEntries`, `keyOf`, `indexedFamily`, `axis`,
// `enumerated` are small local helpers duplicated from the source file (mirrors the permutations
// pilot's `ints`); `factorialBig` is used ONLY by SkewStandardTableaux and moved outright.
//
// Stays TS here, each as an enumeration cached per params (a larger size is bounded by `work`):
// - SkewStandardTableaux: a shape's fillings are counted over its order ideals, up to 2^n of them.
// - PlanePartitions: the layers left below a row depend on the whole row above, so a table over rows
//   and sums is far larger than the family (a row-by-row DP does 100x its count's work at n = 28).
// SkewPartitions and BoxedPlanePartitions are defined in Epsil (./boxed-plane-partitions.ts).
import type { EpsilFamily, FastKernel } from "../../../collections/src/families/epsil.ts";
import type { Cost, Declared, NumberKernel, Param } from "../../../collections/src/families/types.ts";
import {
  PartitionsQ,
  DistinctPartitionUnrank,
  DistinctPartitionRank,
} from "../../../collections/src/families/kernels-extra.ts";
import { IsSkewPartitionOf, skewShapeCount, skewShapeUnrank } from "../../../partitions/src/families/skew-shapes.ts";
import { alternatingSignMatrices } from "./alternating-sign-matrices.ts";
import { boxedPlanePartitions } from "./boxed-plane-partitions.ts";
import { gelfandTsetlin } from "./gelfand-tsetlin.ts";
import { semistandardTableaux } from "./semistandard-tableaux.ts";
import { shiftedStandardTableaux } from "./standard-tableaux.ts";

const normRank = (r: number, total: number): number => (total > 0 ? ((Math.trunc(r) % total) + total) % total : 0);

const cmpNumArrays = (a: readonly number[], b: readonly number[]): number => {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
};

// Canonical order for ragged number[][] element caches: shape (row lengths) first, then flattened
// entries — matches every archived SQL floor's own `ORDER BY shape, entries` / `ORDER BY flat`.
const cmpRowsShapeThenEntries = (a: readonly number[][], b: readonly number[][]): number => {
  const s = cmpNumArrays(
    a.map((r) => r.length),
    b.map((r) => r.length),
  );
  if (s !== 0) return s;
  return cmpNumArrays(a.flat(), b.flat());
};

const keyOf = (rows: unknown): string => JSON.stringify(rows);

/** A memoized "enumerate every element, cache it, index into it" table -- see the source file's
 *  own doc comment for why this is correct by construction. */
function indexedFamily<E>(generate: (key: string) => E[]) {
  const cache = new Map<string, E[]>();
  const elementsOf = (key: string): E[] => {
    let v = cache.get(key);
    if (!v) {
      v = generate(key);
      cache.set(key, v);
    }
    return v;
  };
  return {
    count: (key: string) => elementsOf(key).length,
    unrank: (key: string, rank: number) => elementsOf(key)[normRank(rank, elementsOf(key).length)],
    rank: (key: string, element: unknown) => elementsOf(key).findIndex((e) => keyOf(e) === keyOf(element)),
  };
}

const axis = (name: string): Param => ({ name, role: "axis", min: 0 });
/** Every family here enumerates to unrank and rank (indexedFamily); `count` is its own. */
const enumerated = (count: Cost): Declared["cost"] => ({
  count,
  unrank: "enumerative",
  rank: "enumerative",
  valid: "polynomial",
});

// SemistandardTableaux, GelfandTsetlin and AlternatingSignMatrices are defined in Epsil
// (./semistandard-tableaux.ts, ./gelfand-tsetlin.ts, ./alternating-sign-matrices.ts).

const binomialBig = (n: number, k: number): bigint => {
  let c = 1n;
  for (let i = 1; i <= k; i++) c = (c * BigInt(n - k + i)) / BigInt(i);
  return c;
};

const factorialBig = (n: number): bigint => {
  let f = 1n;
  for (let i = 2n; i <= BigInt(n); i++) f *= i;
  return f;
};

// Stays TS: its shapes are SkewPartitions' (unranked, in that order), and a shape's fillings are listed
// by their row words, which a DP can count only over the order ideals of the shape, as many as 2^n:
// that would take Epsil from n = 5 to n = 9 for a few hundred lines, so the enumeration stays.
// ═══ SkewStandardTableaux(size) — standard tableaux on reduced skew shapes λ/μ, summed over every shape ═══
// No closed form. Element: `[lam, mu, rowWord]` — rowWord[i] = 0-based row of entry i+1 (placement order),
// same convention as shifted below. A cell (row r, running count c) is legal to place next iff row r isn't
// full and the cell directly above it (row r−1, same absolute column) is either outside λ/μ's row r−1 or
// already filled — the general column-strictness check (μ=0 recovers plain SYT; the shifted family below
// is its μ_r=r case).
function skewFillingsOfShape(lam: readonly number[], mu: readonly number[]): number[][] {
  const l = lam.length;
  const n = lam.reduce((a, b) => a + b, 0) - mu.reduce((a, b) => a + b, 0);
  const counts = Array.from({ length: l }, () => 0);
  const w: number[] = [];
  const results: number[][] = [];
  function legal(r: number): boolean {
    const mr = mu[r] ?? 0;
    if (counts[r] >= lam[r] - mr) return false;
    if (r === 0) return true;
    const newcol = mr + counts[r] + 1;
    const aboveMu = mu[r - 1] ?? 0;
    const aboveLam = lam[r - 1];
    if (newcol <= aboveMu || newcol > aboveLam) return true;
    return counts[r - 1] >= newcol - aboveMu;
  }
  function backtrack(): void {
    if (w.length === n) {
      results.push(w.slice());
      return;
    }
    for (let r = 0; r < l; r++) {
      if (legal(r)) {
        counts[r]++;
        w.push(r);
        backtrack();
        w.pop();
        counts[r]--;
      }
    }
  }
  backtrack();
  results.sort(cmpNumArrays);
  return results;
}
const skewStd = indexedFamily<[number[], number[], number[]]>((key) => {
  const n = Number(key);
  const out: [number[], number[], number[]][] = [];
  for (let r = 0; r < skewShapeCount(n); r++) {
    const [lam, mu] = skewShapeUnrank(n, r);
    for (const w of skewFillingsOfShape(lam, mu)) out.push([lam, mu, w]);
  }
  return out;
});
export function SkewStandardTableauxUnrank(n: number, rank: number): [number[], number[], number[]] {
  return skewStd.unrank(String(n), rank);
}
export function SkewStandardTableauxRank(e: [number[], number[], number[]], n: number): number {
  return skewStd.rank(String(n), e);
}
export function IsSkewStandardTableauOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== 3) return false;
  const [lam, mu, w] = e as [number[], number[], number[]];
  if (!IsSkewPartitionOf([lam, mu], n)) return false;
  if (!Array.isArray(w) || w.length !== n) return false;
  const l = lam.length;
  if (l === 0) return n === 0;
  const counts = Array.from({ length: l }, () => 0);
  for (const r of w) {
    if (!Number.isInteger(r) || r < 0 || r >= l) return false;
    const mr = mu[r] ?? 0;
    if (counts[r] >= lam[r] - mr) return false;
    if (r > 0) {
      const newcol = mr + counts[r] + 1;
      const aboveMu = mu[r - 1] ?? 0;
      const aboveLam = lam[r - 1];
      if (!(newcol <= aboveMu || newcol > aboveLam) && counts[r - 1] < newcol - aboveMu) return false;
    }
    counts[r]++;
  }
  return true;
}

// PlanePartitions(n): stays TS (see the header). Ordered by shape then entries.
function partitionsUnder(ceiling: readonly number[], maxSum: number): number[][] {
  const results: number[][] = [];
  function rec(idx: number, cur: number[], sum: number): void {
    results.push(cur.slice());
    if (idx === ceiling.length) return;
    const prevVal = idx > 0 ? cur[idx - 1] : Number.POSITIVE_INFINITY;
    const hi = Math.min(prevVal, ceiling[idx]);
    for (let v = 1; v <= hi; v++) {
      if (sum + v > maxSum) break;
      cur.push(v);
      rec(idx + 1, cur, sum + v);
      cur.pop();
    }
  }
  rec(0, [], 0);
  return results;
}
const planePart = indexedFamily<number[][]>((key) => {
  const n = Number(key);
  if (n === 0) return [[]];
  const results: number[][][] = [];
  const rows: number[][] = [];
  function backtrack(ceiling: readonly number[], remaining: number): void {
    if (remaining === 0) {
      results.push(rows.map((r) => r.slice()));
      return;
    }
    for (const nr of partitionsUnder(ceiling, remaining)) {
      if (nr.length === 0) continue;
      const cells = nr.reduce((a, b) => a + b, 0);
      if (cells === 0) continue;
      rows.push(nr);
      backtrack(nr, remaining - cells);
      rows.pop();
    }
  }
  backtrack(
    Array.from({ length: n }, () => n),
    n,
  );
  results.sort(cmpRowsShapeThenEntries);
  return results;
});
/** A000219 without enumerating: MacMahon's Π (1 − x^k)^(−k), through the Euler-transform
 *  recurrence n·PL(n) = Σ_{k=1..n} σ₂(k)·PL(n−k), exact in bigint. */
export function PlanePartitionsCount(n: number): number {
  if (n < 0) return 0;
  const sigma2 = (k: number): bigint => {
    let s = 0n;
    for (let d = 1; d <= k; d++) if (k % d === 0) s += BigInt(d * d);
    return s;
  };
  const pl: bigint[] = [1n];
  for (let m = 1; m <= n; m++) {
    let acc = 0n;
    for (let k = 1; k <= m; k++) acc += sigma2(k) * (pl[m - k] as bigint);
    pl.push(acc / BigInt(m));
  }
  return Number(pl[n]);
}
export function PlanePartitionsUnrank(n: number, rank: number): number[][] {
  return planePart.unrank(String(n), rank);
}
export function PlanePartitionsRank(e: number[][], n: number): number {
  return planePart.rank(String(n), e);
}
export function IsPlanePartitionOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e)) return false;
  const rows = e as number[][];
  let total = 0;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length === 0) return false;
    if (r > 0 && rows[r - 1].length < row.length) return false;
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (!Number.isInteger(v) || v < 1) return false;
      if (c > 0 && row[c - 1] < v) return false;
      if (r > 0 && rows[r - 1][c] < v) return false;
      total += v;
    }
  }
  return total === n;
}

export const entriesBeforeSkewStandardTableaux: (NumberKernel | EpsilFamily)[] = [
  {
    ...semistandardTableaux,
    declared: {
      carrier: "SemistandardTableau",
      params: [axis("size"), axis("max_entry")],
      // Unrank and rank tabulate the rows of each level of a shape: the two levels of two equal
      // rows are the largest, the rows C(m + k − 1, m) of them with m = n/2 (rounded up).
      cost: { count: "polynomial", unrank: "enumerative", rank: "enumerative", valid: "polynomial" },
      work: ([n, k]) => binomialBig(Math.ceil(n / 2) + k - 1, Math.ceil(n / 2)) ** 2n,
      walks: true,
    },
  },
  {
    ...gelfandTsetlin,
    declared: {
      carrier: "GelfandTsetlinPattern",
      params: [axis("n"), axis("k")],
      // Unrank and rank walk the rows that fit under each row of the triangle, the top row's the
      // multisets of n from 0..k: at most n of those lists, not the triangles themselves.
      cost: { count: "closed", unrank: "enumerative", rank: "enumerative", valid: "polynomial" },
      work: ([n, k]) => BigInt(n) * binomialBig(n + k, n),
      walks: true,
    },
  },
  {
    ...alternatingSignMatrices,
    declared: {
      carrier: "AlternatingSignMatrix",
      params: [axis("size")],
      // Unrank and rank read a table over the subsets of the columns, 4^n steps to build.
      cost: { count: "closed", unrank: "enumerative", rank: "enumerative", valid: "polynomial" },
      work: ([n]) => 4n ** BigInt(n),
      walks: true,
    },
  },
];

export const skewStandardTableauxEntries: NumberKernel[] = [
  {
    head: "SkewStandardTableaux",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => skewStd.count(String(n)),
    unrank: ([n], r) => SkewStandardTableauxUnrank(n, r),
    valid: (e, [n]) => IsSkewStandardTableauOf(e, n),
    rank: (e, [n]) => SkewStandardTableauxRank(e as [number[], number[], number[]], n),
    declared: {
      carrier: "SkewTableau",
      params: [axis("size")],
      cost: enumerated("enumerative"),
      work: ([n]) => factorialBig(n) * 4n ** BigInt(n),
    },
  },
];

// ═══ ShiftedStandardTableaux(size) — standard tableaux on shifted diagrams of STRICT partitions ═══
// Row i (0-indexed) occupies columns i..i+shape[i]-1, so row i's k-th cell shares a column with row
// (i-1)'s (k+1)-th cell. Same recursive-corner-removal scheme as StandardTableaux in tableaux-trees.ts
// (value n always sits at a removable corner), except the corner condition needs the shape to stay
// STRICT after removal: shape[i] > shape[i+1] + 1 (a gap of at least 2), not just shape[i] > shape[i+1].
// This recursive count is exact (not a closed form, but the same identity the shifted hook-length
// formula computes) — cross-checked against the archived checkout's hand-verified anchors 1,1,1,2,3,6,12.
function shiftedRemovableCorners(shape: readonly number[]): { row: number; newShape: number[] }[] {
  const corners: { row: number; newShape: number[] }[] = [];
  for (let i = 0; i < shape.length; i++) {
    if (shape[i] > 0 && (i === shape.length - 1 || shape[i] > shape[i + 1] + 1)) {
      const ns = shape.slice();
      ns[i] -= 1;
      if (ns[i] === 0) ns.pop();
      corners.push({ row: i, newShape: ns });
    }
  }
  return corners;
}
const shiftedSytMemo = new Map<string, number>();
function shiftedSytCountForShape(shape: readonly number[]): number {
  const n = shape.reduce((a, b) => a + b, 0);
  if (n === 0) return 1;
  const key = shape.join(",");
  const cached = shiftedSytMemo.get(key);
  if (cached !== undefined) return cached;
  let total = 0;
  for (const c of shiftedRemovableCorners(shape)) total += shiftedSytCountForShape(c.newShape);
  shiftedSytMemo.set(key, total);
  return total;
}
function shiftedSytUnrankShape(shape: readonly number[], rank: number): number[][] {
  const n = shape.reduce((a, b) => a + b, 0);
  if (n === 0) return [];
  let r = rank;
  for (const c of shiftedRemovableCorners(shape)) {
    const w = shiftedSytCountForShape(c.newShape);
    if (r < w) {
      const rows = shiftedSytUnrankShape(c.newShape, r).map((row) => row.slice());
      while (rows.length <= c.row) rows.push([]);
      rows[c.row] = [...rows[c.row], n];
      return rows;
    }
    r -= w;
  }
  throw new Error(`ShiftedStandardTableaux: rank out of range for shape ${shape.join(",")}`);
}
function shiftedSytRankShape(rows: readonly number[][]): number {
  const shape = rows.map((row) => row.length);
  const n = shape.reduce((a, b) => a + b, 0);
  if (n === 0) return 0;
  const targetRow = rows.findIndex((row) => row[row.length - 1] === n);
  let base = 0;
  for (const c of shiftedRemovableCorners(shape)) {
    if (c.row === targetRow) {
      const sub = rows.map((row) => row.slice());
      sub[c.row].pop();
      while (sub.length && sub[sub.length - 1].length === 0) sub.pop();
      return base + shiftedSytRankShape(sub);
    }
    base += shiftedSytCountForShape(c.newShape);
  }
  throw new Error("ShiftedStandardTableaux: value n not at a removable corner");
}
export function ShiftedStandardTableauxCount(n: number): number {
  let total = 0;
  for (let idx = 0; idx < PartitionsQ(n); idx++) total += shiftedSytCountForShape(DistinctPartitionUnrank(n, idx));
  return total;
}
export function ShiftedStandardTableauxUnrank(n: number, rank: number): number[][] {
  const total = ShiftedStandardTableauxCount(n);
  let r = normRank(rank, total);
  for (let idx = 0; idx < PartitionsQ(n); idx++) {
    const shape = DistinctPartitionUnrank(n, idx);
    const w = shiftedSytCountForShape(shape);
    if (r < w) return shiftedSytUnrankShape(shape, r);
    r -= w;
  }
  throw new Error("ShiftedStandardTableaux: rank out of range");
}
export function ShiftedStandardTableauxRank(rows: number[][], n: number): number {
  const shape = rows.map((row) => row.length);
  const idx = DistinctPartitionRank(shape, n);
  let base = 0;
  for (let i = 0; i < idx; i++) base += shiftedSytCountForShape(DistinctPartitionUnrank(n, i));
  return base + shiftedSytRankShape(rows);
}
export function IsShiftedStandardTableauOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e)) return false;
  const rows = e as number[][];
  const seen = Array.from({ length: n + 1 }, () => false);
  let total = 0;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length === 0) return false;
    if (r > 0 && rows[r - 1].length <= row.length) return false;
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (!Number.isInteger(v) || v < 1 || v > n || seen[v]) return false;
      seen[v] = true;
      total++;
      if (c > 0 && row[c - 1] >= v) return false;
      if (r > 0 && c + 1 < rows[r - 1].length && rows[r - 1][c + 1] >= v) return false;
    }
  }
  return total === n;
}

// Defined in Epsil (./standard-tableaux.ts); the kernel above is its fast path, in the same order.
export const shiftedStandardTableauxFast: FastKernel = {
  count: ([n]) => ShiftedStandardTableauxCount(n),
  unrank: ([n], r) => ShiftedStandardTableauxUnrank(n, r),
  rank: (e, [n]) => ShiftedStandardTableauxRank(e as number[][], n),
  valid: (e, [n]) => IsShiftedStandardTableauOf(e, n),
};

export const shiftedStandardTableauxEntries: EpsilFamily[] = [
  { ...shiftedStandardTableaux, fast: shiftedStandardTableauxFast },
];

/**
 * The steps of a call on a box: the table of what goes below each row tests every row against the rows no
 * longer than it, each test as long as the shorter row, once per row of the box (a layers); the shape
 * and entries passes cost no more, so a call (the table built too) is twice it. A thin tall box has many
 * rows, N = C(b + c, b) of them, though few partitions.
 */
function boxedWalkSteps(a: number, b: number, c: number): bigint {
  if (a < 1 || b < 1 || c < 1) return 0n;
  let rows = 1n; // rows of length l: C(l + c − 1, l)
  let tested = 0n; // Σ over the rows σ of length ≤ l of len(σ)
  let table = 0n;
  for (let l = 1; l <= b; l++) {
    rows = (rows * BigInt(l + c - 1)) / BigInt(l);
    tested += rows * BigInt(l);
    table += rows * tested;
  }
  return 2n * BigInt(a) * table;
}

export const planePartitionsEntries: (NumberKernel | EpsilFamily)[] = [
  {
    head: "PlanePartitions",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => PlanePartitionsCount(n),
    unrank: ([n], r) => PlanePartitionsUnrank(n, r),
    valid: (e, [n]) => IsPlanePartitionOf(e, n),
    rank: (e, [n]) => PlanePartitionsRank(e as number[][], n),
    declared: {
      carrier: "PlanePartition",
      params: [axis("size")],
      cost: enumerated("polynomial"),
      work: ([n]) => BigInt(PlanePartitionsCount(n)),
    },
  },
  {
    ...boxedPlanePartitions,
    declared: {
      carrier: "PlanePartition",
      params: [axis("a"), axis("b"), axis("c")],
      cost: { count: "closed", unrank: "enumerative", rank: "enumerative", valid: "polynomial" },
      work: ([a, b, c]) => boxedWalkSteps(a, b, c),
      walks: true,
    },
  },
];
