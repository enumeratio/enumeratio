// pack-f.ts — pure-TS rank/unrank kernels for three combinatorial collections:
// CompositionsIntoParts1And2(n), CompositionsIntoOddParts(n), and
// PartitionsIntoAtMostKParts(n,k). Self-contained: no imports, no I/O, plain
// JS numbers/arrays. See .scratch/pack-f-selfcert.mts for the exhaustive
// rank(unrank(p,r),p)===r certification.

export type PackEntry = {
  head: string; // PascalCase MathJSON head, e.g. "CompositionsIntoParts1And2"
  paramCount: 1 | 2; // number of integer parameters
  kind: "ints" | "blocks"; // element shape: flat int list, OR a list of int lists
  count: (p: number[]) => number; // p = [n] or [n,k]; closed-form or DP count
  unrank: (p: number[], r: number) => number[] | number[][]; // 0-based
  rank: (e: any, p: number[]) => number; // exact 0-based inverse of unrank
  valid: (e: any, p: number[]) => boolean; // is e a member of this collection at params p
};

// ---- CompositionsIntoParts1And2(n) -----------------------------------------
// Ordered compositions of n using only parts 1 and 2. Count = Fibonacci-style
// f(n): f(0)=1, f(1)=1, f(n)=f(n-1)+f(n-2) (f(2)=2, f(3)=3, f(4)=5, f(5)=8 —
// matches F(n+1) under the F(1)=F(2)=1 convention).
//
// unrank/rank via digit-DP on the FIRST part: from remaining sum `rem`,
// choosing part=1 leaves f(rem-1) completions; those ranks come first, then
// part=2's f(rem-2) completions. unrank and rank walk this same order, so
// they are exact inverses by construction.

function count12(n: number): number {
  if (n === 0) return 1;
  if (n === 1) return 1;
  let a = 1;
  let b = 1;
  for (let i = 2; i <= n; i++) {
    const c = a + b;
    a = b;
    b = c;
  }
  return b;
}

function compositions12Count(p: number[]): number {
  return count12(p[0]);
}

function compositions12Unrank(p: number[], r: number): number[] {
  let rem = p[0];
  let rr = r;
  const parts: number[] = [];
  while (rem > 0) {
    const c1 = count12(rem - 1);
    if (rr < c1) {
      parts.push(1);
      rem -= 1;
    } else {
      rr -= c1;
      parts.push(2);
      rem -= 2;
    }
  }
  return parts;
}

function compositions12Rank(e: number[], p: number[]): number {
  let rem = p[0];
  let rank = 0;
  for (const part of e) {
    const c1 = count12(rem - 1);
    if (part === 2) rank += c1;
    rem -= part;
  }
  return rank;
}

function compositions12Valid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  let sum = 0;
  for (const x of e) {
    if (x !== 1 && x !== 2) return false;
    sum += x;
  }
  return sum === n;
}

// ---- CompositionsIntoOddParts(n) -------------------------------------------
// Ordered compositions of n where every part is odd. Count g(n): g(0)=1
// (empty composition); g(n) for n>=1 = sum over odd k<=n of g(n-k). Matches
// Fibonacci F(n) under F(1)=F(2)=1 for n>=1 (g(1)=1,g(2)=1,g(3)=2,g(4)=3,
// g(5)=5,g(6)=8).
//
// unrank/rank via digit-DP on the FIRST part, trying odd k=1,3,5,... in
// increasing order — same completions-per-choice construction as above.

function countOdd(n: number, memo: Map<number, number>): number {
  if (n === 0) return 1;
  const cached = memo.get(n);
  if (cached !== undefined) return cached;
  let total = 0;
  for (let k = 1; k <= n; k += 2) total += countOdd(n - k, memo);
  memo.set(n, total);
  return total;
}

function compositionsOddCount(p: number[]): number {
  return countOdd(p[0], new Map());
}

function compositionsOddUnrank(p: number[], r: number): number[] {
  const memo = new Map<number, number>();
  let rem = p[0];
  let rr = r;
  const parts: number[] = [];
  while (rem > 0) {
    let chosen = -1;
    for (let k = 1; k <= rem; k += 2) {
      const c = countOdd(rem - k, memo);
      if (rr < c) {
        chosen = k;
        break;
      }
      rr -= c;
    }
    parts.push(chosen);
    rem -= chosen;
  }
  return parts;
}

function compositionsOddRank(e: number[], p: number[]): number {
  const memo = new Map<number, number>();
  let rem = p[0];
  let rank = 0;
  for (const part of e) {
    for (let k = 1; k < part; k += 2) rank += countOdd(rem - k, memo);
    rem -= part;
  }
  return rank;
}

function compositionsOddValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  let sum = 0;
  for (const x of e) {
    if (!Number.isInteger(x) || x < 1 || x % 2 === 0) return false;
    sum += x;
  }
  return sum === n;
}

// ---- PartitionsIntoAtMostKParts(n,k) ---------------------------------------
// Weakly-decreasing integer partitions of n with at most k parts. State
// c(n,k,m) = # partitions of n into at most k parts, each part <= m:
//   c(0,*,*) = 1
//   c(n,0,*) = c(n,*,0) = 0   for n>0
//   c(n,k,m) = sum_{v=1}^{min(n,m)} c(n-v, k-1, v)   (choose the largest
//     remaining part v first, then recurse with one fewer part slot and a
//     new cap of v so the result stays weakly decreasing)
// Top-level call uses m=n (a single part can be at most n). unrank/rank walk
// v=1..min(n,m) in the same order as the sum, so they are exact inverses.

function countAtMostK(n: number, k: number, m: number, memo: Map<string, number>): number {
  if (n === 0) return 1;
  if (k === 0 || m === 0) return 0;
  const key = n + "," + k + "," + m;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  const cap = Math.min(n, m);
  let total = 0;
  for (let v = 1; v <= cap; v++) total += countAtMostK(n - v, k - 1, v, memo);
  memo.set(key, total);
  return total;
}

function partitionsAtMostKCount(p: number[]): number {
  const [n, k] = p;
  return countAtMostK(n, k, n, new Map());
}

function partitionsAtMostKUnrank(p: number[], r: number): number[] {
  const [n, k] = p;
  const memo = new Map<string, number>();
  let rem = n;
  let curK = k;
  let curM = n;
  let rr = r;
  const parts: number[] = [];
  while (rem > 0) {
    const cap = Math.min(rem, curM);
    let chosen = -1;
    for (let v = 1; v <= cap; v++) {
      const c = countAtMostK(rem - v, curK - 1, v, memo);
      if (rr < c) {
        chosen = v;
        break;
      }
      rr -= c;
    }
    parts.push(chosen);
    rem -= chosen;
    curK -= 1;
    curM = chosen;
  }
  return parts;
}

function partitionsAtMostKRank(e: number[], p: number[]): number {
  const [n, k] = p;
  const memo = new Map<string, number>();
  let rem = n;
  let curK = k;
  let curM = n;
  let rank = 0;
  for (const part of e) {
    for (let v = 1; v < part; v++) rank += countAtMostK(rem - v, curK - 1, v, memo);
    rem -= part;
    curK -= 1;
    curM = part;
  }
  return rank;
}

function partitionsAtMostKValid(e: any, p: number[]): boolean {
  const [n, k] = p;
  if (!Array.isArray(e)) return false;
  if (e.length > k) return false;
  let sum = 0;
  for (let i = 0; i < e.length; i++) {
    const v = e[i];
    if (!Number.isInteger(v) || v < 1) return false;
    if (i > 0 && v > e[i - 1]) return false; // weakly decreasing
    sum += v;
  }
  return sum === n;
}

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "CompositionsIntoParts1And2",
    paramCount: 1,
    kind: "ints",
    count: compositions12Count,
    unrank: compositions12Unrank,
    rank: compositions12Rank,
    valid: compositions12Valid,
  },
  {
    head: "CompositionsIntoOddParts",
    paramCount: 1,
    kind: "ints",
    count: compositionsOddCount,
    unrank: compositionsOddUnrank,
    rank: compositionsOddRank,
    valid: compositionsOddValid,
  },
  {
    head: "PartitionsIntoAtMostKParts",
    paramCount: 2,
    kind: "ints",
    count: partitionsAtMostKCount,
    unrank: partitionsAtMostKUnrank,
    rank: partitionsAtMostKRank,
    valid: partitionsAtMostKValid,
  },
];
