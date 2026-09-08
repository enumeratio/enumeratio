// Trees & tree-shaped functions — full binary trees, plane forests, unary-binary (Motzkin) trees,
// parking functions, and increasing (recursive) trees. Pure-TS rank/unrank kernels: no I/O, plain
// JS numbers/arrays. Consolidated from three parallel-authored packs; every kernel's
// rank(unrank(p,r),p)===r certification lives in test/selfcert.test.ts.

import type { PackEntry } from "./types.js";
import { factorial, catalanNumber } from "./_shared.js";

const normRank = (r: number, total: number): number =>
  total > 0 ? (((Math.trunc(r) % total) + total) % total) : 0;

// ---- IncreasingTrees(n) -----------------------------------------------------
// Rooted labeled trees on nodes [1..n] where every root-to-leaf path has
// strictly increasing labels — equivalently, parent[i] < i for every
// non-root node i ("increasing Cayley trees" / recursive trees).
// Count = (n-1)! for n>=1 (n=0/1 -> 1: the empty tree / single root).
//
// Element: parent array of length n, 0-indexed by (node-1). parent[0] = 0
// is a fixed sentinel (node 1 is the root). For node i (2<=i<=n),
// parent[i-1] ranges over {1,...,i-1} — (i-1) choices — so the whole tree
// is one digit of a mixed-radix number: node n is the least-significant
// digit (base n-1), node 2 is the most-significant digit (base 1). unrank
// and rank walk the same digit order with the same place values, so they
// are exact inverses by construction.

function increasingTreesCount(p: number[]): number {
  const n = p[0];
  return n <= 1 ? 1 : factorial(n - 1);
}

function increasingTreesUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const parent = new Array(n).fill(0);
  let rem = r;
  for (let i = n; i >= 2; i--) {
    const base = i - 1;
    const d = rem % base;
    rem = Math.floor(rem / base);
    parent[i - 1] = d + 1;
  }
  return parent;
}

function increasingTreesRank(e: number[], p: number[]): number {
  const n = p[0];
  let rank = 0;
  let placeValue = 1;
  for (let i = n; i >= 2; i--) {
    const base = i - 1;
    const d = e[i - 1] - 1;
    rank += d * placeValue;
    placeValue *= base;
  }
  return rank;
}

function increasingTreesValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e) || e.length !== n) return false;
  if (n === 0) return true;
  if (e[0] !== 0) return false;
  for (let i = 2; i <= n; i++) {
    const v = e[i - 1];
    if (!Number.isInteger(v) || v < 1 || v > i - 1) return false;
  }
  return true;
}

// ---- ParkingFunctions(n) ----------------------------------------------------
// Sequences (a_1..a_n), a_i in {1,...,n}, such that the sorted sequence b
// satisfies b_i <= i (1-indexed) — cars park at their preferred spot or the
// next free one, and every spot fills. Count = (n+1)^(n-1); the formula
// gives 1^(-1)=1 for n=0 for free (the empty sequence).
//
// unrank/rank via digit-DP: build a_1..a_n left to right. The number of
// valid completions from position i+1..n depends only on the running
// "at-most-k" counts M[k] = #{j<=i : a_j<=k} for k=1..n (choosing a_i=v
// bumps M[k] for every k>=v — the final-feasibility check is M[k]>=k for
// all k). completions(i,M) is memoized per top-level call; unrank and rank
// walk the exact same decision tree in the same v=1..n order (standard
// combinatorial-number-system duality), so rank(unrank(p,r),p)===r.

function pfCompletions(n: number, i: number, M: number[], memo: Map<string, number>): number {
  if (i === n) {
    for (let k = 1; k <= n; k++) if (M[k] < k) return 0;
    return 1;
  }
  const key = i + "|" + M.slice(1, n + 1).join(",");
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  let total = 0;
  for (let v = 1; v <= n; v++) {
    const newM = M.slice();
    for (let k = v; k <= n; k++) newM[k]++;
    total += pfCompletions(n, i + 1, newM, memo);
  }
  memo.set(key, total);
  return total;
}

function parkingFunctionsCount(p: number[]): number {
  const n = p[0];
  return Math.pow(n + 1, n - 1);
}

function parkingFunctionsUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const M = new Array(n + 1).fill(0);
  const memo = new Map<string, number>();
  const result: number[] = [];
  let rem = r;
  for (let i = 0; i < n; i++) {
    for (let v = 1; v <= n; v++) {
      const newM = M.slice();
      for (let k = v; k <= n; k++) newM[k]++;
      const c = pfCompletions(n, i + 1, newM, memo);
      if (rem < c) {
        result.push(v);
        for (let k = v; k <= n; k++) M[k]++;
        break;
      }
      rem -= c;
    }
  }
  return result;
}

function parkingFunctionsRank(e: number[], p: number[]): number {
  const n = p[0];
  const M = new Array(n + 1).fill(0);
  const memo = new Map<string, number>();
  let rank = 0;
  for (let i = 0; i < n; i++) {
    const a = e[i];
    for (let v = 1; v < a; v++) {
      const newM = M.slice();
      for (let k = v; k <= n; k++) newM[k]++;
      rank += pfCompletions(n, i + 1, newM, memo);
    }
    for (let k = a; k <= n; k++) M[k]++;
  }
  return rank;
}

function parkingFunctionsValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e) || e.length !== n) return false;
  for (const x of e) if (!Number.isInteger(x) || x < 1 || x > n) return false;
  const b = e.slice().sort((x: number, y: number) => x - y);
  for (let i = 0; i < n; i++) if (b[i] > i + 1) return false;
  return true;
}

// ---- FullBinaryTrees(n) -----------------------------------------------------
// Full binary trees (every node has 0 or 2 children) with n internal nodes,
// 2n+1 nodes total. Count = Catalan(n).
//
// Element: preorder traversal flattened to bits — 1 for an internal node, 0
// for a leaf. A tree with n>=1 internal nodes is root(1) + left(i internal
// nodes) + right(n-1-i internal nodes) for some split i in 0..n-1; a leaf
// (n=0) is just [0]. unrank walks splits i=0..n-1 in order, and within a
// split enumerates (leftRank, rightRank) row-major (leftRank major, since
// its block width is Catalan(j)); rank decodes the same way by finding the
// left subtree's span via a "how many more nodes are owed" counter — each
// leaf owes -1 (consumes itself), each internal node owes +1 (consumes
// itself, promises two children) — so they're exact inverses by construction.

function fbtSpan(bits: number[], start: number): number {
  let needed = 1;
  let i = start;
  while (needed > 0) {
    needed += bits[i] === 1 ? 1 : -1;
    i++;
  }
  return i - start;
}

function fbtRank(bits: number[], lo: number, hi: number): number {
  const m = (hi - lo - 1) / 2;
  if (m === 0) return 0; // single leaf, only one encoding
  const leftStart = lo + 1;
  const leftLen = fbtSpan(bits, leftStart);
  const i = (leftLen - 1) / 2;
  const rightStart = leftStart + leftLen;
  const j = m - 1 - i;
  let rank = 0;
  for (let k = 0; k < i; k++) rank += catalanNumber(k) * catalanNumber(m - 1 - k);
  const leftRank = fbtRank(bits, leftStart, rightStart);
  const rightRank = fbtRank(bits, rightStart, hi);
  rank += leftRank * catalanNumber(j) + rightRank;
  return rank;
}

function fbtUnrankHelper(m: number, r: number): number[] {
  if (m === 0) return [0];
  let rem = r;
  for (let i = 0; i < m; i++) {
    const j = m - 1 - i;
    const blockSize = catalanNumber(i) * catalanNumber(j);
    if (rem < blockSize) {
      const leftRank = Math.floor(rem / catalanNumber(j));
      const rightRank = rem % catalanNumber(j);
      const left = fbtUnrankHelper(i, leftRank);
      const right = fbtUnrankHelper(j, rightRank);
      return [1, ...left, ...right];
    }
    rem -= blockSize;
  }
  throw new Error("FullBinaryTrees unrank: r out of range");
}

function fullBinaryTreesCount(p: number[]): number {
  return catalanNumber(p[0]);
}

function fullBinaryTreesUnrank(p: number[], r: number): number[] {
  return fbtUnrankHelper(p[0], r);
}

function fullBinaryTreesRank(e: any, p: number[]): number {
  return fbtRank(e as number[], 0, e.length);
}

function fullBinaryTreesValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e) || e.length !== 2 * n + 1) return false;
  let needed = 1;
  for (let i = 0; i < e.length; i++) {
    const b = e[i];
    if (b !== 0 && b !== 1) return false;
    if (needed <= 0) return false; // a subtree already closed before the end
    needed += b === 1 ? 1 : -1;
  }
  return needed === 0;
}

// ---- PlaneForests(n) ---------------------------------------------------------
// Ordered (plane) forests of rooted ordered trees with n total nodes.
// Count = Catalan(n) (forests on n nodes <-> Dyck paths of semilength n).
//
// Element: DFS balanced sequence — entering a node emits 1, leaving it
// (after all its children) emits 0; a forest concatenates the encodings of
// its trees in order. Length 2n. A nonempty forest (m>=1 total nodes) is
// tree1(1 + children-forest of i nodes + 0) followed by rest-forest(j = m-1-i
// nodes) for some split i in 0..m-1 — the SAME Catalan block-size recurrence
// as FullBinaryTrees, so unrank/rank mirror that structure with the "0" that
// closes the first tree relocated after its children instead of implied by a
// leaf. `valid` is the standard Dyck-path check: prefix balance (+1 per 1,
// -1 per 0) never goes negative and ends at 0.

function findMatch(bits: number[], start: number): number {
  let bal = 1;
  let i = start;
  while (bal > 0) {
    bal += bits[i] === 1 ? 1 : -1;
    i++;
  }
  return i - 1; // index of the closing 0
}

function forestRank(bits: number[], lo: number, hi: number): number {
  const m = (hi - lo) / 2;
  if (m === 0) return 0; // empty forest
  const childStart = lo + 1;
  const closeIdx = findMatch(bits, childStart);
  const i = (closeIdx - childStart) / 2;
  const restStart = closeIdx + 1;
  const j = m - 1 - i;
  let rank = 0;
  for (let k = 0; k < i; k++) rank += catalanNumber(k) * catalanNumber(m - 1 - k);
  const leftRank = forestRank(bits, childStart, closeIdx);
  const rightRank = forestRank(bits, restStart, hi);
  rank += leftRank * catalanNumber(j) + rightRank;
  return rank;
}

function pfUnrankHelper(m: number, r: number): number[] {
  if (m === 0) return [];
  let rem = r;
  for (let i = 0; i < m; i++) {
    const j = m - 1 - i;
    const blockSize = catalanNumber(i) * catalanNumber(j);
    if (rem < blockSize) {
      const leftRank = Math.floor(rem / catalanNumber(j));
      const rightRank = rem % catalanNumber(j);
      const children = pfUnrankHelper(i, leftRank);
      const rest = pfUnrankHelper(j, rightRank);
      return [1, ...children, 0, ...rest];
    }
    rem -= blockSize;
  }
  throw new Error("PlaneForests unrank: r out of range");
}

function planeForestsCount(p: number[]): number {
  return catalanNumber(p[0]);
}

function planeForestsUnrank(p: number[], r: number): number[] {
  return pfUnrankHelper(p[0], r);
}

function planeForestsRank(e: any, p: number[]): number {
  return forestRank(e as number[], 0, e.length);
}

function planeForestsValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e) || e.length !== 2 * n) return false;
  let bal = 0;
  for (const x of e) {
    if (x !== 0 && x !== 1) return false;
    bal += x === 1 ? 1 : -1;
    if (bal < 0) return false;
  }
  return bal === 0;
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
    head: "ParkingFunctions",
    paramCount: 1,
    kind: "ints",
    count: parkingFunctionsCount,
    unrank: parkingFunctionsUnrank,
    rank: parkingFunctionsRank,
    valid: parkingFunctionsValid,
  },
  {
    head: "IncreasingTrees",
    paramCount: 1,
    kind: "ints",
    count: increasingTreesCount,
    unrank: increasingTreesUnrank,
    rank: increasingTreesRank,
    valid: increasingTreesValid,
  },
  {
    head: "FullBinaryTrees",
    paramCount: 1,
    kind: "ints",
    count: fullBinaryTreesCount,
    unrank: fullBinaryTreesUnrank,
    rank: fullBinaryTreesRank,
    valid: fullBinaryTreesValid,
  },
  {
    head: "PlaneForests",
    paramCount: 1,
    kind: "ints",
    count: planeForestsCount,
    unrank: planeForestsUnrank,
    rank: planeForestsRank,
    valid: planeForestsValid,
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
