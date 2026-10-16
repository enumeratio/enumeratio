// Moved out of the runtime by BL-225: kernels only tests/readings and the agreement tests use.
import { type FastKernel } from "../../../collections/src/families/epsil.ts";
import { Factorial, floorDiv } from "../../../collections/src/families/kernels.ts";
import { isStandardTableauOf, normRank } from "../../../collections/src/families/tableaux-trees.ts";
import { SubsetCount, SubsetRank, SubsetUnrank } from "./collections-kernels-extra.ts";

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

export const sytHookShapeFast: FastKernel = {
  count: ([n]) => SytHookShapeCount(n),
  unrank: ([n], r) => SytHookShapeUnrank(n, r),
  rank: (e, [n]) => SytHookShapeRank(e as number[][], n),
  valid: (e, [n]) => IsSytHookShapeOf(e, n),
};

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
    rem = floorDiv(rem, base);
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

export const recursiveTreesFast: FastKernel = {
  count: ([n]) => RecursiveTreeCount(n),
  unrank: ([n], r) => RecursiveTreeUnrank(n, r),
  rank: (e, [n]) => RecursiveTreeRank(e as number[], n),
  valid: (e, [n]) => IsRecursiveTreeOf(e, n),
};
