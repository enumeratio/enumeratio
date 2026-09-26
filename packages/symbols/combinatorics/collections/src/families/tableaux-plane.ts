// Tableaux and plane-partition heads catalogued (packages/catalog/src/catalog-data.ts) but never wired
// to a kernel: SemistandardTableaux, GelfandTsetlin, AlternatingSignMatrices, SkewPartitions,
// SkewStandardTableaux, ShiftedStandardTableaux, StandardTableauPairs, PlanePartitions, BoxedPlanePartitions.
//
// Every closed-form count below was cross-checked, before landing, against the archived enumeratio
// checkout's SQL packs (packages/data/packs/{tableaux,partitions-plus}/*.sql in the enumeratio/archive
// repo) — those files carry hand-verified anchor sequences this file's tests re-derive independently.
// Three families (SkewPartitions, SkewStandardTableaux, PlanePartitions) have NO known closed form, same
// as their SQL ancestors say outright ("counted from the floor") — count() there is the cached
// enumeration's length, not a formula.
//
// Element representation follows tableaux-trees.ts's StandardTableaux convention (kind "blocks" = rows,
// number[][]) wherever a family's carrier is naturally row-shaped. Composite carriers (skew shape + a
// filling, or a pair of tableaux) are packed as extra "rows" in the same number[][] — e.g. SkewPartitions
// is `[lam, mu]`, SkewStandardTableaux is `[lam, mu, rowWord]` — except StandardTableauPairs, whose two
// same-shape tableaux don't share a row count with anything else and so use kind "nested" as `[P, Q]`.
import type { Cost, Declared, NumberKernel, Param } from "./types.ts";
import { Factorial, PermutationRank, PermutationUnrank } from "./kernels.ts";
import { PartitionsP, IntegerPartitionUnrank } from "./kernels-combinatorics.ts";
import { PartitionsQ, DistinctPartitionUnrank, DistinctPartitionRank } from "./kernels-extra.ts";
import { IsStandardTableauOf } from "./tableaux-trees.ts";

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

/** A memoized "enumerate every element, cache it, index into it" table — the shared engine behind
 *  every family below whose unrank/rank isn't a closed-form bijection. Correct by construction: count,
 *  unrank and rank all read the SAME cached array, so round-tripping is automatic once `generate` is right. */
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

// ═══ SemistandardTableaux(size, max_entry) — SSYT over every shape λ⊢size, entries in 1..max_entry ═══
// Count: the hook-content formula s_λ(1^k) = Π (k + col − row) / hook(row,col), summed over shapes —
// exact and closed-form (a cell needing col−row ≤ −k forces a zero factor, so shapes needing more than k
// rows correctly contribute 0 without a separate guard). Unrank/rank: enumerate-then-index per (n,k) —
// no simple closed-form unrank for a sum-over-shapes family; sizes stay small enough that full
// enumeration (cross-checked against the hook-content count in tests) is cheap and safe.
function conjugateOf(shape: number[]): number[] {
  const width = shape[0] ?? 0;
  return Array.from({ length: width }, (_, c) => shape.filter((row) => row > c).length);
}
function hookContentCount(shape: number[], k: number): number {
  const conj = conjugateOf(shape);
  let num = 1,
    den = 1;
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r]; c++) {
      num *= k + c - r;
      den *= shape[r] - c + (conj[c] - r) - 1;
    }
  return Math.round(num / den);
}
function ssytFillingsOfShape(shape: number[], k: number): number[][][] {
  const results: number[][][] = [];
  const grid: number[][] = shape.map((len) => Array.from({ length: len }, () => 0));
  const nRows = shape.length;
  function cell(r: number, c: number): void {
    if (r === nRows) {
      results.push(grid.map((row) => row.slice()));
      return;
    }
    if (c === shape[r]) {
      cell(r + 1, 0);
      return;
    }
    const leftBound = c > 0 ? grid[r][c - 1] : 1;
    const aboveBound = r > 0 && c < shape[r - 1] ? grid[r - 1][c] + 1 : 1;
    const lo = Math.max(leftBound, aboveBound);
    for (let v = lo; v <= k; v++) {
      grid[r][c] = v;
      cell(r, c + 1);
    }
  }
  cell(0, 0);
  return results;
}
export function SemistandardTableauxCount(n: number, k: number): number {
  let total = 0;
  for (let idx = 0; idx < PartitionsP(n); idx++) total += hookContentCount(IntegerPartitionUnrank(n, idx), k);
  return total;
}
const ssyt = indexedFamily<number[][]>((key) => {
  const [n, k] = key.split("|").map(Number);
  const out: number[][][] = [];
  for (let idx = 0; idx < PartitionsP(n); idx++) out.push(...ssytFillingsOfShape(IntegerPartitionUnrank(n, idx), k));
  out.sort(cmpRowsShapeThenEntries);
  return out;
});
export function SemistandardTableauxUnrank(n: number, k: number, rank: number): number[][] {
  return ssyt.unrank(`${n}|${k}`, rank);
}
export function SemistandardTableauxRank(e: number[][], n: number, k: number): number {
  return ssyt.rank(`${n}|${k}`, e);
}
export function IsSemistandardTableauOf(e: unknown, n: number, k: number): boolean {
  if (!Array.isArray(e)) return false;
  const rows = e as number[][];
  let total = 0;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length === 0) return false;
    if (r > 0 && rows[r - 1].length < row.length) return false;
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (!Number.isInteger(v) || v < 1 || v > k) return false;
      if (c > 0 && row[c - 1] > v) return false;
      if (r > 0 && rows[r - 1][c] >= v) return false;
      total++;
    }
  }
  return total === n;
}

// ═══ GelfandTsetlin(n, k) — triangular interlacing arrays, n rows, entries in 0..k ═══
// Count: Π_{1≤i≤j≤n} (k+i+j−1)/(i+j−1) — the dimension formula (sum of hook-content over every top-row
// shape fitting the n×k box), exact and closed-form. Element: rows top (length n) to bottom (length 1).
export function GelfandTsetlinCount(n: number, k: number): number {
  let num = 1,
    den = 1;
  for (let i = 1; i <= n; i++)
    for (let j = i; j <= n; j++) {
      num *= k + i + j - 1;
      den *= i + j - 1;
    }
  return Math.round(num / den);
}
function gtRowsBelow(above: number[] | null, len: number, k: number): number[][] {
  const out: number[][] = [];
  function rec(idx: number, cur: number[]): void {
    if (idx === len) {
      out.push(cur.slice());
      return;
    }
    const hi = above ? Math.min(above[idx], idx > 0 ? cur[idx - 1] : above[idx]) : idx > 0 ? cur[idx - 1] : k;
    const lo = above ? above[idx + 1] : 0;
    for (let v = lo; v <= hi; v++) {
      cur.push(v);
      rec(idx + 1, cur);
      cur.pop();
    }
  }
  rec(0, []);
  return out;
}
const gt = indexedFamily<number[][]>((key) => {
  const [n, k] = key.split("|").map(Number);
  const results: number[][][] = [];
  const rows: number[][] = [];
  function backtrack(above: number[] | null, len: number): void {
    if (len === 0) {
      results.push(rows.map((r) => r.slice()));
      return;
    }
    for (const row of gtRowsBelow(above, len, k)) {
      rows.push(row);
      backtrack(row, len - 1);
      rows.pop();
    }
  }
  backtrack(null, n);
  return results;
});
export function GelfandTsetlinUnrank(n: number, k: number, rank: number): number[][] {
  return gt.unrank(`${n}|${k}`, rank);
}
export function GelfandTsetlinRank(e: number[][], n: number, k: number): number {
  return gt.rank(`${n}|${k}`, e);
}
export function IsGelfandTsetlinOf(e: unknown, n: number, k: number): boolean {
  if (!Array.isArray(e)) return false;
  const rows = e as number[][];
  if (rows.length !== n) return false;
  let above: number[] | null = null;
  for (let i = 0; i < n; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length !== n - i) return false;
    for (let j = 0; j < row.length; j++) {
      const v = row[j];
      if (!Number.isInteger(v) || v < 0 || v > k) return false;
      if (j > 0 && v > row[j - 1]) return false;
      if (above && !(above[j] >= v && v >= above[j + 1])) return false;
    }
    above = row;
  }
  return true;
}

// ═══ AlternatingSignMatrices(size) — n×n, entries {-1,0,1}, row/col partial sums and totals in {0,1}/1 ═══
// Count: A(n) = Π_{j<n} (3j+1)!/(n+j)! — the ASM numbers (A005130), exact and closed-form.
export function AlternatingSignMatrixCount(n: number): number {
  let num = 1,
    den = 1;
  for (let j = 0; j < n; j++) {
    num *= Factorial(3 * j + 1);
    den *= Factorial(n + j);
  }
  return Math.round(num / den);
}
const asm = indexedFamily<number[][]>((key) => {
  const n = Number(key);
  const results: number[][][] = [];
  const rows: number[][] = [];
  const colPartial = Array.from({ length: n }, () => 0);
  function backtrack(): void {
    if (rows.length === n) {
      results.push(rows.map((r) => r.slice()));
      return;
    }
    const row: number[] = [];
    const build = (c: number, rowPrefix: number): void => {
      if (c === n) {
        if (rowPrefix === 1) {
          rows.push(row.slice());
          backtrack();
          rows.pop();
        }
        return;
      }
      for (const v of [-1, 0, 1]) {
        const nc = colPartial[c] + v;
        const nr = rowPrefix + v;
        if (nc < 0 || nc > 1 || nr < 0 || nr > 1) continue;
        colPartial[c] = nc;
        row.push(v);
        build(c + 1, nr);
        row.pop();
        colPartial[c] = nc - v;
      }
    };
    build(0, 0);
  }
  backtrack();
  return results;
});
export function AlternatingSignMatrixUnrank(n: number, rank: number): number[][] {
  return asm.unrank(String(n), rank);
}
export function AlternatingSignMatrixRank(e: number[][], n: number): number {
  return asm.rank(String(n), e);
}
export function IsAlternatingSignMatrixOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== n) return false;
  const rows = e as number[][];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== n) return false;
    let pref = 0;
    for (const v of row) {
      if (v !== -1 && v !== 0 && v !== 1) return false;
      pref += v;
      if (pref < 0 || pref > 1) return false;
    }
    if (pref !== 1) return false;
  }
  for (let j = 0; j < n; j++) {
    let pref = 0;
    for (let i = 0; i < n; i++) {
      pref += rows[i][j];
      if (pref < 0 || pref > 1) return false;
    }
    if (pref !== 1) return false;
  }
  return true;
}

// ═══ SkewPartitions(size) — REDUCED skew shapes λ/μ with `size` cells (Sage SkewPartitions(n)) ═══
// "Reduced" = no empty row (μ_i < λ_i) and no empty column (every column 1..λ_1 covered by some row's
// [μ_i+1, λ_i]). No closed form (ported from the archived checkout's own comment) — count is the cached
// enumeration's length. Element: `[lam, mu]`.
function isColumnReduced(aStarts: readonly number[], bEnds: readonly number[]): boolean {
  const maxCol = bEnds[0] ?? 0;
  for (let col = 1; col <= maxCol; col++) {
    let covered = false;
    for (let i = 0; i < bEnds.length; i++)
      if (aStarts[i] <= col && col <= bEnds[i]) {
        covered = true;
        break;
      }
    if (!covered) return false;
  }
  return true;
}
const skewPart = indexedFamily<[number[], number[]]>((key) => {
  const n = Number(key);
  const results: [number[], number[]][] = [];
  const aStarts: number[] = [];
  const bEnds: number[] = [];
  function backtrack(cells: number): void {
    if (cells === n) {
      if (isColumnReduced(aStarts, bEnds)) {
        const lam = bEnds.slice();
        const mu = aStarts.map((a) => a - 1).filter((x) => x > 0);
        results.push([lam, mu]);
      }
      return;
    }
    const prevB = bEnds.length ? bEnds[bEnds.length - 1] : n;
    for (let b = 1; b <= prevB; b++) {
      const prevA = aStarts.length ? aStarts[aStarts.length - 1] : b;
      for (let a = 1; a <= Math.min(b, prevA); a++) {
        const rowCells = b - a + 1;
        if (cells + rowCells > n) continue;
        aStarts.push(a);
        bEnds.push(b);
        backtrack(cells + rowCells);
        aStarts.pop();
        bEnds.pop();
      }
    }
  }
  backtrack(0);
  results.sort((x, y) => cmpNumArrays(x[0], y[0]) || cmpNumArrays(x[1], y[1]));
  return results;
});
export function SkewPartitionsUnrank(n: number, rank: number): [number[], number[]] {
  return skewPart.unrank(String(n), rank);
}
export function SkewPartitionsRank(e: [number[], number[]], n: number): number {
  return skewPart.rank(String(n), e);
}
export function IsSkewPartitionOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== 2) return false;
  const [lam, mu] = e as [number[], number[]];
  if (!Array.isArray(lam) || !Array.isArray(mu) || mu.length > lam.length) return false;
  for (let i = 0; i < lam.length; i++) {
    if (!Number.isInteger(lam[i]) || lam[i] < 1) return false;
    if (i > 0 && lam[i] > lam[i - 1]) return false;
    const m = mu[i] ?? 0;
    if (!Number.isInteger(m) || m < 0) return false;
    if (i > 0 && m > (mu[i - 1] ?? 0)) return false;
    if (m >= lam[i]) return false;
  }
  const totalLam = lam.reduce((a, b) => a + b, 0);
  const totalMu = mu.reduce((a, b) => a + b, 0);
  if (totalLam - totalMu !== n) return false;
  const aStarts = lam.map((_, i) => (mu[i] ?? 0) + 1);
  return isColumnReduced(aStarts, lam);
}

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
  const shapeList: [number[], number[]][] = [];
  for (let r = 0; r < skewPart.count(String(n)); r++) shapeList.push(skewPart.unrank(String(n), r));
  for (const [lam, mu] of shapeList) for (const w of skewFillingsOfShape(lam, mu)) out.push([lam, mu, w]);
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

// ═══ StandardTableauPairs(size) — the RSK codomain: pairs (P,Q) of same-shape SYT, n cells ═══
// RSK is a bijection permutations(n) ↔ {(P,Q)}, so count = n! (exact, closed-form) and unrank/rank ride
// straight on PermutationUnrank/Rank (kernels.ts) through forward/inverse RSK insertion. Element: `[P, Q]`
// (kind "nested" — the two same-shape tableaux don't pack into one ragged number[][] the way the other
// composite carriers above do).
function rsk(perm: readonly number[]): { P: number[][]; Q: number[][] } {
  const P: number[][] = [];
  const Q: number[][] = [];
  for (let k = 0; k < perm.length; k++) {
    let x = perm[k];
    let r = 0;
    for (;;) {
      if (r === P.length) {
        P.push([x]);
        Q.push([k + 1]);
        break;
      }
      const row = P[r];
      const pos = row.findIndex((v) => v > x);
      if (pos === -1) {
        row.push(x);
        Q[r].push(k + 1);
        break;
      }
      const bumped = row[pos];
      row[pos] = x;
      x = bumped;
      r++;
    }
  }
  return { P, Q };
}
function rskInverse(Pin: readonly number[][], Qin: readonly number[][]): number[] {
  const P = Pin.map((row) => row.slice());
  const Q = Qin.map((row) => row.slice());
  const n = P.reduce((a, row) => a + row.length, 0);
  const perm: number[] = Array.from({ length: n }, () => 0);
  for (let k = n; k >= 1; k--) {
    let r = -1;
    for (let i = 0; i < Q.length; i++) {
      if (Q[i].length && Q[i][Q[i].length - 1] === k) {
        r = i;
        break;
      }
    }
    Q[r].pop();
    let x = P[r].pop() as number;
    for (let i = r - 1; i >= 0; i--) {
      const row = P[i];
      let pos = -1;
      for (let j = row.length - 1; j >= 0; j--)
        if (row[j] < x) {
          pos = j;
          break;
        }
      const bumped = row[pos];
      row[pos] = x;
      x = bumped;
    }
    perm[k - 1] = x;
  }
  return perm;
}
export function StandardTableauPairsUnrank(n: number, rank: number): [number[][], number[][]] {
  const total = Factorial(n);
  const r = normRank(rank, total);
  const { P, Q } = rsk(PermutationUnrank(n, r));
  return [P, Q];
}
export function StandardTableauPairsRank(pair: [number[][], number[][]], n: number): number {
  void n;
  return PermutationRank(rskInverse(pair[0], pair[1]));
}
export function IsStandardTableauPairOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== 2) return false;
  const [P, Q] = e as [number[][], number[][]];
  if (!IsStandardTableauOf(P, n) || !IsStandardTableauOf(Q, n)) return false;
  const shapeOf = (t: number[][]) => t.map((row) => row.length).join(",");
  return shapeOf(P) === shapeOf(Q);
}

// ═══ PlanePartitions(size) — 2D arrays, nonincreasing along rows AND columns, summing to n (A000219) ═══
// No closed form (no simple generating-function shortcut — same as the archived checkout's own comment).
// count is the cached enumeration's length. Element: rows (number[][]), a chain π₁⊇π₂⊇… entrywise.
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

// ═══ BoxedPlanePartitions(a, b, c) — plane partitions (any size) fitting in an a×b×c box ═══
// Count: MacMahon's box formula, Π_{i=1..a} Π_{j=1..b} Π_{k=1..c} (i+j+k−1)/(i+j+k−2) — exact and
// closed-form; accumulated as bigint numerator/denominator (not Math.round'd like the other formulas
// above) since the box formula's intermediate factors don't individually cancel to integers. Element:
// PlanePartitions' ragged-rows carrier (ragged number[][], nonincreasing along rows and down columns,
// trailing zeros trimmed) with the box's bounds standing in for the fixed-size target — IsPlanePartitionOf's
// structural checks plus ≤a rows, each row ≤b long, entries ≤c. Unrank/rank: enumerate-then-index
// (indexedFamily), same shape-then-entries order as PlanePartitions — small boxes only.
export function BoxedPlanePartitionsCount(a: number, b: number, c: number): number {
  let num = 1n;
  let den = 1n;
  for (let i = 1; i <= a; i++)
    for (let j = 1; j <= b; j++)
      for (let k = 1; k <= c; k++) {
        num *= BigInt(i + j + k - 1);
        den *= BigInt(i + j + k - 2);
      }
  return Number(num / den);
}
// Every weakly-decreasing positive sequence of length ≤ min(maxLen, ceiling.length), entry i bounded by
// ceiling[i] (the column above), maxVal (the box height c), and the previous entry in the row.
function rowsUnder(ceiling: readonly number[], maxLen: number, maxVal: number): number[][] {
  const results: number[][] = [];
  function rec(idx: number, cur: number[]): void {
    results.push(cur.slice());
    if (idx === maxLen || idx === ceiling.length) return;
    const prevVal = idx > 0 ? cur[idx - 1] : maxVal;
    const hi = Math.min(prevVal, ceiling[idx], maxVal);
    for (let v = 1; v <= hi; v++) {
      cur.push(v);
      rec(idx + 1, cur);
      cur.pop();
    }
  }
  rec(0, []);
  return results;
}
const boxedPlanePart = indexedFamily<number[][]>((key) => {
  const [a, b, c] = key.split("|").map(Number);
  const results: number[][][] = [];
  const rows: number[][] = [];
  // Every prefix (0..a rows) is itself a box-confined plane partition — push on entry, then extend.
  function backtrack(ceiling: readonly number[], rowsLeft: number): void {
    results.push(rows.map((r) => r.slice()));
    if (rowsLeft === 0) return;
    for (const nr of rowsUnder(ceiling, b, c)) {
      if (nr.length === 0) continue;
      rows.push(nr);
      backtrack(nr, rowsLeft - 1);
      rows.pop();
    }
  }
  backtrack(
    Array.from({ length: b }, () => c),
    a,
  );
  results.sort(cmpRowsShapeThenEntries);
  return results;
});
export function BoxedPlanePartitionsUnrank(a: number, b: number, c: number, rank: number): number[][] {
  return boxedPlanePart.unrank(`${a}|${b}|${c}`, rank);
}
export function BoxedPlanePartitionsRank(e: number[][], a: number, b: number, c: number): number {
  return boxedPlanePart.rank(`${a}|${b}|${c}`, e);
}
export function IsBoxedPlanePartitionOf(e: unknown, a: number, b: number, c: number): boolean {
  if (!Array.isArray(e)) return false;
  const rows = e as number[][];
  if (rows.length > a) return false;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length === 0 || row.length > b) return false;
    if (r > 0 && rows[r - 1].length < row.length) return false;
    for (let ci = 0; ci < row.length; ci++) {
      const v = row[ci];
      if (!Number.isInteger(v) || v < 1 || v > c) return false;
      if (ci > 0 && row[ci - 1] < v) return false;
      if (r > 0 && rows[r - 1][ci] < v) return false;
    }
  }
  return true;
}

const axis = (name: string): Param => ({ name, role: "axis", min: 0 });
/** Every family here enumerates to unrank and rank (indexedFamily); `count` is its own. */
const enumerated = (count: Cost): Declared["cost"] => ({
  count,
  unrank: "enumerative",
  rank: "enumerative",
  valid: "polynomial",
});
const factorialBig = (n: number): bigint => {
  let f = 1n;
  for (let i = 2n; i <= BigInt(n); i++) f *= i;
  return f;
};

export const entries: NumberKernel[] = [
  {
    head: "SemistandardTableaux",
    paramCount: 2,
    kind: "blocks",
    count: ([n, k]) => SemistandardTableauxCount(n, k),
    unrank: ([n, k], r) => SemistandardTableauxUnrank(n, k, r),
    valid: (e, [n, k]) => IsSemistandardTableauOf(e, n, k),
    rank: (e, [n, k]) => SemistandardTableauxRank(e as number[][], n, k),
    declared: {
      carrier: "SemistandardTableaux",
      params: [axis("size"), axis("max_entry")],
      cost: enumerated("polynomial"),
      work: ([n, k]) => BigInt(SemistandardTableauxCount(n, k)),
    },
  },
  {
    head: "GelfandTsetlin",
    paramCount: 2,
    kind: "blocks",
    count: ([n, k]) => GelfandTsetlinCount(n, k),
    unrank: ([n, k], r) => GelfandTsetlinUnrank(n, k, r),
    valid: (e, [n, k]) => IsGelfandTsetlinOf(e, n, k),
    rank: (e, [n, k]) => GelfandTsetlinRank(e as number[][], n, k),
    declared: {
      carrier: "GelfandTsetlinPatterns",
      params: [axis("n"), axis("k")],
      cost: enumerated("closed"),
      work: ([n, k]) => BigInt(GelfandTsetlinCount(n, k)),
    },
  },
  {
    head: "AlternatingSignMatrices",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => AlternatingSignMatrixCount(n),
    unrank: ([n], r) => AlternatingSignMatrixUnrank(n, r),
    valid: (e, [n]) => IsAlternatingSignMatrixOf(e, n),
    rank: (e, [n]) => AlternatingSignMatrixRank(e as number[][], n),
    declared: {
      carrier: "AlternatingSignMatrices",
      params: [axis("size")],
      cost: enumerated("closed"),
      work: ([n]) => BigInt(AlternatingSignMatrixCount(n)),
    },
  },
  {
    head: "SkewPartitions",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => skewPart.count(String(n)),
    unrank: ([n], r) => SkewPartitionsUnrank(n, r),
    valid: (e, [n]) => IsSkewPartitionOf(e, n),
    rank: (e, [n]) => SkewPartitionsRank(e as [number[], number[]], n),
    declared: {
      carrier: "SkewPartitions",
      params: [axis("size")],
      cost: enumerated("enumerative"),
      work: ([n]) => 4n ** BigInt(n),
    },
  },
  {
    head: "SkewStandardTableaux",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => skewStd.count(String(n)),
    unrank: ([n], r) => SkewStandardTableauxUnrank(n, r),
    valid: (e, [n]) => IsSkewStandardTableauOf(e, n),
    rank: (e, [n]) => SkewStandardTableauxRank(e as [number[], number[], number[]], n),
    declared: {
      carrier: "SkewTableaux",
      params: [axis("size")],
      cost: enumerated("enumerative"),
      work: ([n]) => factorialBig(n) * 4n ** BigInt(n),
    },
  },
  {
    head: "ShiftedStandardTableaux",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => ShiftedStandardTableauxCount(n),
    unrank: ([n], r) => ShiftedStandardTableauxUnrank(n, r),
    valid: (e, [n]) => IsShiftedStandardTableauOf(e, n),
    rank: (e, [n]) => ShiftedStandardTableauxRank(e as number[][], n),
  },
  {
    head: "StandardTableauPairs",
    paramCount: 1,
    kind: "nested",
    count: ([n]) => Factorial(n),
    unrank: ([n], r) => StandardTableauPairsUnrank(n, r),
    valid: (e, [n]) => IsStandardTableauPairOf(e, n),
    rank: (e, [n]) => StandardTableauPairsRank(e as [number[][], number[][]], n),
  },
  {
    head: "PlanePartitions",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => PlanePartitionsCount(n),
    unrank: ([n], r) => PlanePartitionsUnrank(n, r),
    valid: (e, [n]) => IsPlanePartitionOf(e, n),
    rank: (e, [n]) => PlanePartitionsRank(e as number[][], n),
    declared: {
      carrier: "PlanePartitions",
      params: [axis("size")],
      cost: enumerated("polynomial"),
      work: ([n]) => BigInt(PlanePartitionsCount(n)),
    },
  },
  {
    head: "BoxedPlanePartitions",
    paramCount: 3,
    kind: "blocks",
    count: ([a, b, c]) => BoxedPlanePartitionsCount(a, b, c),
    unrank: ([a, b, c], r) => BoxedPlanePartitionsUnrank(a, b, c, r),
    valid: (e, [a, b, c]) => IsBoxedPlanePartitionOf(e, a, b, c),
    rank: (e, [a, b, c]) => BoxedPlanePartitionsRank(e as number[][], a, b, c),
    declared: {
      carrier: "PlanePartitions",
      params: [axis("a"), axis("b"), axis("c")],
      cost: enumerated("closed"),
      work: ([a, b, c]) => BigInt(BoxedPlanePartitionsCount(a, b, c)),
    },
  },
];
