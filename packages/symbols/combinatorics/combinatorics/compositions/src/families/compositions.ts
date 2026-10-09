// Composition-carrier families that were catalogued (packages/reference/entries/) but
// never wired to a kernel. Two shapes here: (1) "parts drawn from an allowed set S" — one generic
// DP builder (count by subset-sum recurrence, unrank/rank by lexicographic block-counting),
// instantiated per family; (2) families whose constraint isn't a per-part membership test
// (Carlitz: adjacent parts differ; Zigzag: alternating parts), each with its own small DP.
//
// Each is defined in Epsil (./walks.ts); the builders and kernels below are its `fast` path, in
// the same order, and the reading tests/fast-kernels.test.ts holds the definitions to.
// PalindromicCompositions has none: its TS kernel sorts a list of about 2^(n/2) palindromes
// per n, where the definition walks the halves directly.
//
// n = 0 always has exactly one (empty) composition, matching IntegerCompositions(0) in ./core.ts.
import type { EpsilFamily, FastKernel } from "../../../collections/src/families/epsil.ts";
import {
  carlitzCompositions,
  dyadicCompositions,
  fibonacciCompositions,
  oddCompositions,
  palindromicCompositions,
  partCountBoundedCompositions,
  partSizeBoundedCompositions,
  primeCompositions,
  properCompositions,
  tetraCompositions,
  triCompositions,
  triangularCompositions,
  zigzagCompositions,
} from "./walks.ts";

const sum = (parts: readonly number[]): number => parts.reduce((a, b) => a + b, 0);
const isPositiveIntArray = (e: unknown): e is number[] =>
  Array.isArray(e) && e.every((v) => Number.isInteger(v) && v >= 1);

// ─── generic builder: compositions with every part drawn from an allowed set S ⊆ {1,2,…} ──────
// count(0) = 1 (empty composition); count(m) = Σ_{s∈S, s≤m} count(m−s). unrank/rank walk the
// same recurrence in ascending part order, which is exactly lexicographic order on the sequence.
function partsInSet(inSet: (s: number) => boolean) {
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

const isOdd = (s: number) => s % 2 === 1;
const isPowerOfTwo = (s: number) => (s & (s - 1)) === 0;
const isTriangular = (s: number) => {
  const r = Math.sqrt(8 * s + 1);
  return Number.isInteger(r); // 8s+1 is always odd, so an integer root is automatically odd too
};
function isPrimeSmall(s: number): boolean {
  if (s < 2) return false;
  if (s % 2 === 0) return s === 2;
  for (let d = 3; d * d <= s; d += 2) if (s % d === 0) return false;
  return true;
}

const oddComp = partsInSet(isOdd);
const properComp = partsInSet((s) => s >= 2);
const dyadicComp = partsInSet(isPowerOfTwo);
const fibComp = partsInSet((s) => s === 1 || s === 2);
const triComp = partsInSet((s) => s >= 1 && s <= 3);
const tetraComp = partsInSet((s) => s >= 1 && s <= 4);
const triangularComp = partsInSet(isTriangular);
const primeComp = partsInSet(isPrimeSmall);

const partSizeBoundedCache = new Map<number, ReturnType<typeof partsInSet>>();
function partSizeBounded(k: number) {
  let b = partSizeBoundedCache.get(k);
  if (!b) {
    b = partsInSet((s) => s <= k);
    partSizeBoundedCache.set(k, b);
  }
  return b;
}

// ─── PartCountBoundedCompositions(n, k): at most k parts. count(m, j) = compositions of m into at most
// j parts = Σ_s count(m − s, j − 1), with count(0, ·) = 1 (the empty composition) and count(m > 0, 0) = 0.
// unrank/rank walk the same recurrence in ascending first part: lexicographic order.
const partCountMemo = new Map<string, number>();
function partCountCount(m: number, j: number): number {
  if (m === 0) return 1;
  if (j === 0) return 0;
  const key = `${m},${j}`;
  const cached = partCountMemo.get(key);
  if (cached !== undefined) return cached;
  let total = 0;
  for (let s = 1; s <= m; s++) total += partCountCount(m - s, j - 1);
  partCountMemo.set(key, total);
  return total;
}
function partCountUnrank(m: number, j: number, r: number): number[] {
  if (m === 0) return [];
  let rr = r;
  for (let s = 1; s <= m; s++) {
    const c = partCountCount(m - s, j - 1);
    if (rr < c) return [s, ...partCountUnrank(m - s, j - 1, rr)];
    rr -= c;
  }
  throw new Error("PartCountBoundedCompositions: rank out of range");
}
function partCountRank(parts: readonly number[], k: number): number {
  let r = 0;
  let m = sum(parts);
  let j = k;
  for (const s of parts) {
    for (let t = 1; t < s; t++) r += partCountCount(m - t, j - 1);
    m -= s;
    j -= 1;
  }
  return r;
}

// ─── CarlitzCompositions(n): no two equal ADJACENT parts. DP over (remaining, previous part), ──
// previous = 0 (no part yet) allows any first part. count(0, ·) = 1 handles n = 0 with no
// special-case: the empty composition has no adjacent pair to violate.
const carlitzMemo = new Map<string, number>();
function carlitzCount(remaining: number, prev: number): number {
  if (remaining === 0) return 1;
  const key = `${remaining},${prev}`;
  const cached = carlitzMemo.get(key);
  if (cached !== undefined) return cached;
  let total = 0;
  for (let q = 1; q <= remaining; q++) if (q !== prev) total += carlitzCount(remaining - q, q);
  carlitzMemo.set(key, total);
  return total;
}
function carlitzUnrank(remaining: number, prev: number, r: number): number[] {
  if (remaining === 0) return [];
  let rr = r;
  for (let q = 1; q <= remaining; q++) {
    if (q === prev) continue;
    const c = carlitzCount(remaining - q, q);
    if (rr < c) return [q, ...carlitzUnrank(remaining - q, q, rr)];
    rr -= c;
  }
  throw new Error("CarlitzCompositions: rank out of range");
}
function carlitzRank(parts: readonly number[]): number {
  let r = 0;
  let remaining = sum(parts);
  let prev = 0;
  for (const q of parts) {
    for (let t = 1; t < q; t++) if (t !== prev) r += carlitzCount(remaining - t, t);
    remaining -= q;
    prev = q;
  }
  return r;
}
function isCarlitz(parts: unknown, n: number): boolean {
  if (!isPositiveIntArray(parts)) return false;
  if (sum(parts) !== n) return false;
  for (let i = 0; i + 1 < parts.length; i++) if (parts[i] === parts[i + 1]) return false;
  return true;
}

// ─── ZigzagCompositions(n): A025047 — alternating compositions, either starting direction, ──────
// counting BOTH a1<a2>a3<… and a1>a2<a3>… (offset 0, a(0)=1 the empty composition, a(1)=1 the
// single part, a(2)=1 since [1,1] is flat — confirmed against the OEIS b-file). DP state is
// (remaining, previous part, what the NEXT comparison must be): "start" (no part placed),
// "free" (one part placed, direction not yet fixed), or "up"/"down" (direction fixed, alternates
// every step).
type ZState = "start" | "free" | "up" | "down";
const zigzagMemo = new Map<string, number>();
function zigzagSuffix(remaining: number, prev: number, state: ZState): number {
  if (remaining === 0) return 1;
  const key = `${remaining},${prev},${state}`;
  const cached = zigzagMemo.get(key);
  if (cached !== undefined) return cached;
  let total = 0;
  if (state === "start") {
    for (let p = 1; p <= remaining; p++) total += zigzagSuffix(remaining - p, p, "free");
  } else if (state === "free") {
    for (let q = 1; q <= remaining; q++)
      if (q !== prev) total += zigzagSuffix(remaining - q, q, q > prev ? "down" : "up");
  } else if (state === "up") {
    for (let q = prev + 1; q <= remaining; q++) total += zigzagSuffix(remaining - q, q, "down");
  } else {
    for (let q = 1; q < prev && q <= remaining; q++) total += zigzagSuffix(remaining - q, q, "up");
  }
  zigzagMemo.set(key, total);
  return total;
}
function zigzagCount(n: number): number {
  return n === 0 ? 1 : zigzagSuffix(n, 0, "start");
}
function zigzagUnrankSuffix(remaining: number, prev: number, state: ZState, r: number): number[] {
  if (remaining === 0) return [];
  let rr = r;
  if (state === "start") {
    for (let p = 1; p <= remaining; p++) {
      const c = zigzagSuffix(remaining - p, p, "free");
      if (rr < c) return [p, ...zigzagUnrankSuffix(remaining - p, p, "free", rr)];
      rr -= c;
    }
  } else if (state === "free") {
    for (let q = 1; q <= remaining; q++) {
      if (q === prev) continue;
      const next = q > prev ? "down" : "up";
      const c = zigzagSuffix(remaining - q, q, next);
      if (rr < c) return [q, ...zigzagUnrankSuffix(remaining - q, q, next, rr)];
      rr -= c;
    }
  } else if (state === "up") {
    for (let q = prev + 1; q <= remaining; q++) {
      const c = zigzagSuffix(remaining - q, q, "down");
      if (rr < c) return [q, ...zigzagUnrankSuffix(remaining - q, q, "down", rr)];
      rr -= c;
    }
  } else {
    for (let q = 1; q < prev && q <= remaining; q++) {
      const c = zigzagSuffix(remaining - q, q, "up");
      if (rr < c) return [q, ...zigzagUnrankSuffix(remaining - q, q, "up", rr)];
      rr -= c;
    }
  }
  throw new Error("ZigzagCompositions: rank out of range");
}
function zigzagUnrank(n: number, r: number): number[] {
  return n === 0 ? [] : zigzagUnrankSuffix(n, 0, "start", r);
}
function zigzagRank(parts: readonly number[]): number {
  const len = parts.length;
  if (len === 0) return 0;
  let rank = 0;
  let remaining = sum(parts);
  const p = parts[0];
  for (let pp = 1; pp < p; pp++) rank += zigzagSuffix(remaining - pp, pp, "free");
  remaining -= p;
  let prev = p;
  let state: ZState = "free";
  for (let i = 1; i < len; i++) {
    const q = parts[i];
    if (state === "free") {
      for (let qq = 1; qq < q; qq++)
        if (qq !== prev) rank += zigzagSuffix(remaining - qq, qq, qq > prev ? "down" : "up");
      state = q > prev ? "down" : "up";
    } else if (state === "up") {
      for (let qq = prev + 1; qq < q; qq++) rank += zigzagSuffix(remaining - qq, qq, "down");
      state = "down";
    } else {
      for (let qq = 1; qq < q; qq++) rank += zigzagSuffix(remaining - qq, qq, "up");
      state = "up";
    }
    remaining -= q;
    prev = q;
  }
  return rank;
}
function isZigzag(parts: unknown, n: number): boolean {
  if (!isPositiveIntArray(parts)) return n === 0 && Array.isArray(parts) && parts.length === 0;
  if (sum(parts) !== n) return false;
  if (parts.length <= 1) return true;
  let expected: "up" | "down" | null = null;
  for (let i = 0; i + 1 < parts.length; i++) {
    if (parts[i] === parts[i + 1]) return false;
    const rel = parts[i] < parts[i + 1] ? "up" : "down";
    if (expected !== null && rel !== expected) return false;
    expected = rel === "up" ? "down" : "up";
  }
  return true;
}

const inSet = (family: EpsilFamily, builder: ReturnType<typeof partsInSet>): EpsilFamily => ({
  ...family,
  fast: {
    count: ([n]) => builder.count(n),
    unrank: ([n], r) => builder.unrank(n, r),
    rank: (x) => builder.rank(x as number[]),
    valid: (x, [n]) => builder.valid(x, n),
  },
});

const partSizeBoundedFast: FastKernel = {
  count: ([n, k]) => partSizeBounded(k).count(n),
  unrank: ([n, k], r) => partSizeBounded(k).unrank(n, r),
  rank: (x, [, k]) => partSizeBounded(k).rank(x as number[]),
  valid: (x, [n, k]) => partSizeBounded(k).valid(x, n),
};
const partCountBoundedFast: FastKernel = {
  count: ([n, k]) => partCountCount(n, k),
  unrank: ([n, k], r) => partCountUnrank(n, k, r),
  rank: (x, [, k]) => partCountRank(x as number[], k),
  valid: (x, [n, k]) => isPositiveIntArray(x) && sum(x) === n && x.length <= k,
};
const carlitzFast: FastKernel = {
  count: ([n]) => carlitzCount(n, 0),
  unrank: ([n], r) => carlitzUnrank(n, 0, r),
  rank: (x) => carlitzRank(x as number[]),
  valid: (x, [n]) => isCarlitz(x, n),
};
const zigzagFast: FastKernel = {
  count: ([n]) => zigzagCount(n),
  unrank: ([n], r) => zigzagUnrank(n, r),
  rank: (x) => zigzagRank(x as number[]),
  valid: (x, [n]) => isZigzag(x, n),
};

export const entries: EpsilFamily[] = [
  // ── parts drawn from an allowed set S ──
  inSet(oddCompositions, oddComp),
  inSet(properCompositions, properComp),
  inSet(dyadicCompositions, dyadicComp),
  inSet(fibonacciCompositions, fibComp),
  inSet(triCompositions, triComp),
  inSet(tetraCompositions, tetraComp),
  inSet(triangularCompositions, triangularComp),
  inSet(primeCompositions, primeComp),
  { ...partSizeBoundedCompositions, fast: partSizeBoundedFast },
  { ...partCountBoundedCompositions, fast: partCountBoundedFast },

  // ── constraints beyond per-part membership ──
  { ...carlitzCompositions, fast: carlitzFast },
  palindromicCompositions,
  { ...zigzagCompositions, fast: zigzagFast },
];
