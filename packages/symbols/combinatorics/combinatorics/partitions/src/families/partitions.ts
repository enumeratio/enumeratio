// Integer-partition families that were catalogued (packages/reference/entries/) but never
// wired to a kernel. One shape: "partitions of n with every part drawn from an allowed set S" — a
// generic DP builder (count by largest-allowed-part recurrence, unrank/rank in the same
// largest-part-first, weakly-decreasing order IntegerPartitions uses in ./core.ts), instantiated
// per family. Plus LargestPartPartitions, built on collections' kernels-extra.ts's PartitionsMaxPart (a
// partition of n−m with parts ≤ m, prefixed by m).
//
// Each is defined in Epsil (./walks.ts); the builders and kernels below are its `fast` path, in
// the same order, and the reading tests/fast-kernels.test.ts holds the definitions to.
//
// n = 0 always has exactly one (empty) partition, matching IntegerPartitions(0) in ./core.ts.
//
// KPartPartitions, BoundedPartPartitions and BoxConfinedPartitions are catalogued names for
// families ALREADY declared under other kernel heads (PartitionsIntoKParts / PartitionsMaxPart /
// PartitionsInBox, all in ./core.ts) — each one's own record says so ("Catalogued as an alias
// of ..." in its summary). No kernel here.
import type { EpsilFamily, FastKernel } from "../../../collections/src/families/epsil.ts";
import {
  PartitionsMaxPartCount,
  PartitionsMaxPartUnrank,
  PartitionsMaxPartRank,
  IsPartitionMaxPart,
} from "../../../collections/src/families/kernels-extra.ts";
import {
  largestPartPartitions,
  oddPartitions,
  primePartitions,
  squarePartitions,
  triangularPartitions,
} from "./walks.ts";

const sum = (parts: readonly number[]): number => parts.reduce((a, b) => a + b, 0);
const isPositiveIntArray = (e: unknown): e is number[] =>
  Array.isArray(e) && e.every((v) => Number.isInteger(v) && v >= 1);
const isWeaklyDecreasing = (parts: readonly number[]): boolean => parts.every((v, i) => i === 0 || parts[i - 1] >= v);

// ─── generic builder: partitions with every part drawn from an allowed set S ⊆ {1,2,…} ─────────
// count(m, cap) = #partitions of m with every part ≤ cap and in S. Recurrence splits on whether
// `cap` itself is used at least once — same shape as kernels-extra.ts's partsLeq/distinctParts,
// gated by `inSet`; unlike distinctParts, reusing `cap` (not `cap-1`) after placing it allows
// repeated parts. Order = largest possible next part first, which is exactly IntegerPartitions'
// weakly-decreasing, largest-part-first order restricted to S.
export function partsInSet(inSet: (s: number) => boolean) {
  const countMemo = new Map<string, number>();
  function count(m: number, cap: number): number {
    if (m === 0) return 1;
    if (m < 0 || cap <= 0) return 0;
    const key = `${m},${cap}`;
    const cached = countMemo.get(key);
    if (cached !== undefined) return cached;
    const v = count(m, cap - 1) + (inSet(cap) ? count(m - cap, cap) : 0);
    countMemo.set(key, v);
    return v;
  }
  function unrank(n: number, r: number): number[] {
    const total = count(n, n);
    let rr = total ? ((r % total) + total) % total : 0;
    const out: number[] = [];
    let rem = n;
    let cap = n;
    while (rem > 0) {
      for (let part = Math.min(rem, cap); part >= 1; part--) {
        if (!inSet(part)) continue;
        const c = count(rem - part, part);
        if (rr < c) {
          out.push(part);
          rem -= part;
          cap = part;
          break;
        }
        rr -= c;
      }
    }
    return out;
  }
  function rank(parts: readonly number[]): number {
    const sorted = [...parts];
    sorted.sort((a, b) => b - a);
    let r = 0;
    let rem = sum(sorted);
    let cap = rem;
    for (const part of sorted) {
      for (let v = Math.min(rem, cap); v > part; v--) if (inSet(v)) r += count(rem - v, v);
      rem -= part;
      cap = part;
    }
    return r;
  }
  function valid(parts: unknown, n: number): boolean {
    if (!isPositiveIntArray(parts)) return false;
    return sum(parts) === n && isWeaklyDecreasing(parts) && parts.every(inSet);
  }
  return { count: (m: number) => count(m, m), unrank, rank, valid };
}

const isOdd = (s: number) => s % 2 === 1;
const isSquare = (s: number) => Number.isInteger(Math.sqrt(s));
const isTriangular = (s: number) => Number.isInteger(Math.sqrt(8 * s + 1));
function isPrimeSmall(s: number): boolean {
  if (s < 2) return false;
  if (s % 2 === 0) return s === 2;
  for (let d = 3; d * d <= s; d += 2) if (s % d === 0) return false;
  return true;
}

const oddPart = partsInSet(isOdd);
const primePart = partsInSet(isPrimeSmall);
const squarePart = partsInSet(isSquare);
const triangularPart = partsInSet(isTriangular);

// ─── LargestPartPartitions(n, m): largest part exactly m, m ≥ 1 — [m, ...rest] where rest is a ─
// partition of n−m with every part ≤ m (PartitionsMaxPart). m = 0 only admits the empty
// partition of n = 0 (there is no largest part to be exactly 0 otherwise).
function largestPartCount(n: number, m: number): number {
  if (m === 0) return n === 0 ? 1 : 0;
  if (n < m) return 0;
  return PartitionsMaxPartCount(n - m, m);
}
function largestPartUnrank(n: number, m: number, r: number): number[] {
  if (m === 0) return [];
  const total = largestPartCount(n, m);
  const rr = total ? ((r % total) + total) % total : 0;
  return [m, ...PartitionsMaxPartUnrank(n - m, m, rr)];
}
function largestPartRank(parts: readonly number[], m: number): number {
  if (parts.length === 0) return 0;
  return PartitionsMaxPartRank(parts.slice(1), m);
}
function isLargestPart(parts: unknown, n: number, m: number): boolean {
  if (!Array.isArray(parts)) return false;
  if (m === 0) return n === 0 && parts.length === 0;
  if (parts.length === 0 || parts[0] !== m) return false;
  return sum(parts) === n && IsPartitionMaxPart(parts.slice(1), n - m, m);
}

const restricted = (family: EpsilFamily, builder: ReturnType<typeof partsInSet>): EpsilFamily => ({
  ...family,
  fast: {
    count: ([n]) => builder.count(n),
    unrank: ([n], r) => builder.unrank(n, r),
    rank: (x) => builder.rank(x as number[]),
    valid: (x, [n]) => builder.valid(x, n),
  },
});

const largestPartFast: FastKernel = {
  count: ([n, m]) => largestPartCount(n, m),
  unrank: ([n, m], r) => largestPartUnrank(n, m, r),
  rank: (x, [, m]) => largestPartRank(x as number[], m),
  valid: (x, [n, m]) => isLargestPart(x, n, m),
};

export const entries: EpsilFamily[] = [
  restricted(oddPartitions, oddPart),
  restricted(primePartitions, primePart),
  restricted(squarePartitions, squarePart),
  restricted(triangularPartitions, triangularPart),
  { ...largestPartPartitions, fast: largestPartFast },
];
