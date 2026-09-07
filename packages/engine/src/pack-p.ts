// pack-p.ts — pure-TS rank/unrank kernels for two combinatorial collections:
// PermutationsAvoiding123(n) and PermutationsAvoiding213(n). Self-contained: no imports,
// no I/O, plain JS numbers/arrays. Both classes are Catalan(n)-counted (all six length-3
// patterns are). See .scratch/pack-p-selfcert.mts for the exhaustive rank(unrank(p,r),p)===r
// certification plus an independent brute-force (generate-all-n!-permutations-and-filter)
// cross-check of count()/valid()/unrank-set-equality.

export type PackEntry = {
  head: string; // PascalCase MathJSON head, e.g. "PermutationsAvoiding123"
  paramCount: 1 | 2; // number of integer parameters
  kind: "ints" | "blocks"; // element shape: flat int list, OR a list of int lists
  count: (p: number[]) => number; // p = [n]; closed recurrence
  unrank: (p: number[], r: number) => number[] | number[][]; // 0-based
  rank: (e: any, p: number[]) => number; // exact 0-based inverse of unrank
  valid: (e: any, p: number[]) => boolean; // is e a member of this collection at params p
};

const normRank = (r: number, total: number): number =>
  total > 0 ? (((Math.trunc(r) % total) + total) % total) : 0;

// ─── generic "lex + prefix-counting" avoidance engine, shared by both collections below. Elements are
// built position-by-position in increasing-value order (the standard 1-indexed one-line notation of a
// permutation of [n]); `creates(prefix, v)` decides whether appending v to an already-pattern-free prefix
// introduces the forbidden pattern. Since the prefix is an invariant-maintained pattern-free sequence, a
// new violation can only involve v as the LAST (highest-position) of the three participating values, so
// `creates` only has to scan pairs within the existing prefix — no need to re-scan older triples. unrank
// walks candidates smallest-first, counting how many pattern-free completions each choice admits
// (countAvoiding) and descending into the block containing the target rank; rank replays the identical
// walk, accumulating the sizes of every block skipped before the actual next value is reached. This route
// is guaranteed correct as long as `creates` correctly detects the pattern (validated below against an
// independent brute-force generate-all-n!-permutations-and-filter oracle). ───────────────────────────────

type CreatesFn = (prefix: number[], v: number) => boolean;

// Appending v after prefix forms a 123 pattern iff some earlier ascent (prefix[i] < prefix[j], i<j) tops
// out below v — i.e. prefix[i] < prefix[j] < v.
function createsPattern123(prefix: number[], v: number): boolean {
  for (let i = 0; i < prefix.length; i++) {
    for (let j = i + 1; j < prefix.length; j++) {
      if (prefix[i] < prefix[j] && prefix[j] < v) return true;
    }
  }
  return false;
}

// Appending v after prefix forms a 213 pattern iff some earlier descent (prefix[j] < prefix[i], i<j) has
// its larger member below v — i.e. prefix[j] < prefix[i] < v (so (prefix[i],prefix[j],v) reduces to 2,1,3).
function createsPattern213(prefix: number[], v: number): boolean {
  for (let i = 0; i < prefix.length; i++) {
    for (let j = i + 1; j < prefix.length; j++) {
      if (prefix[j] < prefix[i] && prefix[i] < v) return true;
    }
  }
  return false;
}

// Count pattern-free completions of `prefix` using exactly the values in `remaining` (any order).
function countAvoiding(prefix: number[], remaining: number[], creates: CreatesFn): number {
  if (remaining.length === 0) return 1;
  let total = 0;
  for (let idx = 0; idx < remaining.length; idx++) {
    const v = remaining[idx];
    if (creates(prefix, v)) continue;
    const nextRemaining = remaining.slice(0, idx).concat(remaining.slice(idx + 1));
    total += countAvoiding([...prefix, v], nextRemaining, creates);
  }
  return total;
}

function avoidingCount(n: number, creates: CreatesFn): number {
  if (n < 0) return 0;
  if (n === 0) return 1;
  const universe: number[] = [];
  for (let i = 1; i <= n; i++) universe.push(i);
  return countAvoiding([], universe, creates);
}

function avoidingUnrank(n: number, r: number, creates: CreatesFn): number[] {
  const total = avoidingCount(n, creates);
  let rr = normRank(r, total);
  let prefix: number[] = [];
  let remaining: number[] = [];
  for (let i = 1; i <= n; i++) remaining.push(i);
  while (remaining.length > 0) {
    let chosen = false;
    for (let idx = 0; idx < remaining.length; idx++) {
      const v = remaining[idx];
      if (creates(prefix, v)) continue;
      const nextRemaining = remaining.slice(0, idx).concat(remaining.slice(idx + 1));
      const block = countAvoiding([...prefix, v], nextRemaining, creates);
      if (rr < block) {
        prefix = [...prefix, v];
        remaining = nextRemaining;
        chosen = true;
        break;
      }
      rr -= block;
    }
    if (!chosen) throw new Error(`avoidingUnrank: rank out of range (n=${n})`);
  }
  return prefix;
}

function avoidingRank(perm: number[], creates: CreatesFn): number {
  const n = perm.length;
  let prefix: number[] = [];
  let remaining: number[] = [];
  for (let i = 1; i <= n; i++) remaining.push(i);
  let rank = 0;
  for (let pos = 0; pos < n; pos++) {
    const v = perm[pos];
    for (let idx = 0; idx < remaining.length; idx++) {
      const c = remaining[idx];
      if (c === v) break; // reached the actual choice at this position; stop tallying skipped blocks
      if (creates(prefix, c)) continue; // c could never have been chosen here — zero-size block
      const nextRemaining = remaining.slice(0, idx).concat(remaining.slice(idx + 1));
      rank += countAvoiding([...prefix, c], nextRemaining, creates);
    }
    const vIdx = remaining.indexOf(v);
    remaining = remaining.slice(0, vIdx).concat(remaining.slice(vIdx + 1));
    prefix = [...prefix, v];
  }
  return rank;
}

function avoidingValid(e: any, n: number, creates: CreatesFn): boolean {
  if (!Array.isArray(e) || e.length !== n) return false;
  const seen = new Set<number>();
  for (const x of e) {
    if (typeof x !== "number" || !Number.isInteger(x) || x < 1 || x > n || seen.has(x)) return false;
    seen.add(x);
  }
  for (let k = 0; k < e.length; k++) {
    if (creates(e.slice(0, k), e[k])) return false;
  }
  return true;
}

// ─── PermutationsAvoiding123(n): permutations of [n] (1-indexed one-line notation) with no increasing
// subsequence of length 3, i.e. no i<j<k with perm[i]<perm[j]<perm[k]. Count = Catalan(n). ───────────────

function permutationsAvoiding123Count(p: number[]): number {
  return avoidingCount(p[0], createsPattern123);
}
function permutationsAvoiding123Unrank(p: number[], r: number): number[] {
  return avoidingUnrank(p[0], r, createsPattern123);
}
function permutationsAvoiding123Rank(e: any, _p: number[]): number {
  return avoidingRank(e as number[], createsPattern123);
}
function permutationsAvoiding123Valid(e: any, p: number[]): boolean {
  return avoidingValid(e, p[0], createsPattern123);
}

// ─── PermutationsAvoiding213(n): permutations of [n] (1-indexed one-line notation) avoiding the pattern
// 213, i.e. no i<j<k with perm[j]<perm[i]<perm[k]. Count = Catalan(n). ─────────────────────────────────

function permutationsAvoiding213Count(p: number[]): number {
  return avoidingCount(p[0], createsPattern213);
}
function permutationsAvoiding213Unrank(p: number[], r: number): number[] {
  return avoidingUnrank(p[0], r, createsPattern213);
}
function permutationsAvoiding213Rank(e: any, _p: number[]): number {
  return avoidingRank(e as number[], createsPattern213);
}
function permutationsAvoiding213Valid(e: any, p: number[]): boolean {
  return avoidingValid(e, p[0], createsPattern213);
}

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "PermutationsAvoiding123",
    paramCount: 1,
    kind: "ints",
    count: permutationsAvoiding123Count,
    unrank: permutationsAvoiding123Unrank,
    rank: permutationsAvoiding123Rank,
    valid: permutationsAvoiding123Valid,
  },
  {
    head: "PermutationsAvoiding213",
    paramCount: 1,
    kind: "ints",
    count: permutationsAvoiding213Count,
    unrank: permutationsAvoiding213Unrank,
    rank: permutationsAvoiding213Rank,
    valid: permutationsAvoiding213Valid,
  },
];
