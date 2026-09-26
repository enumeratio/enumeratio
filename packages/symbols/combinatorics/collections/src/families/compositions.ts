// Composition-carrier families that were catalogued (packages/reference/entries/) but
// never wired to a kernel. Two shapes here: (1) "parts drawn from an allowed set S" — one generic
// DP builder (count by subset-sum recurrence, unrank/rank by lexicographic block-counting),
// instantiated per family; (2) three families whose constraint isn't a per-part membership test
// (Carlitz: adjacent parts differ; Palindromic: a reversal symmetry; Zigzag: alternating parts),
// each with its own small DP or bijection.
//
// n = 0 always has exactly one (empty) composition, matching IntegerCompositions(0) in ./core.ts.
import type { NumberKernel } from "./types.ts";

// helper to cut boilerplate for the flat (number[]) shape; mirrors core.ts's private `ints`.
const ints = (
  head: string,
  paramCount: 1 | 2,
  count: (p: number[]) => number,
  unrank: (p: number[], r: number) => number[],
  valid: (e: number[], p: number[]) => boolean,
  rank: (e: number[], p: number[]) => number,
): NumberKernel => ({
  head,
  paramCount,
  kind: "ints",
  count,
  unrank,
  valid: (e, p) => valid(e as number[], p),
  rank: (e, p) => rank(e as number[], p),
});

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
const anyComp = partsInSet(() => true); // the unrestricted family; only used as the palindrome bijection's half

const kBoundedCache = new Map<number, ReturnType<typeof partsInSet>>();
function kBounded(k: number) {
  let b = kBoundedCache.get(k);
  if (!b) {
    b = partsInSet((s) => s <= k);
    kBoundedCache.set(k, b);
  }
  return b;
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

// ─── PalindromicCompositions(n): bijects with (an optional middle part, an arbitrary "half" ────
// composition) — the half is mirrored to build the other side. Odd length: middle m plus a half
// of h = (n−m)/2 (h = 0 gives the length-1 composition [m]). Even length: no middle, a half of
// h = n/2 (h ≥ 1, since h = 0 would mean n = 0, which is its own — already covered — empty case).
// Blocks are ordered by increasing middle value m = 1..n, then (if n is even) the no-middle block.
function palindromicCount(n: number): number {
  if (n === 0) return 1;
  let total = 0;
  for (let m = 1; m <= n; m++) if ((n - m) % 2 === 0) total += anyComp.count((n - m) / 2);
  if (n % 2 === 0) total += anyComp.count(n / 2);
  return total;
}
function palindromicUnrank(n: number, r: number): number[] {
  if (n === 0) return [];
  let rr = r;
  for (let m = 1; m <= n; m++) {
    if ((n - m) % 2 !== 0) continue;
    const h = (n - m) / 2;
    const c = anyComp.count(h);
    if (rr < c) {
      const left = anyComp.unrank(h, rr);
      return [...left, m, ...left.slice().reverse()];
    }
    rr -= c;
  }
  if (n % 2 === 0) {
    const h = n / 2;
    const c = anyComp.count(h);
    if (rr < c) {
      const left = anyComp.unrank(h, rr);
      return [...left, ...left.slice().reverse()];
    }
  }
  throw new Error("PalindromicCompositions: rank out of range");
}
function palindromicRank(parts: readonly number[], n: number): number {
  const len = parts.length;
  let rank = 0;
  if (len % 2 === 1) {
    const mid = (len - 1) / 2;
    const m = parts[mid];
    for (let mm = 1; mm < m; mm++) if ((n - mm) % 2 === 0) rank += anyComp.count((n - mm) / 2);
    rank += anyComp.rank(parts.slice(0, mid));
    return rank;
  }
  for (let mm = 1; mm <= n; mm++) if ((n - mm) % 2 === 0) rank += anyComp.count((n - mm) / 2);
  rank += anyComp.rank(parts.slice(0, len / 2));
  return rank;
}
function isPalindromic(parts: unknown, n: number): boolean {
  if (!isPositiveIntArray(parts)) return false;
  if (sum(parts) !== n) return false;
  for (let i = 0, j = parts.length - 1; i < j; i++, j--) if (parts[i] !== parts[j]) return false;
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

export const entries: NumberKernel[] = [
  // ── parts drawn from an allowed set S ──
  ints(
    "OddCompositions",
    1,
    ([n]) => oddComp.count(n),
    ([n], r) => oddComp.unrank(n, r),
    (a, [n]) => oddComp.valid(a, n),
    (a) => oddComp.rank(a),
  ),
  ints(
    "ProperCompositions",
    1,
    ([n]) => properComp.count(n),
    ([n], r) => properComp.unrank(n, r),
    (a, [n]) => properComp.valid(a, n),
    (a) => properComp.rank(a),
  ),
  ints(
    "DyadicCompositions",
    1,
    ([n]) => dyadicComp.count(n),
    ([n], r) => dyadicComp.unrank(n, r),
    (a, [n]) => dyadicComp.valid(a, n),
    (a) => dyadicComp.rank(a),
  ),
  ints(
    "FibonacciCompositions",
    1,
    ([n]) => fibComp.count(n),
    ([n], r) => fibComp.unrank(n, r),
    (a, [n]) => fibComp.valid(a, n),
    (a) => fibComp.rank(a),
  ),
  ints(
    "TriCompositions",
    1,
    ([n]) => triComp.count(n),
    ([n], r) => triComp.unrank(n, r),
    (a, [n]) => triComp.valid(a, n),
    (a) => triComp.rank(a),
  ),
  ints(
    "TetraCompositions",
    1,
    ([n]) => tetraComp.count(n),
    ([n], r) => tetraComp.unrank(n, r),
    (a, [n]) => tetraComp.valid(a, n),
    (a) => tetraComp.rank(a),
  ),
  ints(
    "TriangularCompositions",
    1,
    ([n]) => triangularComp.count(n),
    ([n], r) => triangularComp.unrank(n, r),
    (a, [n]) => triangularComp.valid(a, n),
    (a) => triangularComp.rank(a),
  ),
  ints(
    "PrimeCompositions",
    1,
    ([n]) => primeComp.count(n),
    ([n], r) => primeComp.unrank(n, r),
    (a, [n]) => primeComp.valid(a, n),
    (a) => primeComp.rank(a),
  ),
  ints(
    "KBoundedCompositions",
    2,
    ([n, k]) => kBounded(k).count(n),
    ([n, k], r) => kBounded(k).unrank(n, r),
    (a, [n, k]) => kBounded(k).valid(a, n),
    (a, [, k]) => kBounded(k).rank(a),
  ),

  // ── constraints beyond per-part membership ──
  ints(
    "CarlitzCompositions",
    1,
    ([n]) => carlitzCount(n, 0),
    ([n], r) => carlitzUnrank(n, 0, r),
    (a, [n]) => isCarlitz(a, n),
    (a) => carlitzRank(a),
  ),
  ints(
    "PalindromicCompositions",
    1,
    ([n]) => palindromicCount(n),
    ([n], r) => palindromicUnrank(n, r),
    (a, [n]) => isPalindromic(a, n),
    (a, [n]) => palindromicRank(a, n),
  ),
  ints(
    "ZigzagCompositions",
    1,
    ([n]) => zigzagCount(n),
    ([n], r) => zigzagUnrank(n, r),
    (a, [n]) => isZigzag(a, n),
    (a) => zigzagRank(a),
  ),
];
