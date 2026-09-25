// Tableaux, trees and graphs — the "easy wins" batch of catalogued-but-undeclared collections:
// Prüfer sequences, parking functions, tournaments, labeled graphs, recursive/increasing-binary
// trees, and the standard-Young-tableaux family (all shapes, and the ≤2-row / ≤2-column / hook
// restrictions). Pure rank/unrank kernels over plain JS values — no compute-engine dependency,
// same contract as core.ts (see ./types.ts). Kept in its own file (rather than folded into
// kernels-extra.ts + core.ts) so parallel authoring on the same catalog sweep doesn't collide.
import type { NumberKernel } from "./types.ts";
import { Factorial, PermutationUnrank, PermutationRank } from "./kernels.ts";
import { Binomial, PartitionsP, IntegerPartitionUnrank, IntegerPartitionRank } from "./kernels-combinatorics.ts";
import {
  SubsetCount,
  SubsetUnrank,
  SubsetRank,
  KSubsetCount,
  KSubsetUnrank,
  KSubsetRank,
  TupleCount,
  TupleUnrank,
  TupleRank,
  IsTupleOf,
} from "./kernels-extra.ts";

const normRank = (r: number, total: number): number => (total > 0 ? ((Math.trunc(r) % total) + total) % total : 0);

// ─── PruferSequences(n): codes ⟨a,…⟩ of length n-2 over {1..n} for labeled trees on [n]. Count
// n^(n-2) (n<=2: the empty code, 1 of it) — the raw code itself, no decode to an edge list; that's
// LabeledTrees' job (kernels-extra.ts), which already goes through this same Prüfer bijection. ───
export function PruferSequenceCount(n: number): number {
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  return TupleCount(n, n - 2);
}
export function PruferSequenceUnrank(n: number, rank: number): number[] {
  if (n <= 2) return [];
  return TupleUnrank(n, n - 2, rank);
}
export function PruferSequenceRank(seq: number[], n: number): number {
  if (n <= 2) return 0;
  return TupleRank(seq, n);
}
export function IsPruferSequenceOf(seq: unknown, n: number): boolean {
  if (n <= 2) return Array.isArray(seq) && seq.length === 0;
  return Array.isArray(seq) && IsTupleOf(seq as number[], n, n - 2);
}

// ─── ParkingFunctions(n): sequences (a_1..a_n), a_i in {1..n}, whose sorted form b satisfies
// b_i<=i (every car parks). Count (n+1)^(n-1). unrank/rank via digit-DP: M[k] tracks, while
// building a_1..a_n left to right, how many entries placed so far are <=k for every threshold k;
// the number of valid completions from position i+1 depends only on M, so it memoizes per call and
// unrank/rank walk the identical v=1..n decision order (adapted from the archived enumeratio
// checkout's packs/trees.ts, which certified this exact algorithm). ─────────────────────────────
function pfCompletions(n: number, i: number, M: number[], memo: Map<string, number>): number {
  if (i === n) {
    for (let k = 1; k <= n; k++) if (M[k] < k) return 0;
    return 1;
  }
  const key = `${i}|${M.slice(1, n + 1).join(",")}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  let total = 0;
  for (let v = 1; v <= n; v++) {
    const next = M.slice();
    for (let k = v; k <= n; k++) next[k]++;
    total += pfCompletions(n, i + 1, next, memo);
  }
  memo.set(key, total);
  return total;
}
export function ParkingFunctionCount(n: number): number {
  return (n + 1) ** (n - 1);
}
export function ParkingFunctionUnrank(n: number, rank: number): number[] {
  const total = ParkingFunctionCount(n);
  let r = normRank(rank, total);
  const M = new Array(n + 1).fill(0);
  const memo = new Map<string, number>();
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let v = 1; v <= n; v++) {
      const next = M.slice();
      for (let k = v; k <= n; k++) next[k]++;
      const c = pfCompletions(n, i + 1, next, memo);
      if (r < c) {
        out.push(v);
        for (let k = v; k <= n; k++) M[k]++;
        break;
      }
      r -= c;
    }
  }
  return out;
}
export function ParkingFunctionRank(e: number[], n: number): number {
  const M = new Array(n + 1).fill(0);
  const memo = new Map<string, number>();
  let rank = 0;
  for (let i = 0; i < n; i++) {
    const a = e[i];
    for (let v = 1; v < a; v++) {
      const next = M.slice();
      for (let k = v; k <= n; k++) next[k]++;
      rank += pfCompletions(n, i + 1, next, memo);
    }
    for (let k = a; k <= n; k++) M[k]++;
  }
  return rank;
}
export function IsParkingFunctionOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== n) return false;
  for (const x of e) if (!Number.isInteger(x) || x < 1 || x > n) return false;
  const b = (e as number[]).slice().sort((x, y) => x - y);
  for (let i = 0; i < n; i++) if (b[i] > i + 1) return false;
  return true;
}

// ─── NonDecreasingParkingFunctions(n): weakly-increasing parking functions — equivalently
// 1<=a_1<=...<=a_n<=n with a_i<=i. Count = CatalanNumber(n) (the sub-diagonal ballot sequences).
// Same digit-DP shape as ParkingFunctions above, but the state collapses to a single running lower
// bound v (since the sequence is monotone, "how many completions from position i with a_i>=v" is
// the whole story) — cheaper, and reused as-is by StandardTableaux's siblings below. ─────────────
function ndpfCompletions(n: number, i: number, v: number, memo: Map<string, number>): number {
  if (i > n) return 1;
  const key = `${i},${v}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  let total = 0;
  for (let a = v; a <= i; a++) total += ndpfCompletions(n, i + 1, a, memo);
  memo.set(key, total);
  return total;
}
export function NonDecreasingParkingFunctionCount(n: number): number {
  return ndpfCompletions(n, 1, 1, new Map());
}
export function NonDecreasingParkingFunctionUnrank(n: number, rank: number): number[] {
  const memo = new Map<string, number>();
  const total = NonDecreasingParkingFunctionCount(n);
  let r = normRank(rank, total);
  const out: number[] = [];
  let v = 1;
  for (let i = 1; i <= n; i++) {
    for (let a = v; a <= i; a++) {
      const c = ndpfCompletions(n, i + 1, a, memo);
      if (r < c) {
        out.push(a);
        v = a;
        break;
      }
      r -= c;
    }
  }
  return out;
}
export function NonDecreasingParkingFunctionRank(e: number[], n: number): number {
  const memo = new Map<string, number>();
  let r = 0,
    v = 1;
  for (let i = 1; i <= n; i++) {
    const a = e[i - 1];
    for (let aa = v; aa < a; aa++) r += ndpfCompletions(n, i + 1, aa, memo);
    v = a;
  }
  return r;
}
export function IsNonDecreasingParkingFunctionOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== n) return false;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const a = e[i];
    if (!Number.isInteger(a) || a < 1 || a > i + 1 || a < prev) return false;
    prev = a;
  }
  return true;
}

// ─── edge indexing shared by LabeledGraphs/LabeledGraphsByEdges/Tournaments: the C(n,2) unordered
// pairs of [n] in lexicographic order, so "which edges are present/oriented" reduces to an
// existing Subset/KSubset/Tuple kernel over the index space [1..C(n,2)]. ──────────────────────────
function edgePairs(n: number): number[][] {
  const edges: number[][] = [];
  for (let i = 1; i < n; i++) for (let j = i + 1; j <= n; j++) edges.push([i, j]);
  return edges;
}
function edgeIndexOf(edges: number[][], u: number, v: number): number {
  const [a, b] = u < v ? [u, v] : [v, u];
  for (let k = 0; k < edges.length; k++) if (edges[k][0] === a && edges[k][1] === b) return k + 1;
  return 0;
}

// ─── LabeledGraphs(n): simple undirected graphs on [n] — subsets of K_n's edges. Count 2^C(n,2).
// Element = edge list, matching LabeledTrees' convention. ─────────────────────────────────────────
export function LabeledGraphCount(n: number): number {
  return SubsetCount(Binomial(n, 2));
}
export function LabeledGraphUnrank(n: number, rank: number): number[][] {
  const edges = edgePairs(n);
  return SubsetUnrank(edges.length, rank).map((i) => edges[i - 1]);
}
export function LabeledGraphRank(e: number[][], n: number): number {
  const edges = edgePairs(n);
  const idx = e.map(([u, v]) => edgeIndexOf(edges, u, v)).sort((a, b) => a - b);
  return SubsetRank(idx);
}
export function IsLabeledGraphOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e)) return false;
  const edges = edgePairs(n);
  const seen = new Set<number>();
  for (const pair of e as unknown[]) {
    if (!Array.isArray(pair) || pair.length !== 2) return false;
    const [u, v] = pair as number[];
    if (!Number.isInteger(u) || !Number.isInteger(v) || u < 1 || v < 1 || u > n || v > n || u === v) return false;
    const idx = edgeIndexOf(edges, u, v);
    if (idx === 0 || seen.has(idx)) return false;
    seen.add(idx);
  }
  return true;
}

// ─── LabeledGraphsByEdges(n,m): the (n,m) refinement — graphs on [n] with exactly m edges. Same
// edge list as LabeledGraphs, just a KSubset instead of a Subset. ─────────────────────────────────
export function LabeledGraphByEdgesCount(n: number, m: number): number {
  return KSubsetCount(Binomial(n, 2), m);
}
export function LabeledGraphByEdgesUnrank(n: number, m: number, rank: number): number[][] {
  const edges = edgePairs(n);
  return KSubsetUnrank(edges.length, m, rank).map((i) => edges[i - 1]);
}
export function LabeledGraphByEdgesRank(e: number[][], n: number): number {
  const edges = edgePairs(n);
  const idx = e.map(([u, v]) => edgeIndexOf(edges, u, v)).sort((a, b) => a - b);
  return KSubsetRank(idx);
}
export function IsLabeledGraphByEdgesOf(e: unknown, n: number, m: number): boolean {
  return Array.isArray(e) && e.length === m && IsLabeledGraphOf(e, n);
}

// ─── Tournaments(n): orientations of K_n — for every edge, a direction. Count 2^C(n,2), reusing
// Tuples(2, C(n,2)) over the same edge order; element = the directed edge list [winner,loser]. ───
export function TournamentCount(n: number): number {
  return TupleCount(2, Binomial(n, 2));
}
export function TournamentUnrank(n: number, rank: number): number[][] {
  const edges = edgePairs(n);
  const bits = TupleUnrank(2, edges.length, rank);
  return edges.map(([i, j], k) => (bits[k] === 1 ? [i, j] : [j, i]));
}
export function TournamentRank(e: number[][], n: number): number {
  const edges = edgePairs(n);
  const bits = new Array(edges.length).fill(0);
  for (const [u, v] of e) {
    const idx = edgeIndexOf(edges, u, v);
    const [i, j] = edges[idx - 1];
    bits[idx - 1] = u === i && v === j ? 1 : 2;
  }
  return TupleRank(bits, 2);
}
export function IsTournamentOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== Binomial(n, 2)) return false;
  const edges = edgePairs(n);
  const seen = new Set<number>();
  for (const pair of e as unknown[]) {
    if (!Array.isArray(pair) || pair.length !== 2) return false;
    const [u, v] = pair as number[];
    if (!Number.isInteger(u) || !Number.isInteger(v) || u < 1 || v < 1 || u > n || v > n || u === v) return false;
    const idx = edgeIndexOf(edges, u, v);
    if (idx === 0 || seen.has(idx)) return false;
    seen.add(idx);
  }
  return true;
}

// ─── RecursiveTrees(n): increasing trees on [n] — rooted at 1, every root-to-leaf path increasing
// (parent[i] < i for i>=2). Count (n-1)!. Element = parent array (parent[0]=0 sentinel for the
// root), same "ints" convention as RootedForests. For i=2..n, parent[i-1] ranges freely over
// {1,...,i-1}: a mixed-radix (factorial number system) digit, base i-1 — so rank/unrank are exact
// inverses by construction, same algorithm as the archived checkout's IncreasingTrees. ────────────
export function RecursiveTreeCount(n: number): number {
  return n <= 1 ? 1 : Factorial(n - 1);
}
export function RecursiveTreeUnrank(n: number, rank: number): number[] {
  const total = RecursiveTreeCount(n);
  let rem = normRank(rank, total);
  const parent = new Array(n).fill(0);
  for (let i = n; i >= 2; i--) {
    const base = i - 1;
    parent[i - 1] = (rem % base) + 1;
    rem = Math.floor(rem / base);
  }
  return parent;
}
export function RecursiveTreeRank(e: number[], n: number): number {
  let rank = 0,
    place = 1;
  for (let i = n; i >= 2; i--) {
    const base = i - 1;
    rank += (e[i - 1] - 1) * place;
    place *= base;
  }
  return rank;
}
export function IsRecursiveTreeOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== n) return false;
  if (n === 0) return true;
  if (e[0] !== 0) return false;
  for (let i = 2; i <= n; i++) {
    const v = e[i - 1];
    if (!Number.isInteger(v) || v < 1 || v > i - 1) return false;
  }
  return true;
}

// ─── IncreasingBinaryTrees(n): binary trees on n labeled nodes, heap-ordered by label (parent's
// label < both children's). Count n! — the Cartesian-tree bijection with permutations: root = the
// position of the array's minimum, recursing left/right on the split; in-order flattening is the
// exact inverse. Element nested, following BinaryTrees' leaf=0 convention with the label folded
// in: node = [label, left, right]. ─────────────────────────────────────────────────────────────
export type LabTree = 0 | [number, LabTree, LabTree];
function cartesianTree(vals: number[]): LabTree {
  if (vals.length === 0) return 0;
  let mi = 0;
  for (let i = 1; i < vals.length; i++) if (vals[i] < vals[mi]) mi = i;
  return [vals[mi], cartesianTree(vals.slice(0, mi)), cartesianTree(vals.slice(mi + 1))];
}
function flattenLabTree(t: LabTree): number[] {
  if (t === 0) return [];
  const [v, l, r] = t;
  return [...flattenLabTree(l), v, ...flattenLabTree(r)];
}
export function IncreasingBinaryTreeCount(n: number): number {
  return Factorial(n);
}
export function IncreasingBinaryTreeUnrank(n: number, rank: number): LabTree {
  return cartesianTree(PermutationUnrank(n, rank));
}
export function IncreasingBinaryTreeRank(t: LabTree): number {
  return PermutationRank(flattenLabTree(t));
}
export function IsIncreasingBinaryTree(t: unknown, n: number): boolean {
  const seen = new Array(n + 1).fill(false);
  let count = 0;
  const rec = (x: unknown, parentLabel: number): boolean => {
    if (x === 0) return true;
    if (!Array.isArray(x) || x.length !== 3) return false;
    const [v, l, r] = x as [number, unknown, unknown];
    if (!Number.isInteger(v) || v < 1 || v > n || seen[v]) return false;
    if (parentLabel >= 0 && v <= parentLabel) return false;
    seen[v] = true;
    count++;
    return rec(l, v) && rec(r, v);
  };
  if (!rec(t, -1)) return false;
  return count === n;
}

// ─── Standard Young tableaux, all built on the same recursive-corner-removal scheme: value n
// always sits at a removable corner of the shape, so f(shape) = Σ over removable corners of
// f(shape minus that corner), and iterating corners in a fixed (top-to-bottom row) order turns
// that recurrence directly into unrank/rank (same shape as the Catalan/hook-length recursions
// elsewhere in this file). f(shape) itself is the closed-form hook-length formula. ────────────────
function conjugateShape(shape: number[]): number[] {
  const width = shape[0] ?? 0;
  return Array.from({ length: width }, (_, c) => shape.filter((row) => row > c).length);
}
function hookLengthProduct(shape: number[]): number {
  const conj = conjugateShape(shape);
  let prod = 1;
  for (let r = 0; r < shape.length; r++) for (let c = 0; c < shape[r]; c++) prod *= shape[r] - c + conj[c] - r - 1;
  return prod;
}
function sytCountForShape(shape: number[]): number {
  const n = shape.reduce((a, b) => a + b, 0);
  return n === 0 ? 1 : Math.round(Factorial(n) / hookLengthProduct(shape));
}
function removableCorners(shape: number[]): { row: number; newShape: number[] }[] {
  const corners: { row: number; newShape: number[] }[] = [];
  for (let i = 0; i < shape.length; i++) {
    if (shape[i] > 0 && (i === shape.length - 1 || shape[i] > shape[i + 1])) {
      const ns = shape.slice();
      ns[i] -= 1;
      if (ns[i] === 0) ns.pop();
      corners.push({ row: i, newShape: ns });
    }
  }
  return corners;
}
function sytUnrankShape(shape: number[], rank: number): number[][] {
  const n = shape.reduce((a, b) => a + b, 0);
  if (n === 0) return [];
  let r = rank;
  for (const c of removableCorners(shape)) {
    const w = sytCountForShape(c.newShape);
    if (r < w) {
      const rows = sytUnrankShape(c.newShape, r).map((row) => row.slice());
      while (rows.length <= c.row) rows.push([]);
      rows[c.row] = [...rows[c.row], n];
      return rows;
    }
    r -= w;
  }
  throw new Error(`StandardTableaux: rank out of range for shape ${shape.join(",")}`);
}
function sytRankShape(rows: number[][]): number {
  const shape = rows.map((row) => row.length);
  const n = shape.reduce((a, b) => a + b, 0);
  if (n === 0) return 0;
  const targetRow = rows.findIndex((row) => row[row.length - 1] === n);
  let base = 0;
  for (const c of removableCorners(shape)) {
    if (c.row === targetRow) {
      const sub = rows.map((row) => row.slice());
      sub[c.row].pop();
      while (sub.length && sub[sub.length - 1].length === 0) sub.pop();
      return base + sytRankShape(sub);
    }
    base += sytCountForShape(c.newShape);
  }
  throw new Error("StandardTableaux: value n not at a removable corner");
}
function isStandardTableauOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e)) return false;
  const rows = e as number[][];
  const seen = new Array(n + 1).fill(false);
  let total = 0;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length === 0) return false;
    if (r > 0 && rows[r - 1].length < row.length) return false;
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (!Number.isInteger(v) || v < 1 || v > n || seen[v]) return false;
      seen[v] = true;
      total++;
      if (c > 0 && row[c - 1] >= v) return false;
      if (r > 0 && rows[r - 1][c] !== undefined && rows[r - 1][c] >= v) return false;
    }
  }
  return total === n;
}

// StandardTableaux(n): every shape λ⊢n, dispatched by summing f(λ) over PartitionsP(n) shapes
// (largest-part-first order, same order IntegerPartitionUnrank/Rank already use).
export function StandardTableauxCount(n: number): number {
  let total = 0;
  for (let idx = 0; idx < PartitionsP(n); idx++) total += sytCountForShape(IntegerPartitionUnrank(n, idx));
  return total;
}
export function StandardTableauxUnrank(n: number, rank: number): number[][] {
  const total = StandardTableauxCount(n);
  let r = normRank(rank, total);
  for (let idx = 0; idx < PartitionsP(n); idx++) {
    const shape = IntegerPartitionUnrank(n, idx);
    const w = sytCountForShape(shape);
    if (r < w) return sytUnrankShape(shape, r);
    r -= w;
  }
  throw new Error("StandardTableaux: rank out of range");
}
export function StandardTableauxRank(rows: number[][], n: number): number {
  const shape = rows.map((row) => row.length);
  const idx = IntegerPartitionRank(shape, n);
  let base = 0;
  for (let i = 0; i < idx; i++) base += sytCountForShape(IntegerPartitionUnrank(n, i));
  return base + sytRankShape(rows);
}
export function IsStandardTableauOf(e: unknown, n: number): boolean {
  return isStandardTableauOf(e, n);
}

// SytHookShape(n): shapes (a,1^b), a+b=n — the filling is forced once you choose which of
// {2..n} sit in the arm (row 1) vs. the leg (column 1 below it), so this is exactly Subsets(n-1)
// over {2..n}. Count 2^(n-1).
export function SytHookShapeCount(n: number): number {
  return n <= 0 ? 1 : SubsetCount(n - 1);
}
export function SytHookShapeUnrank(n: number, rank: number): number[][] {
  if (n <= 0) return [];
  if (n === 1) return [[1]];
  const arm = SubsetUnrank(n - 1, rank).map((x) => x + 1);
  const armSet = new Set(arm);
  const leg: number[] = [];
  for (let v = 2; v <= n; v++) if (!armSet.has(v)) leg.push(v);
  const rows = [[1, ...arm]];
  for (const v of leg) rows.push([v]);
  return rows;
}
export function SytHookShapeRank(rows: number[][], n: number): number {
  if (n <= 1) return 0;
  return SubsetRank(rows[0].slice(1).map((v) => v - 1));
}
export function IsSytHookShapeOf(e: unknown, n: number): boolean {
  if (!isStandardTableauOf(e, n)) return false;
  const rows = e as number[][];
  for (let i = 1; i < rows.length; i++) if (rows[i].length !== 1) return false;
  return true;
}

// SytTwoRow/SytTwoColumn(n): shapes with <=2 rows (resp. columns) — total count C(n, floor(n/2)),
// the "ballot" numbers: placing 1..n one at a time into row1 (+1) or row2 (-1), staying >=0 (not
// necessarily returning to 0 — unlike DyckPaths). Two-column is the exact transpose of two-row
// (swap the words "row"/"column" throughout the argument for why it's valid), so it reuses the
// identical sequence pair, just presented as columns instead of rows.
function ballotCompletions(s: number, h: number, memo: Map<string, number>): number {
  if (h < 0) return 0;
  if (s === 0) return 1;
  const key = `${s},${h}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  const v = ballotCompletions(s - 1, h + 1, memo) + (h > 0 ? ballotCompletions(s - 1, h - 1, memo) : 0);
  memo.set(key, v);
  return v;
}
export function SytTwoRowCount(n: number): number {
  return ballotCompletions(n, 0, new Map());
}
export function SytTwoRowUnrank(n: number, rank: number): number[][] {
  const memo = new Map<string, number>();
  const total = SytTwoRowCount(n);
  let r = normRank(rank, total);
  const seq1: number[] = [],
    seq2: number[] = [];
  let h = 0;
  for (let i = 1; i <= n; i++) {
    const s = n - i;
    const up = ballotCompletions(s, h + 1, memo);
    if (r < up) {
      seq1.push(i);
      h++;
    } else {
      r -= up;
      seq2.push(i);
      h--;
    }
  }
  return [seq1, seq2];
}
export function SytTwoRowRank(rows: number[][], n: number): number {
  const memo = new Map<string, number>();
  const inFirst = new Set(rows[0]);
  let r = 0,
    h = 0;
  for (let i = 1; i <= n; i++) {
    const s = n - i;
    if (inFirst.has(i)) h++;
    else {
      r += ballotCompletions(s, h + 1, memo);
      h--;
    }
  }
  return r;
}
export function IsSytTwoRowOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== 2) return false;
  const [seq1, seq2] = e as [number[], number[]];
  if (!Array.isArray(seq1) || !Array.isArray(seq2)) return false;
  if (seq1.length + seq2.length !== n || seq1.length < seq2.length) return false;
  const seen = new Array(n + 1).fill(false);
  for (let i = 0; i < seq1.length; i++) {
    const v = seq1[i];
    if (!Number.isInteger(v) || v < 1 || v > n || seen[v]) return false;
    seen[v] = true;
    if (i > 0 && seq1[i - 1] >= v) return false;
  }
  for (let i = 0; i < seq2.length; i++) {
    const v = seq2[i];
    if (!Number.isInteger(v) || v < 1 || v > n || seen[v]) return false;
    seen[v] = true;
    if (i > 0 && seq2[i - 1] >= v) return false;
    if (seq1[i] >= v) return false;
  }
  return true;
}

export const entries: NumberKernel[] = [
  {
    head: "PruferSequences",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => PruferSequenceCount(n),
    unrank: ([n], r) => PruferSequenceUnrank(n, r),
    valid: (e, [n]) => IsPruferSequenceOf(e, n),
    rank: (e, [n]) => PruferSequenceRank(e as number[], n),
  },
  {
    head: "ParkingFunctions",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => ParkingFunctionCount(n),
    unrank: ([n], r) => ParkingFunctionUnrank(n, r),
    valid: (e, [n]) => IsParkingFunctionOf(e, n),
    rank: (e, [n]) => ParkingFunctionRank(e as number[], n),
  },
  {
    head: "NonDecreasingParkingFunctions",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => NonDecreasingParkingFunctionCount(n),
    unrank: ([n], r) => NonDecreasingParkingFunctionUnrank(n, r),
    valid: (e, [n]) => IsNonDecreasingParkingFunctionOf(e, n),
    rank: (e, [n]) => NonDecreasingParkingFunctionRank(e as number[], n),
  },
  {
    head: "Tournaments",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => TournamentCount(n),
    unrank: ([n], r) => TournamentUnrank(n, r),
    valid: (e, [n]) => IsTournamentOf(e, n),
    rank: (e, [n]) => TournamentRank(e as number[][], n),
  },
  {
    head: "LabeledGraphs",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => LabeledGraphCount(n),
    unrank: ([n], r) => LabeledGraphUnrank(n, r),
    valid: (e, [n]) => IsLabeledGraphOf(e, n),
    rank: (e, [n]) => LabeledGraphRank(e as number[][], n),
  },
  {
    head: "LabeledGraphsByEdges",
    paramCount: 2,
    kind: "blocks",
    count: ([n, m]) => LabeledGraphByEdgesCount(n, m),
    unrank: ([n, m], r) => LabeledGraphByEdgesUnrank(n, m, r),
    valid: (e, [n, m]) => IsLabeledGraphByEdgesOf(e, n, m),
    rank: (e, [n]) => LabeledGraphByEdgesRank(e as number[][], n),
  },
  {
    head: "RecursiveTrees",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => RecursiveTreeCount(n),
    unrank: ([n], r) => RecursiveTreeUnrank(n, r),
    valid: (e, [n]) => IsRecursiveTreeOf(e, n),
    rank: (e, [n]) => RecursiveTreeRank(e as number[], n),
  },
  {
    head: "IncreasingBinaryTrees",
    paramCount: 1,
    kind: "nested",
    count: ([n]) => IncreasingBinaryTreeCount(n),
    unrank: ([n], r) => IncreasingBinaryTreeUnrank(n, r),
    valid: (e, [n]) => IsIncreasingBinaryTree(e, n),
    rank: (e) => IncreasingBinaryTreeRank(e as LabTree),
  },
  {
    head: "StandardTableaux",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => StandardTableauxCount(n),
    unrank: ([n], r) => StandardTableauxUnrank(n, r),
    valid: (e, [n]) => IsStandardTableauOf(e, n),
    rank: (e, [n]) => StandardTableauxRank(e as number[][], n),
  },
  {
    head: "SytHookShape",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => SytHookShapeCount(n),
    unrank: ([n], r) => SytHookShapeUnrank(n, r),
    valid: (e, [n]) => IsSytHookShapeOf(e, n),
    rank: (e, [n]) => SytHookShapeRank(e as number[][], n),
  },
  {
    head: "SytTwoRow",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => SytTwoRowCount(n),
    unrank: ([n], r) => SytTwoRowUnrank(n, r),
    valid: (e, [n]) => IsSytTwoRowOf(e, n),
    rank: (e, [n]) => SytTwoRowRank(e as number[][], n),
  },
  {
    // The transpose of SytTwoRow: swap "row" for "column" throughout — same sequences, same DP.
    head: "SytTwoColumn",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => SytTwoRowCount(n),
    unrank: ([n], r) => SytTwoRowUnrank(n, r),
    valid: (e, [n]) => IsSytTwoRowOf(e, n),
    rank: (e, [n]) => SytTwoRowRank(e as number[][], n),
  },
];
