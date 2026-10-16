// Moved out of the runtime by BL-225: kernels only tests/readings and the agreement tests use.
import { Factorial, IsPermutationOf, PermutationUnrank, modRank } from "../../../collections/src/families/kernels.ts";
import { Inversions, LehmerCode } from "./collections-kernels.ts";

// The table the TS kernel builds is whole polynomials per size, so a large n is left to Epsil.
export const MAHONIAN_FAST_MAX_N = 200;

export const withinMahonianTable = (n: number): number => {
  if (n > MAHONIAN_FAST_MAX_N) throw new RangeError(`KInversionPermutations(${n}): too large for the TS table`);
  return n;
};

// ─── KInversionPermutations(n,k): exactly k inversions — the Mahonian triangle. ────────────────────
// k = the LehmerCode digit sum; digit i (0-indexed) ranges over [0, n−1−i], so counting/ranking is a
// bounded-digit-sum mixed-radix problem — coefficients of ∏ᵢ(1+q+…+qⁱ), i.e. the q-factorial [n]_q!.
export const mahonianCache = new Map<number, number[][]>();

export function mahonianTable(n: number): number[][] {
  let table = mahonianCache.get(n);
  if (table) return table;
  table = Array.from({ length: n + 1 });
  table[n] = [1];
  for (let pos = n - 1; pos >= 0; pos--) {
    const maxDigit = n - 1 - pos;
    const prev = table[pos + 1];
    const poly: number[] = Array.from({ length: prev.length - 1 + maxDigit + 1 }, () => 0);
    for (let d = 0; d <= maxDigit; d++) for (let s = 0; s < prev.length; s++) poly[d + s] += prev[s];
    table[pos] = poly;
  }
  mahonianCache.set(n, table);
  return table;
}

export function kInversionRank(perm: number[], n: number): number {
  const code = LehmerCode(perm);
  const table = mahonianTable(n);
  let remaining = code.reduce((a, b) => a + b, 0);
  let rank = 0;
  for (let pos = 0; pos < code.length; pos++) {
    const d = code[pos];
    const restPoly = table[pos + 1];
    for (let dd = 0; dd < d; dd++) {
      const need = remaining - dd;
      rank += need >= 0 && need < restPoly.length ? restPoly[need] : 0;
    }
    remaining -= d;
  }
  return rank;
}

// ─── LehmerCodes(n): the inversion tables, in their own order: read as factoradic numbers, which
// is what makes the order implied rather than chosen. They match Permutations' lex order only
// because that is the order we chose for Permutations. Element = LehmerCode(perm) ──
// (length n, the last entry always 0).
export function permutationFromLehmerCode(L: number[], n: number): number[] {
  const avail = Array.from({ length: n }, (_, i) => i + 1);
  const res: number[] = [];
  for (let i = 0; i < n; i++) {
    const idx = L[i];
    res.push(avail[idx]);
    avail.splice(idx, 1);
  }
  return res;
}

export function kInversionUnrank(n: number, k: number, r: number): number[] {
  if (n === 0) return [];
  const table = mahonianTable(n);
  let remaining = k;
  let rr = r;
  const code: number[] = [];
  for (let pos = 0; pos < n - 1; pos++) {
    const maxDigit = n - 1 - pos;
    const restPoly = table[pos + 1];
    let d = 0;
    for (; d <= maxDigit; d++) {
      const need = remaining - d;
      const c = need >= 0 && need < restPoly.length ? restPoly[need] : 0;
      if (rr < c) break;
      rr -= c;
    }
    code.push(d);
    remaining -= d;
  }
  return permutationFromLehmerCode([...code, 0], n);
}

export function isSubexcedant(terms: number[], n: number): boolean {
  if (!Array.isArray(terms) || terms.length !== n) return false;
  for (let i = 0; i < n; i++) {
    const v = terms[i];
    if (!Number.isInteger(v) || v < 0 || v > i) return false;
  }
  return true;
}

// ─── SubexcedantSeqs(n): words (a₀,…,aₙ₋₁) with 0 ≤ aᵢ ≤ i (0-indexed) — its own factorial-base ────
// odometer, a sibling of lehmer_codes with a different bound (aᵢ ≤ i here, vs the Lehmer code's aᵢ ≤ n−1−i).
export function subexcedantBlockSize(n: number, i: number): number {
  return Factorial(n) / Factorial(i + 1); // completions after position i
}

export function subexcedantRank(terms: number[], n: number): number {
  let r = 0;
  for (let i = 0; i < n; i++) r += terms[i] * subexcedantBlockSize(n, i);
  return r;
}

export function subexcedantUnrank(n: number, r: number): number[] {
  const total = Factorial(n);
  let x = total > 0 ? modRank(Math.trunc(r), total) : 0;
  const terms: number[] = [];
  for (let i = 0; i < n; i++) {
    const bs = subexcedantBlockSize(n, i);
    const d = Math.floor(x / bs);
    terms.push(d);
    x -= d * bs;
  }
  return terms;
}

export function isValidLehmerCode(code: number[], n: number): boolean {
  if (!Array.isArray(code) || code.length !== n) return false;
  for (let i = 0; i < code.length; i++) {
    const v = code[i];
    if (!Number.isInteger(v) || v < 0 || v > n - 1 - i) return false;
  }
  return true;
}

export function isEvenPermutation(perm: number[], n: number): boolean {
  return IsPermutationOf(perm, n) && Inversions(perm) % 2 === 0;
}

// ─── EvenPermutations(n): the alternating group Aₙ, one-line words. ────────────────────────────────
// Lex-rank pairs (2m, 2m+1) always differ by swapping the trailing two entries (the factorial-base
// digit at that place has weight 1 and only two values), so they have opposite parity — exactly one of
// each pair is even. That makes "the r-th even permutation" just "whichever half of pair r is even".
export function evenPermutationCount(n: number): number {
  return n <= 1 ? 1 : Factorial(n) / 2;
}

export function evenPermutationUnrank(n: number, r: number): number[] {
  if (n <= 1) return PermutationUnrank(n, 0);
  const total = evenPermutationCount(n);
  const rr = total > 0 ? modRank(Math.trunc(r), total) : 0;
  const base = PermutationUnrank(n, 2 * rr);
  return Inversions(base) % 2 === 0 ? base : PermutationUnrank(n, 2 * rr + 1);
}
