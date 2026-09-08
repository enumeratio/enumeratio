// pack-necklaces-lyndon.ts — pure-TS rank/unrank kernels for two combinatorial collections:
// Necklaces(n,k) and LyndonWords(n,k). Self-contained: no imports besides the PackEntry type, no
// I/O, plain JS numbers/arrays. See .scratch/pack-necklaces-selfcert.mts for the exhaustive
// rank(unrank(p,r),p)===r certification plus an independent brute-force cross-check of
// count()/valid() against the closed-form Σ_{d|n} formulas and the given OEIS reference values.
//
// Both collections share one underlying fact (the classical Lyndon-word factorization of a
// necklace): the lex-smallest rotation of ANY length-n word decomposes uniquely as L^(n/d), where
// d | n is the word's minimal period and L is a LYNDON WORD of length d (the minimal rotation of a
// primitive string is always strictly smaller than every one of its own other rotations, i.e. a
// Lyndon word, by definition). That gives a bijection
//   {necklace reps of length n} <-> { (d, L) : d | n, L a Lyndon word of length d }
// which is exactly the identity Necklace(n,k) = Σ_{d|n} LyndonCount(d,k) (checked in self-cert
// against the given Σ φ(d)·k^(n/d) formula). unrank/rank for Necklaces walk the divisors of n in
// increasing order (a deterministic total order: "which divisor-block, then which Lyndon word
// inside it") instead of prefix-counting directly over rotations of words, which is both much
// simpler to get exactly right and reduces to the same LyndonWords machinery this file already
// needs for its second collection.

import type { PackEntry } from "./types.js";

const normRank = (r: number, total: number): number =>
  total > 0 ? (((Math.trunc(r) % total) + total) % total) : 0;

// ─── number theory: Möbius mu, Euler phi, divisors — inlined, no shared dependency ─────────────────

/** All divisors of n (n >= 1), ascending. */
function divisorsOf(n: number): number[] {
  const out: number[] = [];
  for (let d = 1; d * d <= n; d++) {
    if (n % d === 0) {
      out.push(d);
      if (d !== n / d) out.push(n / d);
    }
  }
  return out.sort((a, b) => a - b);
}

/** Möbius μ(n) via trial-division prime factorization. */
function mobiusMu(n: number): number {
  if (n === 1) return 1;
  let m = n;
  let primeCount = 0;
  for (let p = 2; p * p <= m; p++) {
    if (m % p === 0) {
      m /= p;
      if (m % p === 0) return 0; // p^2 | n
      primeCount++;
    }
  }
  if (m > 1) primeCount++;
  return primeCount % 2 === 0 ? 1 : -1;
}

/** Euler φ(n) via trial-division prime factorization. */
function eulerPhi(n: number): number {
  let result = n;
  let m = n;
  for (let p = 2; p * p <= m; p++) {
    if (m % p === 0) {
      while (m % p === 0) m /= p;
      result -= result / p;
    }
  }
  if (m > 1) result -= result / m;
  return Math.round(result);
}

// ─── array helpers ───────────────────────────────────────────────────────────────────────────────

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Lexicographic compare of two same-length arrays: <0, 0, or >0. */
function compareArrays(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function rotateLeft(w: number[], s: number): number[] {
  const n = w.length;
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = w[(i + s) % n];
  return out;
}

/** Is `d` a period of `w` (w repeats its own first-d-elements block)? Assumes d | w.length. */
function isPeriod(w: number[], d: number): boolean {
  for (let i = d; i < w.length; i++) if (w[i] !== w[i % d]) return false;
  return true;
}

// ─── FKM (Fredricksen–Kessler–Maiorana / Duval) algorithm: all Lyndon words of length <= n over
// the 0-indexed alphabet {0..k-1}, generated in lexicographic order. Classical "necklace/de Bruijn
// generation" successor step: extend the current word periodically to length n, strip trailing
// (k-1)'s, then bump the new last letter — this walks every Lyndon word of length <= n exactly
// once, in lex order (independently re-verified by brute force in self-cert, not just asserted). ──

function fkmLyndonWordsUpTo(n: number, k: number): number[][] {
  const out: number[][] = [];
  if (n <= 0 || k <= 0) return out;
  let w: number[] = [0];
  while (w.length > 0) {
    out.push(w.slice());
    const m = w.length;
    while (w.length < n) w.push(w[w.length - m]);
    while (w.length > 0 && w[w.length - 1] === k - 1) w.pop();
    if (w.length > 0) w[w.length - 1] += 1;
  }
  return out;
}

/** Lyndon words of length EXACTLY n over alphabet {1..k}, in lex order (1-indexed letters). */
function lyndonWordsExact(n: number, k: number): number[][] {
  if (n <= 0 || k <= 0) return [];
  return fkmLyndonWordsUpTo(n, k)
    .filter((w) => w.length === n)
    .map((w) => w.map((x) => x + 1));
}

/** |{Lyndon words of length n over a k-ary alphabet}| = (1/n) Σ_{d|n} μ(d)·k^(n/d). */
function lyndonCount(n: number, k: number): number {
  if (n <= 0 || k <= 0) return 0;
  let sum = 0;
  for (const d of divisorsOf(n)) sum += mobiusMu(d) * Math.pow(k, n / d);
  return Math.round(sum / n);
}

// ─── Necklaces(n,k): equivalence classes of length-n words over {1..k} under rotation, represented
// by the lexicographically smallest rotation. count(n,k) = (1/n) Σ_{d|n} φ(d)·k^(n/d) (the given
// closed form). unrank/rank use the Lyndon-factorization bijection above: walk divisors d of n in
// increasing order, each contributing a block of size LyndonCount(d,k) (one necklace rep per Lyndon
// word of length d, formed by repeating it n/d times); locate/replay the block containing r. ──────

function necklacesCount(p: number[]): number {
  const n = p[0];
  const k = p[1];
  if (k <= 0) return 0;
  if (n === 0) return 1;
  if (n < 0) return 0;
  let sum = 0;
  for (const d of divisorsOf(n)) sum += eulerPhi(d) * Math.pow(k, n / d);
  return Math.round(sum / n);
}

function necklacesUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const k = p[1];
  if (n <= 0) return [];
  const total = necklacesCount(p);
  let rem = normRank(r, total);
  for (const d of divisorsOf(n)) {
    const block = lyndonCount(d, k);
    if (rem < block) {
      const L = lyndonWordsExact(d, k)[rem];
      const rep = n / d;
      const out: number[] = [];
      for (let i = 0; i < rep; i++) for (const x of L) out.push(x);
      return out;
    }
    rem -= block;
  }
  return []; // unreachable when 0 <= rem < total
}

function necklacesRank(e: any, p: number[]): number {
  const n = p[0];
  const k = p[1];
  if (n <= 0) return 0;
  const w = e as number[];
  const divs = divisorsOf(n);
  let d = n;
  for (const cand of divs) {
    if (isPeriod(w, cand)) {
      d = cand;
      break;
    }
  }
  const L = w.slice(0, d);
  const idx = lyndonWordsExact(d, k).findIndex((x) => arraysEqual(x, L));
  let offset = 0;
  for (const dd of divs) {
    if (dd === d) break;
    offset += lyndonCount(dd, k);
  }
  return offset + idx;
}

function necklacesValid(e: any, p: number[]): boolean {
  const n = p[0];
  const k = p[1];
  if (!Array.isArray(e) || e.length !== n) return false;
  for (const v of e) {
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > k) return false;
  }
  if (n === 0) return true;
  for (let s = 1; s < n; s++) {
    if (compareArrays(e, rotateLeft(e, s)) > 0) return false; // e must be <= every rotation
  }
  return true;
}

// ─── LyndonWords(n,k): aperiodic necklaces — words strictly smaller than every one of their
// nontrivial rotations. count(n,k) = (1/n) Σ_{d|n} μ(d)·k^(n/d). unrank/rank index directly into
// the FKM lex-order listing of length-exactly-n Lyndon words. ──────────────────────────────────────

function lyndonWordsCount(p: number[]): number {
  return lyndonCount(p[0], p[1]);
}

function lyndonWordsUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const k = p[1];
  if (n <= 0) return [];
  const total = lyndonWordsCount(p);
  const idx = normRank(r, total);
  return lyndonWordsExact(n, k)[idx];
}

function lyndonWordsRank(e: any, p: number[]): number {
  const n = p[0];
  const k = p[1];
  const w = e as number[];
  return lyndonWordsExact(n, k).findIndex((x) => arraysEqual(x, w));
}

function lyndonWordsValid(e: any, p: number[]): boolean {
  const n = p[0];
  const k = p[1];
  if (!Array.isArray(e) || e.length !== n) return false;
  for (const v of e) {
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > k) return false;
  }
  if (n === 0) return false; // no length-0 Lyndon word
  for (let s = 1; s < n; s++) {
    if (compareArrays(e, rotateLeft(e, s)) >= 0) return false; // strictly < every nontrivial rotation
  }
  return true;
}

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "Necklaces",
    paramCount: 2,
    kind: "ints",
    count: necklacesCount,
    unrank: necklacesUnrank,
    rank: necklacesRank,
    valid: necklacesValid,
  },
  {
    head: "LyndonWords",
    paramCount: 2,
    kind: "ints",
    count: lyndonWordsCount,
    unrank: lyndonWordsUnrank,
    rank: lyndonWordsRank,
    valid: lyndonWordsValid,
  },
];
