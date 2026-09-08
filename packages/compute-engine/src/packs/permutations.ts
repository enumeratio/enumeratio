// Permutations — pattern-avoiding classes, Stirling permutations, and alternating permutations.
// Pure-TS rank/unrank kernels: no imports beyond PackEntry, no I/O, plain JS numbers/arrays.
// Consolidated from six parallel-authored packs (each family below keeps its original derivation
// comment); every kernel's rank(unrank(p,r),p)===r certification lives in test/selfcert.test.ts.

import type { PackEntry } from "./types.js";

const normRank = (r: number, total: number): number =>
  total > 0 ? (((Math.trunc(r) % total) + total) % total) : 0;

// ─── Permutations321Avoiding(n) / Permutations132Avoiding(n): Catalan-counted pattern-avoiding
// permutations of [n] (one-line notation). ──────────────────────────────────────────────────────

// Catalan(n) table [C(0),...,C(n)] via plain DP, recomputed per call — n
// stays small in practice, and this avoids any module-level mutable cache.
function catalanTable(n: number): number[] {
  const c: number[] = [1];
  for (let i = 1; i <= n; i++) {
    let s = 0;
    for (let k = 0; k < i; k++) s += c[k] * c[i - 1 - k];
    c.push(s);
  }
  return c;
}

function isPermutationOf1ToN(e: any, n: number): e is number[] {
  if (!Array.isArray(e) || e.length !== n) return false;
  const seen = new Array(n + 1).fill(false);
  for (const v of e) {
    if (!Number.isInteger(v) || v < 1 || v > n || seen[v]) return false;
    seen[v] = true;
  }
  return true;
}

// Direct O(n^3) pattern checks — used only by `valid`, kept independent of
// the rank/unrank machinery below so the self-cert brute-force filter is a
// genuine cross-check, not a restatement of the same logic.

function has321(e: number[]): boolean {
  const n = e.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (e[j] >= e[i]) continue;
      for (let k = j + 1; k < n; k++) {
        if (e[k] < e[j]) return true;
      }
    }
  }
  return false;
}

function has132(e: number[]): boolean {
  const n = e.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (e[j] <= e[i]) continue;
      for (let k = j + 1; k < n; k++) {
        if (e[k] > e[i] && e[k] < e[j]) return true;
      }
    }
  }
  return false;
}

// ---- Permutations132Avoiding(n) --------------------------------------------
// Permutations of [n] (one-line) avoiding pattern 132 (no i<j<k with
// e[i]<e[k]<e[j]). Count = Catalan(n).
//
// Recursive split on the position of the maximum value n: if n sits at
// (1-indexed) position m, every value left of m must exceed every value
// right of m (else the triple (left-value, n, right-value) with
// left<right<n would itself be a 132 pattern via n as the "3"), and each
// side must independently avoid 132. So the left block is the top (m-1)
// remaining values, the right block the bottom (n-m), each recursively
// 132-avoiding — the standard Catalan convolution C(n)=sum C(m-1)C(n-m).
//
// Both sub-ranges are always CONTIGUOUS integer intervals by construction,
// so recursion is parameterized by (offset, size) instead of an explicit
// value array — mapping a relative rank i (1..size) to its actual value is
// just offset+i, no lookup needed.

function unrank132Range(offset: number, size: number, r: number, cat: number[]): number[] {
  if (size === 0) return [];
  let rem = r;
  for (let m = 1; m <= size; m++) {
    const leftSize = m - 1;
    const rightSize = size - m;
    const block = cat[leftSize] * cat[rightSize];
    if (rem < block) {
      const leftRank = Math.floor(rem / cat[rightSize]);
      const rightRank = rem % cat[rightSize];
      const left = unrank132Range(offset + rightSize, leftSize, leftRank, cat);
      const right = unrank132Range(offset, rightSize, rightRank, cat);
      return [...left, offset + size, ...right];
    }
    rem -= block;
  }
  throw new Error("Permutations132Avoiding unrank: r out of range");
}

function rank132Range(e: number[], offset: number, size: number, cat: number[]): number {
  if (size === 0) return 0;
  const maxVal = offset + size;
  const idx = e.indexOf(maxVal);
  const m = idx + 1;
  const leftSize = m - 1;
  const rightSize = size - m;
  let preceding = 0;
  for (let mp = 1; mp < m; mp++) preceding += cat[mp - 1] * cat[size - mp];
  const leftRank = rank132Range(e.slice(0, idx), offset + rightSize, leftSize, cat);
  const rightRank = rank132Range(e.slice(idx + 1), offset, rightSize, cat);
  return preceding + leftRank * cat[rightSize] + rightRank;
}

function permutations132AvoidingCount(p: number[]): number {
  const n = p[0];
  return catalanTable(n)[n];
}

function permutations132AvoidingUnrank(p: number[], r: number): number[] {
  const n = p[0];
  return unrank132Range(0, n, r, catalanTable(n));
}

function permutations132AvoidingRank(e: any, p: number[]): number {
  const n = p[0];
  return rank132Range(e as number[], 0, n, catalanTable(n));
}

function permutations132AvoidingValid(e: any, p: number[]): boolean {
  const n = p[0];
  return isPermutationOf1ToN(e, n) && !has132(e);
}

// ---- Permutations321Avoiding(n) --------------------------------------------
// Permutations of [n] (one-line) avoiding pattern 321 (no i<j<k with
// e[i]>e[j]>e[k]). Count = Catalan(n).
//
// Unlike 132-avoidance, splitting on the position of the extreme value does
// NOT decompose into two independent recursive blocks here — a decreasing
// pair anywhere in the permutation can combine with any later smaller value
// to form a violation, regardless of block boundaries. Instead we build the
// permutation left to right, tracking just two scalars:
//   M = the running maximum of values placed so far (0 if none yet)
//   T = the running maximum, over every inversion (i<j, e[i]>e[j]) seen so
//       far, of the inversion's *bottom* value e[j] (0 if no inversion yet)
// A candidate next value v is legal iff v > T (otherwise v together with
// whichever earlier pair achieved T completes a 321 pattern). Placing v
// updates: if v > M it's a new record (M:=v, T unchanged, since a record
// creates no inversion); otherwise it creates inversion(s) bottoming at v
// (T := max(T, v)). This rule is necessary (shown above) and sufficient
// (applying it at every step recursively forbids every decreasing triple,
// since any triple's "bottom" k is checked against the max inversion-bottom
// accumulated by position k). count()/rank()/unrank() all share this walk;
// `valid` above re-derives 321-avoidance from the raw pattern definition
// instead, so the self-cert brute-force comparison is a real cross-check.
//
// count() is a plain recursive sum over legal next values, memoized per
// call on (remaining set, M, T) — remaining sets stay small in practice.

function count321(remaining: number[], M: number, T: number, memo: Map<string, number>): number {
  if (remaining.length === 0) return 1;
  const key = remaining.join(",") + "|" + M + "|" + T;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  let total = 0;
  for (const v of remaining) {
    if (v <= T) continue;
    const rest = remaining.filter((x) => x !== v);
    const nm = v > M ? v : M;
    const nt = v > M ? T : Math.max(T, v);
    total += count321(rest, nm, nt, memo);
  }
  memo.set(key, total);
  return total;
}

function permutations321AvoidingCount(p: number[]): number {
  const n = p[0];
  const remaining = Array.from({ length: n }, (_, i) => i + 1);
  return count321(remaining, 0, 0, new Map());
}

function permutations321AvoidingUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const memo = new Map<string, number>();
  let remaining = Array.from({ length: n }, (_, i) => i + 1);
  let M = 0;
  let T = 0;
  let rem = r;
  const result: number[] = [];
  for (let pos = 0; pos < n; pos++) {
    let chosen = -1;
    for (const v of remaining) {
      if (v <= T) continue;
      const rest = remaining.filter((x) => x !== v);
      const nm = v > M ? v : M;
      const nt = v > M ? T : Math.max(T, v);
      const c = count321(rest, nm, nt, memo);
      if (rem < c) {
        chosen = v;
        break;
      }
      rem -= c;
    }
    if (chosen === -1) throw new Error("Permutations321Avoiding unrank: r out of range");
    result.push(chosen);
    remaining = remaining.filter((x) => x !== chosen);
    if (chosen > M) M = chosen;
    else T = Math.max(T, chosen);
  }
  return result;
}

function permutations321AvoidingRank(e: any, p: number[]): number {
  const n = p[0];
  const perm = e as number[];
  const memo = new Map<string, number>();
  let remaining = Array.from({ length: n }, (_, i) => i + 1);
  let M = 0;
  let T = 0;
  let total = 0;
  for (let pos = 0; pos < n; pos++) {
    const v = perm[pos];
    for (const cand of remaining) {
      if (cand === v) break; // remaining stays sorted ascending: this is the canonical cutoff
      if (cand <= T) continue;
      const rest = remaining.filter((x) => x !== cand);
      const nm = cand > M ? cand : M;
      const nt = cand > M ? T : Math.max(T, cand);
      total += count321(rest, nm, nt, memo);
    }
    remaining = remaining.filter((x) => x !== v);
    if (v > M) M = v;
    else T = Math.max(T, v);
  }
  return total;
}

function permutations321AvoidingValid(e: any, p: number[]): boolean {
  const n = p[0];
  return isPermutationOf1ToN(e, n) && !has321(e);
}

// ─── PermutationsAvoiding123(n) / PermutationsAvoiding213(n): generic "lex + prefix-counting"
// avoidance engine, shared by both collections below. Elements are built position-by-position in
// increasing-value order (the standard 1-indexed one-line notation of a permutation of [n]);
// `creates(prefix, v)` decides whether appending v to an already-pattern-free prefix introduces
// the forbidden pattern. Since the prefix is an invariant-maintained pattern-free sequence, a new
// violation can only involve v as the LAST (highest-position) of the three participating values,
// so `creates` only has to scan pairs within the existing prefix — no need to re-scan older
// triples. unrank walks candidates smallest-first, counting how many pattern-free completions
// each choice admits (countAvoiding) and descending into the block containing the target rank;
// rank replays the identical walk, accumulating the sizes of every block skipped before the
// actual next value is reached. ─────────────────────────────────────────────────────────────────

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

// ─── PermutationsAvoiding231(n) / PermutationsAvoiding312(n): both Catalan(n)-counted and decompose
// via the SAME convolution shape (split the permutation at the position of an extreme value into a
// left block of size `leftSize` and a right block of size `n-1-leftSize`, each itself an instance of
// the same collection on a smaller n) — only which extreme value splits, and how the two blocks'
// relative values map back to absolute values, differ between the two entries. ───────────────────────

// Catalan numbers via the standard convolution C(0)=1, C(m)=sum_{i=0}^{m-1} C(i)*C(m-1-i).
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

function isPermutationOf1ToNSet(e: any, n: number): e is number[] {
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
  if (n < 0 || !isPermutationOf1ToNSet(e, n)) return false;
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
  if (n < 0 || !isPermutationOf1ToNSet(e, n)) return false;
  return avoids312(e as number[]);
}

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

// ─── AlternatingPermutations(n): up-down permutations a1<a2>a3<a4>... of {1,...,n}. Count = Euler zigzag
// numbers (OEIS A000111: 1,1,1,2,5,16,61,272,...). Unrank via the classical Entringer-number recursion:
// T(n,k) = #up-down perms of [n] starting with value k = Σ_{i=1}^{n-k} T(n-1,i). Once a1=k is fixed, the
// tail (a2..an) must be a DOWN-UP perm of the remaining (n-1)-set with a2 > k; by the complement bijection
// x -> n-x that tail is in bijection with an up-down perm of [n-1] whose first value lands in {1,...,n-k} —
// which is exactly what the sum over i counts. ──────────────────────────────────────────────────────────

// rows[m][k-1] = T(m,k), built bottom-up from row m-1's prefix sums (row 1 = [1] is the base case).
function entringerRows(n: number): number[][] {
  const rows: number[][] = [[], [1]];
  for (let m = 2; m <= n; m++) {
    const prev = rows[m - 1];
    const prefix = new Array(prev.length + 1).fill(0);
    for (let i = 1; i <= prev.length; i++) prefix[i] = prefix[i - 1] + prev[i - 1];
    const row = new Array(m);
    for (let k = 1; k <= m; k++) row[k - 1] = prefix[m - k] ?? 0;
    rows[m] = row;
  }
  return rows;
}

function AlternatingPermutationCount(n: number): number {
  if (n <= 1) return 1;
  return entringerRows(n)[n].reduce((a, b) => a + b, 0);
}

function AlternatingPermutationUnrank(n: number, rank: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [1];
  const row = entringerRows(n)[n];
  let r = normRank(rank, AlternatingPermutationCount(n));
  let k = 1;
  for (; k <= n; k++) {
    const sz = row[k - 1];
    if (r < sz) break;
    r -= sz;
  }
  const subUp = AlternatingPermutationUnrank(n - 1, r);
  // complement each tail rank (v -> n-v) then skip over k to land back in the real value space {1,...,n}\{k}.
  const tail = subUp.map((v) => { const c = n - v; return c < k ? c : c + 1; });
  return [k, ...tail];
}

function AlternatingPermutationRank(perm: number[]): number {
  const n = perm.length;
  if (n <= 1) return 0;
  const k = perm[0];
  const subUp = perm.slice(1).map((t) => { const c = t < k ? t : t - 1; return n - c; });
  const row = entringerRows(n)[n];
  let offset = 0;
  for (let kk = 1; kk < k; kk++) offset += row[kk - 1];
  return offset + AlternatingPermutationRank(subUp);
}

function IsAlternatingPermutation(a: unknown, n: number): boolean {
  if (!Array.isArray(a) || a.length !== n) return false;
  const seen = new Array(n + 1).fill(false);
  for (const x of a) {
    if (typeof x !== "number" || !Number.isInteger(x) || x < 1 || x > n || seen[x]) return false;
    seen[x] = true;
  }
  for (let i = 0; i < n - 1; i++) {
    const ascentExpected = i % 2 === 0;
    if (ascentExpected ? !(a[i] < a[i + 1]) : !(a[i] > a[i + 1])) return false;
  }
  return true;
}

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "Permutations321Avoiding",
    paramCount: 1,
    kind: "ints",
    count: permutations321AvoidingCount,
    unrank: permutations321AvoidingUnrank,
    rank: permutations321AvoidingRank,
    valid: permutations321AvoidingValid,
  },
  {
    head: "Permutations132Avoiding",
    paramCount: 1,
    kind: "ints",
    count: permutations132AvoidingCount,
    unrank: permutations132AvoidingUnrank,
    rank: permutations132AvoidingRank,
    valid: permutations132AvoidingValid,
  },
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
    head: "AlternatingPermutations",
    paramCount: 1,
    kind: "ints",
    count: (p) => AlternatingPermutationCount(p[0]),
    unrank: (p, r) => AlternatingPermutationUnrank(p[0], r),
    rank: (e) => AlternatingPermutationRank(e as number[]),
    valid: (e, p) => IsAlternatingPermutation(e, p[0]),
  },
];
