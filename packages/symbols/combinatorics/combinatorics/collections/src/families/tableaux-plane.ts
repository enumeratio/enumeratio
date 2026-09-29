// ShiftedStandardTableaux and StandardTableauPairs: catalogued (packages/reference/entries/) but
// never wired to a kernel, kept here because neither declares a carrier (step 5 rule 4,
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible).
// SemistandardTableaux, GelfandTsetlin, AlternatingSignMatrices, SkewStandardTableaux,
// PlanePartitions and BoxedPlanePartitions moved to tableaux/src/families/tableaux-plane.ts --
// every one of them carries a `declared.carrier`. SkewPartitions moved earlier to
// partitions/src/families/tableaux-plane.ts.
//
// Element representation follows tableaux-trees.ts's StandardTableaux convention (kind "blocks" = rows,
// number[][]) wherever a family's carrier is naturally row-shaped -- except StandardTableauPairs, whose
// two same-shape tableaux don't share a row count with anything else and so use kind "nested" as `[P, Q]`.
import type { NumberKernel } from "./types.ts";
import { Factorial, PermutationRank, PermutationUnrank } from "./kernels.ts";
import { PartitionsQ, DistinctPartitionUnrank, DistinctPartitionRank } from "./kernels-extra.ts";
import { IsStandardTableauOf } from "./tableaux-trees.ts";

const normRank = (r: number, total: number): number => (total > 0 ? ((Math.trunc(r) % total) + total) % total : 0);

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

export const entries: NumberKernel[] = [
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
];
