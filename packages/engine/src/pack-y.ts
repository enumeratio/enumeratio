// pack-y.ts — pure-TS rank/unrank kernels for two combinatorial collections:
// KColoredCompositions(n,k) and CompositionsIntoParts12345(n). Self-contained: no imports, no I/O,
// plain JS numbers/arrays. See .scratch/pack-y-selfcert.mts for the exhaustive rank(unrank(p,r),p)===r
// certification plus an independent brute-force cross-check of count()/valid() (for KColoredCompositions,
// a from-scratch composition generator crossed with an independent cartesian-product color assignment —
// deliberately not reusing this file's DP table).

export type PackEntry = {
  head: string; // PascalCase MathJSON head, e.g. "KColoredCompositions"
  paramCount: 1 | 2; // number of integer parameters
  kind: "ints" | "blocks"; // element shape: flat int list, OR a list of int lists
  count: (p: number[]) => number; // p = [n] or [n,k]; closed recurrence
  unrank: (p: number[], r: number) => number[] | number[][]; // 0-based
  rank: (e: any, p: number[]) => number; // exact 0-based inverse of unrank
  valid: (e: any, p: number[]) => boolean; // is e a member of this collection at params p
};

const normRank = (r: number, total: number): number =>
  total > 0 ? (((Math.trunc(r) % total) + total) % total) : 0;

// ─── KColoredCompositions(n,k): compositions of n (ordered lists of parts >=1 summing to n) where each
// part additionally carries one of k colors (0..k-1). Element = list of [part,color] pairs. c(rem) =
// colored compositions of rem: c(0)=1 (the empty composition); for rem>=1, the first part is some
// v=1..rem painted one of k colors, followed by a colored composition of the rem-v left over, so
// c(rem) = k * sum_{v=1..rem} c(rem-v). (This DP telescopes to the closed form k*(k+1)^(n-1) for n>=1 —
// confirmed in selfcert against an independent brute-force enumeration, not assumed up front.) unrank
// walks the same split: try v=1..rem in order (a k*c(rem-v)-sized block each), then the color 0..k-1
// within that block (a c(rem-v)-sized sub-block each); rank replays the identical walk. ─────────────────

function kColoredTable(n: number, k: number): number[] {
  const c = new Array(n + 1).fill(0);
  c[0] = 1;
  for (let rem = 1; rem <= n; rem++) {
    let sum = 0;
    for (let v = 1; v <= rem; v++) sum += c[rem - v];
    c[rem] = k * sum;
  }
  return c;
}

function kColoredCompositionsCount(p: number[]): number {
  const n = p[0], k = p[1];
  if (n < 0 || k < 0) return 0;
  if (n === 0) return 1;
  return kColoredTable(n, k)[n];
}

function kColoredCompositionsUnrank(p: number[], r: number): number[][] {
  const n = p[0], k = p[1];
  if (n <= 0) return [];
  const c = kColoredTable(n, k);
  const total = c[n];
  if (total <= 0) return []; // k=0 (or otherwise no colorings): no members to unrank
  let rem = normRank(r, total);
  let left = n;
  const out: number[][] = [];
  while (left > 0) {
    for (let v = 1; v <= left; v++) {
      const sub = c[left - v];
      const block = k * sub;
      if (rem < block) {
        const color = Math.floor(rem / sub);
        rem -= color * sub;
        out.push([v, color]);
        left -= v;
        break;
      }
      rem -= block;
    }
  }
  return out;
}

function kColoredCompositionsRank(e: any, p: number[]): number {
  const n = p[0], k = p[1];
  if (n <= 0) return 0;
  const c = kColoredTable(n, k);
  const pairs = e as number[][];
  let left = n;
  let rank = 0;
  for (const pair of pairs) {
    const v = pair[0], color = pair[1];
    for (let vv = 1; vv < v; vv++) rank += k * c[left - vv];
    rank += color * c[left - v];
    left -= v;
  }
  return rank;
}

function kColoredCompositionsValid(e: any, p: number[]): boolean {
  const n = p[0], k = p[1];
  if (!Array.isArray(e)) return false;
  let sum = 0;
  for (const pair of e) {
    if (!Array.isArray(pair) || pair.length !== 2) return false;
    const v = pair[0], color = pair[1];
    if (!Number.isInteger(v) || v < 1) return false;
    if (!Number.isInteger(color) || color < 0 || color >= k) return false;
    sum += v;
  }
  return sum === n;
}

// ─── CompositionsIntoParts12345(n): compositions of n into parts drawn from {1,2,3,4,5} (order matters,
// parts may repeat). c(0)=1 (empty composition); for rem>=1, the first part is v=1..min(rem,5), so
// c(rem) = sum_{v=1..min(rem,5)} c(rem-v) — a pentanacci-style recurrence (1,1,2,4,8,16,31,61,120,236,...
// once rem>=5 there are always exactly 5 terms in the sum). unrank walks first-part choices v=1..
// min(left,5) in order (each a c(left-v)-sized block); rank replays the identical walk. ─────────────────

function parts12345Table(n: number): number[] {
  const c = new Array(n + 1).fill(0);
  c[0] = 1;
  for (let rem = 1; rem <= n; rem++) {
    let sum = 0;
    for (let v = 1; v <= Math.min(rem, 5); v++) sum += c[rem - v];
    c[rem] = sum;
  }
  return c;
}

function parts12345Count(p: number[]): number {
  const n = p[0];
  if (n < 0) return 0;
  return parts12345Table(n)[n];
}

function parts12345Unrank(p: number[], r: number): number[] {
  const n = p[0];
  if (n <= 0) return [];
  const c = parts12345Table(n);
  const total = c[n];
  let rem = normRank(r, total);
  let left = n;
  const out: number[] = [];
  while (left > 0) {
    for (let v = 1; v <= Math.min(left, 5); v++) {
      const block = c[left - v];
      if (rem < block) {
        out.push(v);
        left -= v;
        break;
      }
      rem -= block;
    }
  }
  return out;
}

function parts12345Rank(e: any, p: number[]): number {
  const n = p[0];
  if (n <= 0) return 0;
  const c = parts12345Table(n);
  const parts = e as number[];
  let left = n;
  let rank = 0;
  for (const v of parts) {
    for (let vv = 1; vv < v; vv++) rank += c[left - vv];
    left -= v;
  }
  return rank;
}

function parts12345Valid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  let sum = 0;
  for (const v of e) {
    if (!Number.isInteger(v) || v < 1 || v > 5) return false;
    sum += v;
  }
  return sum === n;
}

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "KColoredCompositions",
    paramCount: 2,
    kind: "blocks",
    count: kColoredCompositionsCount,
    unrank: kColoredCompositionsUnrank,
    rank: kColoredCompositionsRank,
    valid: kColoredCompositionsValid,
  },
  {
    head: "CompositionsIntoParts12345",
    paramCount: 1,
    kind: "ints",
    count: parts12345Count,
    unrank: parts12345Unrank,
    rank: parts12345Rank,
    valid: parts12345Valid,
  },
];
