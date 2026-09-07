// pack-x.ts — pure-TS rank/unrank kernels for two combinatorial collections:
// CarlitzCompositions(n) and SmirnovWords(n,k). Self-contained: no imports, no
// I/O, plain JS numbers/arrays. See .scratch/pack-x-selfcert.mts for the
// exhaustive rank(unrank(p,r),p)===r certification plus an independent
// brute-force cross-check of count()/valid(), and a check against the given
// A003242 / k*(k-1)^(n-1) reference values.

export type PackEntry = {
  head: string; // PascalCase MathJSON head, e.g. "CarlitzCompositions"
  paramCount: 1 | 2; // number of integer parameters
  kind: "ints" | "blocks"; // element shape: flat int list, OR a list of int lists
  count: (p: number[]) => number; // p = [n] or [n,k]; closed recurrence
  unrank: (p: number[], r: number) => number[] | number[][]; // 0-based
  rank: (e: any, p: number[]) => number; // exact 0-based inverse of unrank
  valid: (e: any, p: number[]) => boolean; // is e a member of this collection at params p
};

const normRank = (r: number, total: number): number =>
  total > 0 ? (((Math.trunc(r) % total) + total) % total) : 0;

// ─── CarlitzCompositions(n): compositions of n (ordered sequences of positive integers summing to
// n) with no two ADJACENT parts equal, counted by A003242 (1,1,1,3,4,7,14,23,39,71,... for
// n=0,1,2,...). c(rem,last) = # Carlitz compositions of `rem` whose first part != `last` (last=0 is
// the "no constraint" sentinel used at the top level, since real parts are always >=1): c(0,last)=1
// (the empty completion) for every last; c(rem,last) = sum over v=1..rem, v!=last, of
// c(rem-v, v) — place v as the next part (excluded only from equaling the immediately-preceding
// part), then require the REST to avoid equaling v. count(n) = c(n,0). unrank walks that same split
// — v=1..remSum in order (each a same-size c(remSum-v,v) block, skipping v===last) — to locate r;
// rank replays the identical split to relocate a given composition. ───────────────────────────────

function carlitzTable(n: number): number[][] {
  // c[rem][last], rem=0..n, last=0..n (last=0 used only as the top-level sentinel).
  const c: number[][] = [];
  for (let rem = 0; rem <= n; rem++) c.push(new Array(n + 1).fill(0));
  for (let last = 0; last <= n; last++) c[0][last] = 1; // nothing left: exactly one (empty) completion
  for (let rem = 1; rem <= n; rem++) {
    for (let last = 0; last <= n; last++) {
      let sum = 0;
      for (let v = 1; v <= rem; v++) {
        if (v === last) continue;
        sum += c[rem - v][v];
      }
      c[rem][last] = sum;
    }
  }
  return c;
}

function carlitzCompositionsCount(p: number[]): number {
  const n = p[0];
  if (n < 0) return 0;
  return carlitzTable(n)[n][0];
}

function carlitzCompositionsUnrank(p: number[], r: number): number[] {
  const n = p[0];
  if (n <= 0) return [];
  const table = carlitzTable(n);
  const total = table[n][0];
  let rem = normRank(r, total);
  const parts: number[] = [];
  let remSum = n;
  let last = 0;
  while (remSum > 0) {
    let chosen = -1;
    for (let v = 1; v <= remSum; v++) {
      if (v === last) continue;
      const block = table[remSum - v][v];
      if (rem < block) { chosen = v; break; }
      rem -= block;
    }
    parts.push(chosen);
    remSum -= chosen;
    last = chosen;
  }
  return parts;
}

function carlitzCompositionsRank(e: any, p: number[]): number {
  const n = p[0];
  if (n <= 0) return 0;
  const table = carlitzTable(n);
  const parts = e as number[];
  let rank = 0;
  let remSum = n;
  let last = 0;
  for (const v of parts) {
    for (let u = 1; u < v; u++) {
      if (u === last) continue;
      rank += table[remSum - u][u];
    }
    remSum -= v;
    last = v;
  }
  return rank;
}

function carlitzCompositionsValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  if (e.length === 0) return n === 0;
  let sum = 0;
  for (let i = 0; i < e.length; i++) {
    const v = e[i];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1) return false;
    sum += v;
    if (i > 0 && e[i] === e[i - 1]) return false;
  }
  return sum === n;
}

// ─── SmirnovWords(n,k): length-n words over the alphabet {1..k} with no two equal ADJACENT
// letters, counted by n===0 ? 1 : k*(k-1)^(n-1) (the first letter is free among k, every later
// letter is free among the k-1 letters != the previous one). unrank/rank use a clean MIXED-RADIX
// decomposition: position 0 has radix k with place value (k-1)^(n-1); each position i>=1 has radix
// (k-1) with place value (k-1)^(n-1-i). A digit d at a position with exclusion `prev` (0 = no
// exclusion, used only at position 0) selects the d-th smallest letter of {1..k}\{prev}; the
// inverse counts how many valid letters are below a given one. ────────────────────────────────────

function nthValidLetter(k: number, prev: number, d: number): number {
  let count = 0;
  for (let v = 1; v <= k; v++) {
    if (v === prev) continue;
    if (count === d) return v;
    count++;
  }
  return -1; // unreachable for a well-formed (k, prev, d)
}

function letterDigit(prev: number, v: number): number {
  let d = 0;
  for (let u = 1; u < v; u++) {
    if (u === prev) continue;
    d++;
  }
  return d;
}

function smirnovWordsCount(p: number[]): number {
  const n = p[0];
  const k = p[1];
  if (n < 0 || k < 0) return 0;
  if (n === 0) return 1;
  return k * Math.pow(k - 1, n - 1);
}

function smirnovWordsUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const k = p[1];
  if (n <= 0) return [];
  const total = smirnovWordsCount(p);
  let rem = normRank(r, total);
  const w: number[] = [];
  let place = Math.pow(k - 1, n - 1);
  let d = place > 0 ? Math.floor(rem / place) : 0;
  if (place > 0) rem -= d * place;
  let prev = nthValidLetter(k, 0, d);
  w.push(prev);
  for (let i = 1; i < n; i++) {
    place = Math.pow(k - 1, n - 1 - i);
    d = place > 0 ? Math.floor(rem / place) : 0;
    if (place > 0) rem -= d * place;
    const v = nthValidLetter(k, prev, d);
    w.push(v);
    prev = v;
  }
  return w;
}

function smirnovWordsRank(e: any, p: number[]): number {
  const n = p[0];
  const k = p[1];
  if (n <= 0) return 0;
  const w = e as number[];
  let rank = 0;
  let place = Math.pow(k - 1, n - 1);
  rank += letterDigit(0, w[0]) * place;
  let prev = w[0];
  for (let i = 1; i < n; i++) {
    place = Math.pow(k - 1, n - 1 - i);
    rank += letterDigit(prev, w[i]) * place;
    prev = w[i];
  }
  return rank;
}

function smirnovWordsValid(e: any, p: number[]): boolean {
  const n = p[0];
  const k = p[1];
  if (!Array.isArray(e) || e.length !== n) return false;
  for (let i = 0; i < n; i++) {
    const v = e[i];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > k) return false;
    if (i > 0 && e[i] === e[i - 1]) return false;
  }
  return true;
}

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "CarlitzCompositions",
    paramCount: 1,
    kind: "ints",
    count: carlitzCompositionsCount,
    unrank: carlitzCompositionsUnrank,
    rank: carlitzCompositionsRank,
    valid: carlitzCompositionsValid,
  },
  {
    head: "SmirnovWords",
    paramCount: 2,
    kind: "ints",
    count: smirnovWordsCount,
    unrank: smirnovWordsUnrank,
    rank: smirnovWordsRank,
    valid: smirnovWordsValid,
  },
];
