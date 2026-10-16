// Moved out of the runtime by BL-225: kernels only tests/readings and the agreement tests use.
import { type FastKernel } from "../../../collections/src/families/epsil.ts";
import { fineExact, riordanExact } from "../../../collections/src/families/exact-recurrences.ts";
import {
  CatalanNumber,
  DyckPathRank,
  DyckPathUnrank,
  KSubsetCount,
  KSubsetRank,
  KSubsetUnrank,
} from "../../../collections/src/families/kernels-extra.ts";
import { floorDiv, modRank } from "../../../collections/src/families/kernels.ts";
import { IsDyckPath } from "./collections-kernels-extra.ts";

// ─── FinePaths(n): Dyck paths of semilength n with no "hills" — an elementary U D arch touching
// the ground on both sides. Every Dyck path decomposes uniquely into a sequence of PRIMITIVE
// blocks at ground level (each U <inner Dyck path> D, touching height 0 only at its own ends); a
// hill is a primitive block whose inner path is empty (block semilength 1). Fine(n) counts
// sequences of primitive blocks, every one of semilength >= 2, summing to n — the Fine numbers
// (1,0,1,1,3,8,21,...; A000957). A block of semilength m contributes CatalanNumber(m-1) choices of
// inner path; unrank/rank walk the blocks left to right, recursing into the (shorter) remainder
// exactly like a composition-into-parts enumeration. ────────────────────────────────────────────
export const _fineMemo = new Map<number, number>();

export function fineCount(k: number): number {
  if (k < 0) return 0;
  if (k === 0) return 1;
  const cached = _fineMemo.get(k);
  if (cached !== undefined) return cached;
  let total = 0;
  for (let m = 2; m <= k; m++) total += CatalanNumber(m - 1) * fineCount(k - m);
  _fineMemo.set(k, total);
  return total;
}

export function FinePathCount(n: number): number {
  return fineCount(n);
}

export function finePathUnrankFrom(remaining: number, r: number): number[] {
  if (remaining === 0) return [];
  let rem = r;
  let m = 2;
  for (; m <= remaining; m++) {
    const block = CatalanNumber(m - 1) * fineCount(remaining - m);
    if (rem < block) break;
    rem -= block;
  }
  const restCount = fineCount(remaining - m);
  const innerRank = floorDiv(rem, restCount);
  const restRank = rem % restCount;
  const inner = DyckPathUnrank(m - 1, innerRank);
  const rest = finePathUnrankFrom(remaining - m, restRank);
  return [1, ...inner, 0, ...rest];
}

export function FinePathUnrank(n: number, rank: number): number[] {
  const total = FinePathCount(n);
  const r = total ? modRank(rank, total) : 0;
  return finePathUnrankFrom(n, r);
}

export function isFinePathOf(e: unknown, n: number): boolean {
  if (!IsDyckPath(e as number[], n)) return false;
  const path = e as number[];
  let i = 0;
  while (i < path.length) {
    let depth = 0;
    const start = i;
    do {
      depth += path[i] === 1 ? 1 : -1;
      i++;
    } while (depth > 0);
    if (i - start === 2) return false; // hill: an empty-inside U D block
  }
  return true;
}

export function finePathRankFrom(path: number[], remaining: number): number {
  if (remaining === 0) return 0;
  let depth = 0,
    end = 0;
  do {
    depth += path[end] === 1 ? 1 : -1;
    end++;
  } while (depth > 0);
  const m = end / 2;
  const inner = path.slice(1, end - 1);
  const rest = path.slice(end);
  let rank = 0;
  for (let mm = 2; mm < m; mm++) rank += CatalanNumber(mm - 1) * fineCount(remaining - mm);
  const restCount = fineCount(remaining - m);
  rank += DyckPathRank(inner) * restCount;
  rank += finePathRankFrom(rest, remaining - m);
  return rank;
}

export function FinePathRank(path: number[]): number {
  return finePathRankFrom(path, path.length / 2);
}

export const finePathsFast: FastKernel = {
  count: ([n]) => fineExact(n),
  unrank: ([n], r) => FinePathUnrank(n, r),
  valid: (e, [n]) => isFinePathOf(e, n),
  rank: (e) => FinePathRank(e as number[]),
};

// ─── RiordanPaths(n): Motzkin paths of length n (steps U=+1,L=0,D=-1) with no LEVEL step taken at
// height 0 — the Riordan numbers (1,0,1,1,3,6,15,36,...; A005043). completions(s,h) = ways to
// finish s steps from height h ending at 0, identical to the Motzkin recursion but with the level
// term dropped when h===0. ────────────────────────────────────────────────────────────────────
export const _riordanMemo = new Map<string, number>();

export function riordanCompletions(s: number, h: number): number {
  if (h < 0 || h > s) return 0;
  if (s === 0) return h === 0 ? 1 : 0;
  const key = `${s},${h}`;
  let v = _riordanMemo.get(key);
  if (v === undefined) {
    v =
      riordanCompletions(s - 1, h + 1) +
      (h > 0 ? riordanCompletions(s - 1, h) : 0) +
      (h > 0 ? riordanCompletions(s - 1, h - 1) : 0);
    _riordanMemo.set(key, v);
  }
  return v;
}

export function RiordanPathCount(n: number): number {
  return n < 0 ? 0 : riordanCompletions(n, 0);
}

/** rank-th Riordan path, steps tried U(1) then L(0, only if h>0) then D(-1). */
export function RiordanPathUnrank(n: number, rank: number): number[] {
  const total = RiordanPathCount(n);
  let r = total ? modRank(rank, total) : 0;
  const out: number[] = [];
  let h = 0;
  for (let s = n; s > 0; s--) {
    const up = riordanCompletions(s - 1, h + 1);
    if (r < up) {
      out.push(1);
      h++;
      continue;
    }
    r -= up;
    if (h > 0) {
      const lvl = riordanCompletions(s - 1, h);
      if (r < lvl) {
        out.push(0);
        continue;
      }
      r -= lvl;
    }
    out.push(-1);
    h--;
  }
  return out;
}

export function RiordanPathRank(path: number[]): number {
  let r = 0,
    h = 0;
  for (let i = 0; i < path.length; i++) {
    const s = path.length - i;
    const step = path[i];
    if (step === 1) {
      h++;
      continue;
    }
    r += riordanCompletions(s - 1, h + 1);
    if (step === 0) continue;
    if (h > 0) r += riordanCompletions(s - 1, h);
    h--;
  }
  return r;
}

export function isRiordanPathOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== n) return false;
  let h = 0;
  for (const s of e) {
    if (s !== -1 && s !== 0 && s !== 1) return false;
    if (s === 0 && h === 0) return false;
    h += s;
    if (h < 0) return false;
  }
  return h === 0;
}

export const riordanPathsFast: FastKernel = {
  count: ([n]) => riordanExact(n),
  unrank: ([n], r) => RiordanPathUnrank(n, r),
  rank: (e) => RiordanPathRank(e as number[]),
  valid: (e, [n]) => isRiordanPathOf(e, n),
};

// ─── GrandDyckPaths(n): free ±1-step paths of length 2n over up(1)/down(0), starting and ending at
// height 0, with NO non-negativity constraint. Count = C(2n,n): choose which n of the 2n
// positions are up-steps — a direct wrapper over KSubset{Count,Unrank,Rank} from kernels-extra.ts.
// Steps encoded 1=up/0=down, matching the DyckPaths convention (just without the height floor). ──
export function isGrandDyckPathOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== 2 * n) return false;
  let ones = 0;
  for (const s of e) {
    if (s !== 0 && s !== 1) return false;
    if (s === 1) ones++;
  }
  return ones === n;
}

export const grandDyckPathsFast: FastKernel = {
  count: ([n]) => KSubsetCount(2 * n, n),
  unrank: ([n], r) => {
    const ups = new Set(KSubsetUnrank(2 * n, n, r));
    return Array.from({ length: 2 * n }, (_, i) => (ups.has(i + 1) ? 1 : 0));
  },
  rank: (e) => {
    const path = e as number[];
    const ups: number[] = [];
    for (let i = 0; i < path.length; i++) if (path[i] === 1) ups.push(i + 1);
    return KSubsetRank(ups);
  },
  valid: (e, [n]) => isGrandDyckPathOf(e, n),
};
