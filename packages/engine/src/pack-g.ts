// pack-g.ts — pure-TS rank/unrank kernels for two Catalan-counted tree
// families: FullBinaryTrees(n) and PlaneForests(n). Self-contained: no
// imports, no I/O, plain JS numbers/arrays. See .scratch/pack-g-selfcert.mts
// for the exhaustive rank(unrank(p,r),p)===r certification over n=0..9.

export type PackEntry = {
  head: string; // PascalCase MathJSON head, e.g. "FullBinaryTrees"
  paramCount: 1 | 2; // number of integer parameters
  kind: "ints" | "blocks"; // element shape: flat int list, OR a list of int lists
  count: (p: number[]) => number; // p = [n] or [n,k]; closed-form or DP count
  unrank: (p: number[], r: number) => number[] | number[][]; // 0-based
  rank: (e: any, p: number[]) => number; // exact 0-based inverse of unrank
  valid: (e: any, p: number[]) => boolean; // is e a member of this collection at params p
};

// ---- shared helper ---------------------------------------------------------

// Catalan(n) via plain DP, recomputed per call — n stays small (<=9 in
// selfcert, and both counts blow past the 60000 cert cap by n~13) so this
// stays cheap without any module-level mutable cache.
function catalan(n: number): number {
  if (n <= 0) return 1;
  const c: number[] = [1];
  for (let i = 1; i <= n; i++) {
    let s = 0;
    for (let k = 0; k < i; k++) s += c[k] * c[i - 1 - k];
    c.push(s);
  }
  return c[n];
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
  for (let k = 0; k < i; k++) rank += catalan(k) * catalan(m - 1 - k);
  const leftRank = fbtRank(bits, leftStart, rightStart);
  const rightRank = fbtRank(bits, rightStart, hi);
  rank += leftRank * catalan(j) + rightRank;
  return rank;
}

function fbtUnrankHelper(m: number, r: number): number[] {
  if (m === 0) return [0];
  let rem = r;
  for (let i = 0; i < m; i++) {
    const j = m - 1 - i;
    const blockSize = catalan(i) * catalan(j);
    if (rem < blockSize) {
      const leftRank = Math.floor(rem / catalan(j));
      const rightRank = rem % catalan(j);
      const left = fbtUnrankHelper(i, leftRank);
      const right = fbtUnrankHelper(j, rightRank);
      return [1, ...left, ...right];
    }
    rem -= blockSize;
  }
  throw new Error("FullBinaryTrees unrank: r out of range");
}

function fullBinaryTreesCount(p: number[]): number {
  return catalan(p[0]);
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
  for (let k = 0; k < i; k++) rank += catalan(k) * catalan(m - 1 - k);
  const leftRank = forestRank(bits, childStart, closeIdx);
  const rightRank = forestRank(bits, restStart, hi);
  rank += leftRank * catalan(j) + rightRank;
  return rank;
}

function pfUnrankHelper(m: number, r: number): number[] {
  if (m === 0) return [];
  let rem = r;
  for (let i = 0; i < m; i++) {
    const j = m - 1 - i;
    const blockSize = catalan(i) * catalan(j);
    if (rem < blockSize) {
      const leftRank = Math.floor(rem / catalan(j));
      const rightRank = rem % catalan(j);
      const children = pfUnrankHelper(i, leftRank);
      const rest = pfUnrankHelper(j, rightRank);
      return [1, ...children, 0, ...rest];
    }
    rem -= blockSize;
  }
  throw new Error("PlaneForests unrank: r out of range");
}

function planeForestsCount(p: number[]): number {
  return catalan(p[0]);
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

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
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
];
