// pack-d.ts — pure-TS rank/unrank kernels for two combinatorial collections:
// Triangulations(n) and NonCrossingMatchings(n). Self-contained: no imports, no
// I/O, plain JS numbers/arrays. See .scratch/pack-d-selfcert.mts for the
// exhaustive rank(unrank(p,r),p)===r certification over n=0..8.

import type { PackEntry } from "./types.js";

// ---- shared helpers ---------------------------------------------------------

// Catalan numbers, memoized. C_0=1, C_n = sum_{i=0}^{n-1} C_i * C_{n-1-i}.
// Both collections below decompose by the same Catalan convolution, just over
// different combinatorial objects (diagonals vs. chords) — same block sizes,
// same unrank/rank duality.
const catalanMemo = new Map<number, number>();
function catalan(n: number): number {
  if (n <= 1) return 1;
  const cached = catalanMemo.get(n);
  if (cached !== undefined) return cached;
  let s = 0;
  for (let i = 0; i < n; i++) s += catalan(i) * catalan(n - 1 - i);
  catalanMemo.set(n, s);
  return s;
}

// Do chord (a,b) and chord (c,d) (each a<b, c<d, all four labels drawn from a
// common cyclically-ordered point set) cross? Standard convex-polygon/circle
// test: sharing an endpoint is not a crossing; otherwise they cross iff
// exactly one of c,d falls strictly between a and b.
function chordsCross(a: number, b: number, c: number, d: number): boolean {
  if (a === c || a === d || b === c || b === d) return false;
  const cInside = c > a && c < b;
  const dInside = d > a && d < b;
  return cInside !== dInside;
}

// ---- Triangulations(n) ------------------------------------------------------
// Triangulations of a convex (n+2)-gon, vertices labeled 1..n+2 in cyclic
// order. Count = Catalan(n). Element: sorted list of the n-1 non-boundary
// diagonals, each [i,j] with i<j.
//
// Decomposition: fix boundary edge (1, n+2). The triangle on that edge has
// apex k in {2,...,n+1}, splitting the polygon into a left sub-polygon on
// vertices [1..k] (a Catalan-(k-2) subproblem, no relabeling needed since it
// already starts at vertex 1) and a right sub-polygon on vertices [k..n+2] (a
// Catalan-(n-k-1) subproblem, relabeled by an offset of k-1). Diagonals (1,k)
// and (k,n+2) are added unless they coincide with a boundary edge (k=2 or
// k=n+1 respectively). unrank walks the Catalan-convolution blocks
// i=0..n-1 (apex k=i+2) in order; rank re-finds the apex of each sub-polygon
// by searching for the one candidate vertex that no local diagonal
// "straddles" (i < k < j) — the unique root of the recursive split — so it
// walks the identical block order and is an exact inverse.

function triangulationsCount(p: number[]): number {
  return catalan(p[0]);
}

function triangulationsUnrankSub(n: number, r: number, offset: number): number[][] {
  if (n === 0) return [];
  let rem = r;
  for (let i = 0; i < n; i++) {
    const rightCount = catalan(n - 1 - i);
    const blockSize = catalan(i) * rightCount;
    if (rem < blockSize) {
      const rLeft = Math.floor(rem / rightCount);
      const rRight = rem % rightCount;
      const k = i + 2; // local apex vertex, 2..n+1
      const left = triangulationsUnrankSub(i, rLeft, offset);
      const right = triangulationsUnrankSub(n - 1 - i, rRight, offset + k - 1);
      const diagonals: number[][] = [...left, ...right];
      if (k > 2) diagonals.push([offset + 1, offset + k]);
      if (k < n + 1) diagonals.push([offset + k, offset + n + 2]);
      return diagonals;
    }
    rem -= blockSize;
  }
  throw new Error("triangulations: unrank out of range");
}

function triangulationsUnrank(p: number[], r: number): number[][] {
  const diagonals = triangulationsUnrankSub(p[0], r, 0);
  diagonals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return diagonals;
}

function triangulationsRankSub(diagonals: number[][], n: number, offset: number): number {
  if (n === 0) return 0;
  const lo = offset + 1;
  const hi = offset + n + 2;
  // local diagonals of this sub-polygon: both endpoints in range, excluding
  // the sub-polygon's own base edge (lo,hi) itself.
  const local = diagonals.filter(([i, j]) => i >= lo && j <= hi && !(i === lo && j === hi));
  let apexK = -1;
  for (let k = lo + 1; k <= hi - 1; k++) {
    let straddled = false;
    for (const [i, j] of local) {
      if (i < k && k < j) {
        straddled = true;
        break;
      }
    }
    if (!straddled) {
      apexK = k;
      break;
    }
  }
  if (apexK < 0) throw new Error("triangulations: rank could not locate apex");
  const k = apexK - offset;
  const i = k - 2;
  const rightCount = catalan(n - 1 - i);
  const rLeft = triangulationsRankSub(diagonals, i, offset);
  const rRight = triangulationsRankSub(diagonals, n - 1 - i, offset + k - 1);
  let rankSoFar = 0;
  for (let ii = 0; ii < i; ii++) rankSoFar += catalan(ii) * catalan(n - 1 - ii);
  return rankSoFar + rLeft * rightCount + rRight;
}

function triangulationsRank(e: number[][], p: number[]): number {
  return triangulationsRankSub(e, p[0], 0);
}

function triangulationsValid(e: any, p: number[]): boolean {
  const n = p[0];
  const m = n + 2;
  if (!Array.isArray(e)) return false;
  const expected = Math.max(n - 1, 0);
  if (e.length !== expected) return false;
  const seen = new Set<string>();
  for (const d of e) {
    if (!Array.isArray(d) || d.length !== 2) return false;
    const [i, j] = d;
    if (!Number.isInteger(i) || !Number.isInteger(j)) return false;
    if (i < 1 || j > m || i >= j) return false;
    if (j - i === 1) return false; // adjacent vertices: a boundary edge, not a diagonal
    if (i === 1 && j === m) return false; // the wrap-around boundary edge
    const key = i + "," + j;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  for (let a = 0; a < e.length; a++) {
    for (let b = a + 1; b < e.length; b++) {
      if (chordsCross(e[a][0], e[a][1], e[b][0], e[b][1])) return false;
    }
  }
  // A non-crossing set of exactly m-3 diagonals in a convex m-gon is always
  // maximal, hence always a full triangulation — no separate connectivity
  // check needed once count + non-crossing are both confirmed.
  return true;
}

// ---- NonCrossingMatchings(n) ------------------------------------------------
// Non-crossing perfect matchings of 2n points 1..2n. Count = Catalan(n).
// Element: sorted list of n chords [a,b], a<b.
//
// Decomposition: point 1 matches some point m; for the two arcs it splits off
// to admit perfect non-crossing sub-matchings, m must be even, m=2(i+1) for
// i=0..n-1. Inner arc (points 2..m-1, size 2i) is a Catalan-i subproblem
// offset by 1; outer arc (points m+1..2n, size 2(n-i-1)) is a Catalan-(n-i-1)
// subproblem offset by m. Since point labels are globally unique, rank just
// looks up the exact chord containing "offset+1" (no range filtering needed)
// to recover m and recurse — same block order as unrank, so it's an exact
// inverse.

function nonCrossingMatchingsCount(p: number[]): number {
  return catalan(p[0]);
}

function ncmUnrankSub(n: number, r: number, offset: number): number[][] {
  if (n === 0) return [];
  let rem = r;
  for (let i = 0; i < n; i++) {
    const rightCount = catalan(n - 1 - i);
    const blockSize = catalan(i) * rightCount;
    if (rem < blockSize) {
      const rLeft = Math.floor(rem / rightCount);
      const rRight = rem % rightCount;
      const m = 2 * (i + 1); // local partner of point 1
      const inner = ncmUnrankSub(i, rLeft, offset + 1);
      const outer = ncmUnrankSub(n - i - 1, rRight, offset + m);
      return [[offset + 1, offset + m], ...inner, ...outer];
    }
    rem -= blockSize;
  }
  throw new Error("nonCrossingMatchings: unrank out of range");
}

function nonCrossingMatchingsUnrank(p: number[], r: number): number[][] {
  const pairs = ncmUnrankSub(p[0], r, 0);
  pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return pairs;
}

function ncmRankSub(pairs: number[][], n: number, offset: number): number {
  if (n === 0) return 0;
  const found = pairs.find(([a]) => a === offset + 1);
  if (!found) throw new Error("nonCrossingMatchings: rank could not find partner");
  const m = found[1] - offset;
  const i = m / 2 - 1;
  const rightCount = catalan(n - i - 1);
  const rLeft = ncmRankSub(pairs, i, offset + 1);
  const rRight = ncmRankSub(pairs, n - i - 1, offset + m);
  let rankSoFar = 0;
  for (let ii = 0; ii < i; ii++) rankSoFar += catalan(ii) * catalan(n - 1 - ii);
  return rankSoFar + rLeft * rightCount + rRight;
}

function nonCrossingMatchingsRank(e: number[][], p: number[]): number {
  return ncmRankSub(e, p[0], 0);
}

function nonCrossingMatchingsValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e) || e.length !== n) return false;
  const seen = new Set<number>();
  for (const pair of e) {
    if (!Array.isArray(pair) || pair.length !== 2) return false;
    const [a, b] = pair;
    if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
    if (a < 1 || b > 2 * n || a >= b) return false;
    if (seen.has(a) || seen.has(b)) return false;
    seen.add(a);
    seen.add(b);
  }
  if (seen.size !== 2 * n) return false; // must be a perfect matching
  for (let x = 0; x < e.length; x++) {
    for (let y = x + 1; y < e.length; y++) {
      if (chordsCross(e[x][0], e[x][1], e[y][0], e[y][1])) return false;
    }
  }
  return true;
}

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "Triangulations",
    paramCount: 1,
    kind: "blocks",
    count: triangulationsCount,
    unrank: triangulationsUnrank,
    rank: triangulationsRank,
    valid: triangulationsValid,
  },
  {
    head: "NonCrossingMatchings",
    paramCount: 1,
    kind: "blocks",
    count: nonCrossingMatchingsCount,
    unrank: nonCrossingMatchingsUnrank,
    rank: nonCrossingMatchingsRank,
    valid: nonCrossingMatchingsValid,
  },
];
