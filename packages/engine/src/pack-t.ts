// pack-t.ts — pure-TS rank/unrank kernels for two combinatorial collections:
// StirlingPermutations(n) and CompositionsIntoParts1234(n). Self-contained: no
// imports, no I/O, plain JS numbers/arrays. See .scratch/pack-t-selfcert.mts
// for the exhaustive rank(unrank(p,r),p)===r certification, plus a brute-force
// cross-check for StirlingPermutations at n<=5.

export type PackEntry = {
  head: string; // PascalCase MathJSON head, e.g. "StirlingPermutations"
  paramCount: 1 | 2; // number of integer parameters
  kind: "ints" | "blocks"; // element shape: flat int list, OR a list of int lists
  count: (p: number[]) => number; // p = [n] or [n,k]; closed-form or DP count
  unrank: (p: number[], r: number) => number[] | number[][]; // 0-based
  rank: (e: any, p: number[]) => number; // exact 0-based inverse of unrank
  valid: (e: any, p: number[]) => boolean; // is e a member of this collection at params p
};

// ---- StirlingPermutations(n) ------------------------------------------------
// Permutations of the multiset {1,1,2,2,...,n,n} (length 2n) such that for
// every value i, all entries strictly between the two occurrences of i are
// strictly greater than i. Count = (2n-1)!! = 1*3*5*...*(2n-1)
// (n=0..: 1,1,3,15,105,945,10395,...).
//
// Recursive bijection: for the maximum value n, nothing exceeds n, so the
// "between the two n's must be > n" clause forces the two n's to be
// ADJACENT. Every Stirling permutation of order n therefore arises, uniquely,
// by taking a Stirling permutation of order n-1 (length 2n-2, so 2n-1 gaps
// including both ends) and splicing the block "n n" into exactly one gap.
// That's a bijection {0,...,(2n-3)!!-1} x {0,...,2n-2} -> {0,...,(2n-1)!!-1}
// via r = innerRank*(2n-1) + gapIndex (standard mixed-radix), so unrank and
// rank walk the identical decomposition and are exact inverses.

function stirlingCount(n: number): number {
  let result = 1;
  for (let i = 2 * n - 1; i >= 1; i -= 2) result *= i;
  return result; // n=0: no iterations, result=1
}

function stirlingUnrankInner(n: number, r: number): number[] {
  if (n === 0) return [];
  const gapCount = 2 * n - 1;
  const gapIndex = r % gapCount;
  const innerRank = Math.floor(r / gapCount);
  const inner = stirlingUnrankInner(n - 1, innerRank);
  const result = inner.slice(0, gapIndex);
  result.push(n, n);
  for (let i = gapIndex; i < inner.length; i++) result.push(inner[i]);
  return result;
}

function stirlingRankInner(e: number[], n: number): number {
  if (n === 0) return 0;
  let gapIndex = -1;
  for (let i = 0; i < e.length; i++) {
    if (e[i] === n) {
      gapIndex = i;
      break;
    }
  }
  const inner = e.slice(0, gapIndex).concat(e.slice(gapIndex + 2));
  const innerRank = stirlingRankInner(inner, n - 1);
  const gapCount = 2 * n - 1;
  return innerRank * gapCount + gapIndex;
}

function stirlingPermutationsCount(p: number[]): number {
  return stirlingCount(p[0]);
}

function stirlingPermutationsUnrank(p: number[], r: number): number[] {
  return stirlingUnrankInner(p[0], r);
}

function stirlingPermutationsRank(e: number[], p: number[]): number {
  return stirlingRankInner(e, p[0]);
}

function stirlingPermutationsValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e) || e.length !== 2 * n) return false;
  for (let i = 1; i <= n; i++) {
    let a = -1;
    let b = -1;
    for (let j = 0; j < e.length; j++) {
      if (e[j] === i) {
        if (a === -1) a = j;
        else if (b === -1) b = j;
        else return false; // a third occurrence of i
      }
    }
    if (a === -1 || b === -1) return false; // value i missing or appears once
    for (let k = a + 1; k < b; k++) if (e[k] <= i) return false;
  }
  return true;
}

// ---- CompositionsIntoParts1234(n) ------------------------------------------
// Compositions (ordered sequences) of n with every part in {1,2,3,4}.
// Count is the tetranacci-style recurrence c(n) = c(n-1)+c(n-2)+c(n-3)+c(n-4)
// for n>0, c(0)=1, c(negative)=0 (n=0..: 1,1,2,4,8,15,29,56,108,208,401,773,
// 1490,2872,5536,...).
//
// unrank/rank via digit-DP over the choice of first part v in {1,...,4}
// (only v<=n are legal): the number of completions after choosing v is
// c(n-v), so v is found by walking v=1,2,3,4 and subtracting block sizes
// c(n-v) from the running rank until it lands in the right block — the
// standard combinatorial-number-system pattern; rank walks the same blocks
// in the same order, so it is the exact inverse.

const compCountMemo = new Map<number, number>();

function compCount(n: number): number {
  if (n < 0) return 0;
  if (n === 0) return 1;
  const cached = compCountMemo.get(n);
  if (cached !== undefined) return cached;
  let total = 0;
  for (let v = 1; v <= 4; v++) total += compCount(n - v);
  compCountMemo.set(n, total);
  return total;
}

function compositionsIntoParts1234Count(p: number[]): number {
  return compCount(p[0]);
}

function compositionsIntoParts1234Unrank(p: number[], r: number): number[] {
  const n = p[0];
  const result: number[] = [];
  let rem = n;
  let rr = r;
  while (rem > 0) {
    let v = 1;
    for (; v <= Math.min(4, rem); v++) {
      const block = compCount(rem - v);
      if (rr < block) break;
      rr -= block;
    }
    result.push(v);
    rem -= v;
  }
  return result;
}

function compositionsIntoParts1234Rank(e: number[], p: number[]): number {
  let rem = p[0];
  let r = 0;
  for (const v of e) {
    for (let vv = 1; vv < v; vv++) r += compCount(rem - vv);
    rem -= v;
  }
  return r;
}

function compositionsIntoParts1234Valid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  let sum = 0;
  for (const v of e) {
    if (!Number.isInteger(v) || v < 1 || v > 4) return false;
    sum += v;
  }
  return sum === n;
}

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "StirlingPermutations",
    paramCount: 1,
    kind: "ints",
    count: stirlingPermutationsCount,
    unrank: stirlingPermutationsUnrank,
    rank: stirlingPermutationsRank,
    valid: stirlingPermutationsValid,
  },
  {
    head: "CompositionsIntoParts1234",
    paramCount: 1,
    kind: "ints",
    count: compositionsIntoParts1234Count,
    unrank: compositionsIntoParts1234Unrank,
    rank: compositionsIntoParts1234Rank,
    valid: compositionsIntoParts1234Valid,
  },
];
