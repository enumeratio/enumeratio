// SemistandardTableaux, GelfandTsetlin, AlternatingSignMatrices, SkewStandardTableaux,
// PlanePartitions and BoxedPlanePartitions split out of collections/src/families/tableaux-plane.ts
// (which mixed every area) per
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5 -- every family in that file carrying a `declared.carrier` (all six do; none has a
// top-level `carrier` yet). ShiftedStandardTableaux joined them (wire-carriers lane A-92): it
// now carries the new "ShiftedStandardTableau" carrier (its element already is one, kind
// "blocks" = rows). StandardTableauPairs now carries "StandardTableauPair" too, wired via
// `carrierElements` (declare.ts) -- see ./standard-tableau-pairs.ts.
// `normRank` and `axis` are small local helpers duplicated from the source file (mirrors the
// permutations pilot's `ints`).
//
// PlanePartitions stays TS (./plane-partitions.ts): the layers left below a row depend on the whole
// row above, so a row-by-row table is far larger than the family; it walks a table of counts by shape
// and enumerates the one shape instead.
// SkewPartitions, SkewStandardTableaux and BoxedPlanePartitions are defined in Epsil
// (../../../partitions/src/families/skew-partitions.ts, ./skew-standard-tableaux.ts, ./boxed-plane-partitions.ts).
import type { EpsilFamily, FastKernel } from "../../../collections/src/families/epsil.ts";
import { modRank } from "../../../collections/src/families/kernels.ts";
import type { NumberKernel, Param } from "../../../collections/src/families/types.ts";
import {
  PartitionsQ,
  DistinctPartitionUnrank,
  DistinctPartitionRank,
} from "../../../collections/src/families/kernels-extra.ts";
import { planePartitionsExact } from "../../../collections/src/families/exact-classes.ts";
import { shiftedStandardTableauxExact } from "../../../collections/src/families/exact-recurrences.ts";
import { alternatingSignMatrices } from "./alternating-sign-matrices.ts";
import { boxedPlanePartitions } from "./boxed-plane-partitions.ts";
import { gelfandTsetlin } from "./gelfand-tsetlin.ts";
import {
  IsPlanePartitionOf,
  PlanePartitionsCount,
  PlanePartitionsRank,
  PlanePartitionsUnrank,
  planePartitionsWork,
} from "./plane-partitions.ts";
import { semistandardTableaux } from "./semistandard-tableaux.ts";
import { shiftedStandardTableaux } from "./standard-tableaux.ts";

const normRank = (r: number, total: number): number => (total > 0 ? modRank(Math.trunc(r), total) : 0);

const axis = (name: string): Param => ({ name, role: "axis", min: 0 });

// SemistandardTableaux, GelfandTsetlin and AlternatingSignMatrices are defined in Epsil
// (./semistandard-tableaux.ts, ./gelfand-tsetlin.ts, ./alternating-sign-matrices.ts).

const binomialBig = (n: number, k: number): bigint => {
  let c = 1n;
  for (let i = 1; i <= k; i++) c = (c * BigInt(n - k + i)) / BigInt(i);
  return c;
};

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

export { entries as skewStandardTableauxEntries } from "./skew-standard-tableaux.ts";

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
  // A rank in the fiber is read as it is: reducing it modulo a total past 2^53 would round it.
  let r = rank >= 0 && rank < total ? rank : normRank(rank, total);
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
  // The sum of Thrall's counts over the strict shapes: exact past 2^53, where the doubles are not.
  count: ([n]) => shiftedStandardTableauxExact(n),
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
    exactCount: ([n]) => planePartitionsExact(n),
    unrank: ([n], r) => PlanePartitionsUnrank(n, r),
    valid: (e, [n]) => IsPlanePartitionOf(e, n),
    rank: (e, [n]) => PlanePartitionsRank(e as number[][], n),
    declared: {
      carrier: "PlanePartition",
      params: [axis("size")],
      // Unrank and rank read a table of counts by shape, then enumerate the one shape they land in.
      cost: { count: "polynomial", unrank: "enumerative", rank: "enumerative", valid: "polynomial" },
      work: ([n]) => planePartitionsWork(n),
      walks: true,
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
