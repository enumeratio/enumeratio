// pack-q.ts — pure-TS rank/unrank kernels for two combinatorial collections:
// PermutationsAvoiding231(n) and PermutationsAvoiding312(n). Self-contained: no
// imports, no I/O, plain JS numbers/arrays. See .scratch/pack-q-selfcert.mts for
// the exhaustive rank(unrank(p,r),p)===r certification plus an independent
// brute-force (generate-all-n!-permutations-and-filter-by-valid) cross-check.

export type PackEntry = {
  head: string; // PascalCase MathJSON head, e.g. "PermutationsAvoiding231"
  paramCount: 1 | 2; // number of integer parameters
  kind: "ints" | "blocks"; // element shape: flat int list, OR a list of int lists
  count: (p: number[]) => number; // p = [n]; Catalan(n) for both entries below
  unrank: (p: number[], r: number) => number[] | number[][]; // 0-based
  rank: (e: any, p: number[]) => number; // exact 0-based inverse of unrank
  valid: (e: any, p: number[]) => boolean; // is e a member of this collection at params p
};

const normRank = (r: number, total: number): number =>
  total > 0 ? (((Math.trunc(r) % total) + total) % total) : 0;

// Catalan numbers via the standard convolution C(0)=1, C(m)=sum_{i=0}^{m-1} C(i)*C(m-1-i).
// Both collections below are Catalan(n)-counted and decompose via the SAME convolution
// shape (split the permutation at the position of an extreme value into a left block of
// size `leftSize` and a right block of size `n-1-leftSize`, each itself an instance of
// the same collection on a smaller n) — only which extreme value splits, and how the two
// blocks' relative values map back to absolute values, differ between the two entries.
const _catalan: number[] = [1];
function catalan(n: number): number {
  if (n < 0) return 0;
  while (_catalan.length <= n) {
    const m = _catalan.length;
    let total = 0;
    for (let i = 0; i < m; i++) total += _catalan[i] * _catalan[m - 1 - i];
    _catalan.push(total);
  }
  return _catalan[n];
}

function isPermutationOf1ToN(e: any, n: number): e is number[] {
  if (!Array.isArray(e) || e.length !== n) return false;
  const seen = new Set<number>();
  for (const x of e) {
    if (typeof x !== "number" || !Number.isInteger(x) || x < 1 || x > n) return false;
    if (seen.has(x)) return false;
    seen.add(x);
  }
  return true;
}

// ─── PermutationsAvoiding231(n): permutations of [n] with no i<j<k s.t. e[k]<e[i]<e[j]
// (equivalently, the stack-sortable permutations). Classical decomposition: let k0 be the
// (0-based) position of the value n. Avoiding 231 forces every value before k0 to be LESS
// than every value after k0 — otherwise (i before k0, k0 itself, some later k with e[k]<e[i])
// is a 231 pattern with e[k0]=n playing the "biggest" role. So the left block (positions
// [0,k0)) must be exactly the values {1,...,k0} and the right block (positions (k0,n))
// exactly {k0+1,...,n-1}; each block, order-isomorphically, must itself avoid 231 (any
// pattern crossing the two blocks or involving n is otherwise ruled out — checked by hand
// for all placements of i<j<k relative to k0). That gives count(n) = sum_{leftSize=0}^{n-1}
// count(leftSize)*count(n-1-leftSize) = Catalan(n); unrank/rank walk that same sum. ───────

function avoids231(e: number[]): boolean {
  const n = e.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++)
        if (e[k] < e[i] && e[i] < e[j]) return false;
  return true;
}

function permutationsAvoiding231Count(p: number[]): number {
  return catalan(p[0]);
}

function unrank231(n: number, r: number): number[] {
  if (n === 0) return [];
  let rr = r;
  for (let leftSize = 0; leftSize < n; leftSize++) {
    const rightSize = n - 1 - leftSize;
    const rightCount = catalan(rightSize);
    const block = catalan(leftSize) * rightCount;
    if (rr < block) {
      const li = Math.floor(rr / rightCount);
      const ri = rr % rightCount;
      const left = unrank231(leftSize, li); // already absolute: values 1..leftSize
      const rightRel = unrank231(rightSize, ri); // relative values 1..rightSize
      const right = rightRel.map((v) => v + leftSize); // shift to leftSize+1..n-1
      return [...left, n, ...right];
    }
    rr -= block;
  }
  throw new Error(`PermutationsAvoiding231: rank out of range for n=${n}`);
}

function rank231(e: number[], n: number): number {
  if (n === 0) return 0;
  const k0 = e.indexOf(n);
  const leftSize = k0;
  const rightSize = n - 1 - leftSize;
  const left = e.slice(0, k0);
  const rightAbs = e.slice(k0 + 1);
  const rightRel = rightAbs.map((v) => v - leftSize);
  let offset = 0;
  for (let ls = 0; ls < leftSize; ls++) offset += catalan(ls) * catalan(n - 1 - ls);
  const li = rank231(left, leftSize);
  const ri = rank231(rightRel, rightSize);
  return offset + li * catalan(rightSize) + ri;
}

function permutationsAvoiding231Unrank(p: number[], r: number): number[] {
  const n = p[0];
  return unrank231(n, normRank(r, catalan(n)));
}

function permutationsAvoiding231Rank(e: any, p: number[]): number {
  return rank231(e as number[], p[0]);
}

function permutationsAvoiding231Valid(e: any, p: number[]): boolean {
  const n = p[0];
  if (n < 0 || !isPermutationOf1ToN(e, n)) return false;
  return avoids231(e as number[]);
}

// ─── PermutationsAvoiding312(n): permutations of [n] with no i<j<k s.t. e[j]<e[k]<e[i].
// Mirror-image decomposition on the MIN value instead of the max: let m0 be the (0-based)
// position of value 1. Since 1 is globally smallest it can only ever play the "smallest"
// (middle-position) role in a 312 occurrence, so avoiding it forces every value before m0
// to be LESS than every value after m0 — otherwise i<m0<k with e[k]<e[i] gives 1<e[k]<e[i],
// a 312 pattern. So the left block is exactly {2,...,m0+1} and the right block exactly
// {m0+2,...,n}; each, order-isomorphically, must itself avoid 312 (cross-block and
// through-m0 placements checked by hand, same as the 231 case above). Same Catalan
// convolution as 231, just with the split value and the relative->absolute shift mirrored.

function avoids312(e: number[]): boolean {
  const n = e.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++)
        if (e[j] < e[k] && e[k] < e[i]) return false;
  return true;
}

function permutationsAvoiding312Count(p: number[]): number {
  return catalan(p[0]);
}

function unrank312(n: number, r: number): number[] {
  if (n === 0) return [];
  let rr = r;
  for (let leftSize = 0; leftSize < n; leftSize++) {
    const rightSize = n - 1 - leftSize;
    const rightCount = catalan(rightSize);
    const block = catalan(leftSize) * rightCount;
    if (rr < block) {
      const li = Math.floor(rr / rightCount);
      const ri = rr % rightCount;
      const leftRel = unrank312(leftSize, li); // relative values 1..leftSize
      const left = leftRel.map((v) => v + 1); // shift to 2..leftSize+1
      const rightRel = unrank312(rightSize, ri);
      const right = rightRel.map((v) => v + leftSize + 1); // shift to leftSize+2..n
      return [...left, 1, ...right];
    }
    rr -= block;
  }
  throw new Error(`PermutationsAvoiding312: rank out of range for n=${n}`);
}

function rank312(e: number[], n: number): number {
  if (n === 0) return 0;
  const m0 = e.indexOf(1);
  const leftSize = m0;
  const rightSize = n - 1 - leftSize;
  const leftAbs = e.slice(0, m0);
  const rightAbs = e.slice(m0 + 1);
  const leftRel = leftAbs.map((v) => v - 1);
  const rightRel = rightAbs.map((v) => v - leftSize - 1);
  let offset = 0;
  for (let ls = 0; ls < leftSize; ls++) offset += catalan(ls) * catalan(n - 1 - ls);
  const li = rank312(leftRel, leftSize);
  const ri = rank312(rightRel, rightSize);
  return offset + li * catalan(rightSize) + ri;
}

function permutationsAvoiding312Unrank(p: number[], r: number): number[] {
  const n = p[0];
  return unrank312(n, normRank(r, catalan(n)));
}

function permutationsAvoiding312Rank(e: any, p: number[]): number {
  return rank312(e as number[], p[0]);
}

function permutationsAvoiding312Valid(e: any, p: number[]): boolean {
  const n = p[0];
  if (n < 0 || !isPermutationOf1ToN(e, n)) return false;
  return avoids312(e as number[]);
}

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "PermutationsAvoiding231",
    paramCount: 1,
    kind: "ints",
    count: permutationsAvoiding231Count,
    unrank: permutationsAvoiding231Unrank,
    rank: permutationsAvoiding231Rank,
    valid: permutationsAvoiding231Valid,
  },
  {
    head: "PermutationsAvoiding312",
    paramCount: 1,
    kind: "ints",
    count: permutationsAvoiding312Count,
    unrank: permutationsAvoiding312Unrank,
    rank: permutationsAvoiding312Rank,
    valid: permutationsAvoiding312Valid,
  },
];
