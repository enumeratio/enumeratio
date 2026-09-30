// Tableaux and trees — the "easy wins" batch of catalogued-but-undeclared collections: Prüfer
// sequences, recursive/increasing-binary trees, and the standard-Young-tableaux family (all
// shapes, and the ≤2-row / ≤2-column / hook restrictions).
// Pure rank/unrank kernels over plain JS values — no compute-engine dependency, same contract as
// core.ts (see ./types.ts). Kept in its own file (rather than folded into kernels-extra.ts +
// core.ts) so parallel authoring on the same catalog sweep doesn't collide.
// ParkingFunctions/NonDecreasingParkingFunctions moved to words/src/families/tableaux-trees.ts
// (wire-carriers lane A-91): both now carry "ParkingFunction". Tournaments/LabeledGraphs/
// LabeledGraphsByEdges moved to graphs/src/families/core.ts (wire-carriers lane A-92): all
// three now carry "Tournament"/"LabeledGraph". PruferSequences moved to
// trees/src/families/prufer-sequences.ts (§4 step 5): it now carries "PruferSequence".
import type { NumberKernel } from "./types.ts";
import { Factorial, PermutationUnrank, PermutationRank } from "./kernels.ts";
import { PartitionsP, IntegerPartitionUnrank, IntegerPartitionRank } from "./kernels-combinatorics.ts";
import { SubsetCount, SubsetUnrank, SubsetRank } from "./kernels-extra.ts";

const normRank = (r: number, total: number): number => (total > 0 ? ((Math.trunc(r) % total) + total) % total : 0);

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

// Kept separate from `entriesAfterNonDecreasingParkingFunctions` below only so
// collections/src/families/index.ts can splice `wordsTableauxTreesEntries` (ParkingFunctions,
// NonDecreasingParkingFunctions) back in at the exact interior position it held before the words-
// area move — §4 step 5.
export const entriesAfterNonDecreasingParkingFunctions: NumberKernel[] = [
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
