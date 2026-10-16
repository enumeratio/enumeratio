// Moved out of the runtime by BL-225: kernels only tests/readings and the agreement tests use.
import { type FastKernel } from "../../../collections/src/families/epsil.ts";
import { isPositiveIntArray, sum } from "../../../compositions/src/families/compositions.ts";

// ─── generic builder: compositions with every part drawn from an allowed set S ⊆ {1,2,…} ──────
// count(0) = 1 (empty composition); count(m) = Σ_{s∈S, s≤m} count(m−s). unrank/rank walk the
// same recurrence in ascending part order, which is exactly lexicographic order on the sequence.
export function partsInSet(inSet: (s: number) => boolean) {
  const countMemo = new Map<number, number>();
  function count(m: number): number {
    if (m === 0) return 1;
    if (m < 0) return 0;
    const cached = countMemo.get(m);
    if (cached !== undefined) return cached;
    let total = 0;
    for (let s = 1; s <= m; s++) if (inSet(s)) total += count(m - s);
    countMemo.set(m, total);
    return total;
  }
  function unrank(m: number, r: number): number[] {
    if (m === 0) return [];
    let rr = r;
    for (let s = 1; s <= m; s++) {
      if (!inSet(s)) continue;
      const c = count(m - s);
      if (rr < c) return [s, ...unrank(m - s, rr)];
      rr -= c;
    }
    throw new Error("partsInSet: rank out of range");
  }
  function rank(parts: readonly number[]): number {
    let r = 0;
    let m = sum(parts);
    for (const s of parts) {
      for (let t = 1; t < s; t++) if (inSet(t)) r += count(m - t);
      m -= s;
    }
    return r;
  }
  function valid(parts: unknown, n: number): boolean {
    if (!isPositiveIntArray(parts)) return false;
    return sum(parts) === n && parts.every(inSet);
  }
  return { count, unrank, rank, valid };
}

export const partSizeBoundedCache = new Map<number, ReturnType<typeof partsInSet>>();

export function partSizeBounded(k: number) {
  let b = partSizeBoundedCache.get(k);
  if (!b) {
    b = partsInSet((s) => s <= k);
    partSizeBoundedCache.set(k, b);
  }
  return b;
}

export const partSizeBoundedFast: FastKernel = {
  count: ([n, k]) => partSizeBounded(k).count(n),
  unrank: ([n, k], r) => partSizeBounded(k).unrank(n, r),
  rank: (x, [, k]) => partSizeBounded(k).rank(x as number[]),
  valid: (x, [n, k]) => partSizeBounded(k).valid(x, n),
};

export function isPrimeSmall(s: number): boolean {
  if (s < 2) return false;
  if (s % 2 === 0) return s === 2;
  for (let d = 3; d * d <= s; d += 2) if (s % d === 0) return false;
  return true;
}

export const primeComp = partsInSet(isPrimeSmall);

export const isTriangular = (s: number) => {
  const r = Math.sqrt(8 * s + 1);
  return Number.isInteger(r); // 8s+1 is always odd, so an integer root is automatically odd too
};

export const triangularComp = partsInSet(isTriangular);

export const tetraComp = partsInSet((s) => s >= 1 && s <= 4);

export const triComp = partsInSet((s) => s >= 1 && s <= 3);

export const fibComp = partsInSet((s) => s === 1 || s === 2);

export const isPowerOfTwo = (s: number) => (s & (s - 1)) === 0;

export const dyadicComp = partsInSet(isPowerOfTwo);

export const properComp = partsInSet((s) => s >= 2);

export const isOdd = (s: number) => s % 2 === 1;

export const oddComp = partsInSet(isOdd);
