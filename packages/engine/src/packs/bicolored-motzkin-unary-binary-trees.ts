// pack-o.ts — pure-TS rank/unrank kernels for two combinatorial collections:
// BicoloredMotzkinPaths(n) and UnaryBinaryTrees(n). Self-contained: no imports,
// no I/O, plain JS numbers/arrays. See .scratch/pack-o-selfcert.mts for the
// exhaustive rank(unrank(p,r),p)===r certification plus an independent
// brute-force cross-check of count()/valid() over n=0..8.

export type PackEntry = {
  head: string; // PascalCase MathJSON head, e.g. "BicoloredMotzkinPaths"
  paramCount: 1 | 2; // number of integer parameters
  kind: "ints" | "blocks"; // element shape: flat int list, OR a list of int lists
  count: (p: number[]) => number; // p = [n]; DP-evaluated count
  unrank: (p: number[], r: number) => number[] | number[][]; // 0-based
  rank: (e: any, p: number[]) => number; // exact 0-based inverse of unrank
  valid: (e: any, p: number[]) => boolean; // is e a member of this collection at params p
};

const normRank = (r: number, total: number): number =>
  total > 0 ? (((Math.trunc(r) % total) + total) % total) : 0;

// ─── BicoloredMotzkinPaths(n): Motzkin paths of length n (steps U=+1, D=-1, LEVEL=0)
// that stay at height >=0 throughout and end back at height 0, where every LEVEL step
// carries one of 2 colors. Encoded as a flat token sequence: 1=U, -1=D, 10=level-color-0,
// 11=level-color-1. g(rem,h) = number of ways to complete `rem` more steps from height h
// down to 0 while staying >=0: g(0,h)=[h===0], g(rem,h) = g(rem-1,h+1) [U, always valid]
// + 2*g(rem-1,h) [level, 2 colors] + (h>=1 ? g(rem-1,h-1) : 0) [D, needs h>=1]. count(n) =
// g(n,0), evaluated directly from this DP table (not hardcoded). This DP-derived count
// sequence turns out to equal Catalan(n+1) (n=0:1, n=1:2, n=2:5, ...) — a known bijective
// fact for 2-colored Motzkin paths — but count() below always returns the table value, so
// if that identity ever broke for some n the table (not the formula) would still be right.
// unrank/rank walk the same four-way split in a fixed order — U, level-color-0,
// level-color-1, D — so the two are exact inverses of each other. ───────────────────────

function bicoloredMotzkinTable(n: number): number[][] {
  const g: number[][] = [];
  for (let rem = 0; rem <= n; rem++) g.push(new Array(n + 2).fill(0));
  for (let h = 0; h <= n + 1; h++) g[0][h] = h === 0 ? 1 : 0;
  for (let rem = 1; rem <= n; rem++) {
    for (let h = 0; h <= n; h++) {
      const u = g[rem - 1][h + 1] ?? 0;
      const l = g[rem - 1][h];
      const d = h >= 1 ? g[rem - 1][h - 1] : 0;
      g[rem][h] = u + 2 * l + d;
    }
  }
  return g;
}

function bicoloredMotzkinCount(p: number[]): number {
  const n = p[0];
  if (n < 0) return 0;
  return bicoloredMotzkinTable(n)[n][0];
}

function bicoloredMotzkinUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const g = bicoloredMotzkinTable(n);
  let rr = normRank(r, g[n][0]);
  const out: number[] = [];
  let h = 0;
  for (let rem = n; rem > 0; rem--) {
    const u = g[rem - 1][h + 1] ?? 0;
    if (rr < u) {
      out.push(1);
      h++;
      continue;
    }
    rr -= u;
    const l = g[rem - 1][h];
    if (rr < l) {
      out.push(10);
      continue;
    }
    rr -= l;
    if (rr < l) {
      out.push(11);
      continue;
    }
    rr -= l;
    const d = h >= 1 ? g[rem - 1][h - 1] : 0;
    if (rr < d) {
      out.push(-1);
      h--;
      continue;
    }
    throw new Error(`BicoloredMotzkinPaths: rank out of range for n=${n}`);
  }
  return out;
}

function bicoloredMotzkinRank(e: any, p: number[]): number {
  const n = p[0];
  const g = bicoloredMotzkinTable(n);
  const seq: number[] = e;
  let h = 0;
  let rank = 0;
  for (let i = 0; i < seq.length; i++) {
    const rem = seq.length - i;
    const u = g[rem - 1][h + 1] ?? 0;
    const l = g[rem - 1][h];
    const tok = seq[i];
    if (tok === 1) h++;
    else if (tok === 10) rank += u;
    else if (tok === 11) rank += u + l;
    else if (tok === -1) {
      rank += u + 2 * l;
      h--;
    }
  }
  return rank;
}

function bicoloredMotzkinValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e) || e.length !== n) return false;
  let h = 0;
  for (const tok of e) {
    if (tok === 1) h++;
    else if (tok === -1) {
      if (h === 0) return false;
      h--;
    } else if (tok !== 10 && tok !== 11) return false;
  }
  return h === 0;
}

// ─── UnaryBinaryTrees(n): rooted plane (Motzkin) trees with n edges, each node having
// 0, 1, or 2 children. Encoded as a flat number[]: the preorder sequence of each node's
// arity (child count). Node count = n+1. T(n) = # such trees with n edges: T(0)=1 (single
// leaf); for n>=1, T(n) = T(n-1) [root arity 1, its one subtree has n-1 edges] +
// sum_{e1+e2=n-2} T(e1)*T(e2) [root arity 2, the two subtrees split the remaining n-2
// edges]. This reproduces the Motzkin numbers 1,1,2,4,9,21,51 (verified in selfcert).
// unrank picks the root arity by walking that same split (arity-1 block, then arity-2
// blocks in increasing left-edge-count order, each itself split left-rank-major/
// right-rank-minor), recursing preorder into each subtree. rank inverts it: given a flat
// preorder sequence it re-derives subtree boundaries with a "pending slots" scan
// (findSubtreeLength) rather than assuming them, so it never trusts unrank's own bookkeeping. ─

function motzkinTreeTable(maxN: number): number[] {
  const T = new Array(Math.max(maxN, 0) + 1).fill(0);
  T[0] = 1;
  for (let m = 1; m <= maxN; m++) {
    let total = T[m - 1];
    for (let e1 = 0; e1 <= m - 2; e1++) total += T[e1] * T[m - 2 - e1];
    T[m] = total;
  }
  return T;
}

function unaryBinaryTreesCount(p: number[]): number {
  const n = p[0];
  if (n < 0) return 0;
  return motzkinTreeTable(n)[n];
}

function unrankTree(n: number, r: number, T: number[]): number[] {
  if (n === 0) return [0];
  const block1 = T[n - 1];
  if (r < block1) return [1, ...unrankTree(n - 1, r, T)];
  let rr = r - block1;
  for (let e1 = 0; e1 <= n - 2; e1++) {
    const e2 = n - 2 - e1;
    const block = T[e1] * T[e2];
    if (rr < block) {
      const leftRank = Math.floor(rr / T[e2]);
      const rightRank = rr % T[e2];
      return [2, ...unrankTree(e1, leftRank, T), ...unrankTree(e2, rightRank, T)];
    }
    rr -= block;
  }
  throw new Error(`UnaryBinaryTrees: rank out of range for n=${n}`);
}

function unaryBinaryTreesUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const T = motzkinTreeTable(n);
  return unrankTree(n, normRank(r, T[n]), T);
}

// Scans a preorder arity sequence starting at `start` and returns the length (in tokens)
// of the single subtree rooted there, via a "pending child slots" counter: starts needing
// 1 node, each visited node consumes its slot and opens `arity` new ones; the subtree ends
// the instant the counter returns to 0.
function findSubtreeLength(seq: number[], start: number): number {
  let buffer = 1;
  let i = start;
  while (buffer > 0) {
    buffer += seq[i] - 1;
    i++;
  }
  return i - start;
}

function rankTree(seq: number[], start: number, n: number, T: number[]): number {
  const a = seq[start];
  if (a === 0) return 0; // n === 0
  if (a === 1) return rankTree(seq, start + 1, n - 1, T);
  // a === 2: find where the left subtree ends, then rank = (arity-1 block) +
  // (arity-2 blocks for smaller left-edge-counts) + leftRank*T[e2] + rightRank.
  const block1 = T[n - 1];
  const leftLen = findSubtreeLength(seq, start + 1);
  const e1 = leftLen - 1;
  const e2 = n - 2 - e1;
  const rightStart = start + 1 + leftLen;
  let offset = block1;
  for (let ee1 = 0; ee1 < e1; ee1++) offset += T[ee1] * T[n - 2 - ee1];
  const leftRank = rankTree(seq, start + 1, e1, T);
  const rightRank = rankTree(seq, rightStart, e2, T);
  return offset + leftRank * T[e2] + rightRank;
}

function unaryBinaryTreesRank(e: any, p: number[]): number {
  const n = p[0];
  const T = motzkinTreeTable(n);
  return rankTree(e as number[], 0, n, T);
}

function unaryBinaryTreesValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e) || e.length !== n + 1) return false;
  let buffer = 1;
  for (const a of e) {
    if (a !== 0 && a !== 1 && a !== 2) return false;
    if (buffer < 1) return false; // already closed a complete tree before this token
    buffer += a - 1;
  }
  return buffer === 0;
}

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "BicoloredMotzkinPaths",
    paramCount: 1,
    kind: "ints",
    count: bicoloredMotzkinCount,
    unrank: bicoloredMotzkinUnrank,
    rank: bicoloredMotzkinRank,
    valid: bicoloredMotzkinValid,
  },
  {
    head: "UnaryBinaryTrees",
    paramCount: 1,
    kind: "ints",
    count: unaryBinaryTreesCount,
    unrank: unaryBinaryTreesUnrank,
    rank: unaryBinaryTreesRank,
    valid: unaryBinaryTreesValid,
  },
];
