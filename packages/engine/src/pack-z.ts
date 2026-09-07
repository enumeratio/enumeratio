// pack-z.ts — pure-TS rank/unrank kernels for two combinatorial collections:
// BinaryStringsAvoiding101(n) and BinaryStringsAvoiding0101(n). Self-contained: no
// imports, no I/O, plain JS numbers/arrays. See .scratch/pack-z-selfcert.mts for
// the exhaustive rank(unrank(p,r),p)===r certification plus an independent
// brute-force (generate-all-2^n-strings-and-filter) cross-check of count()/valid().

export type PackEntry = {
  head: string; // PascalCase MathJSON head, e.g. "BinaryStringsAvoiding101"
  paramCount: 1 | 2; // number of integer parameters
  kind: "ints" | "blocks"; // element shape: flat int list, OR a list of int lists
  count: (p: number[]) => number; // p = [n]; closed recurrence
  unrank: (p: number[], r: number) => number[] | number[][]; // 0-based
  rank: (e: any, p: number[]) => number; // exact 0-based inverse of unrank
  valid: (e: any, p: number[]) => boolean; // is e a member of this collection at params p
};

const normRank = (r: number, total: number): number =>
  total > 0 ? (((Math.trunc(r) % total) + total) % total) : 0;

// ─── shared machinery: a length-n {0,1}-string avoiding a fixed binary factor PATTERN ─────────────────
// (both collections below are instances of this, avoiding "101" and "0101" respectively). The automaton
// is the classic KMP failure-function construction: state q in 0..m (m = pattern length) is "the longest
// suffix of the string read so far that is also a prefix of PATTERN" — q===m means PATTERN has occurred
// (the "dead" state, excluded from every count below since we only count strings that AVOID it). delta[q]
// [c] is the next state on reading bit c. buildCompletionsTable(n) then gives table[k][q] = number of
// length-k completions from state q that never touch the dead state; count/unrank/rank all read off that
// same table (unrank/rank do NOT reuse a separate machine — the DFA driving them here is this one; the
// independent cross-check lives only in valid(), via a bare substring scan, and in the selfcert script's
// brute force). ─────────────────────────────────────────────────────────────────────────────────────────

function kmpFailure(pattern: number[]): number[] {
  const m = pattern.length;
  const pi = new Array(m).fill(0);
  let k = 0;
  for (let i = 1; i < m; i++) {
    while (k > 0 && pattern[i] !== pattern[k]) k = pi[k - 1];
    if (pattern[i] === pattern[k]) k++;
    pi[i] = k;
  }
  return pi;
}

function buildDelta(pattern: number[]): number[][] {
  const m = pattern.length;
  const pi = kmpFailure(pattern);
  // delta[q][c], q=0..m (q===m is the dead/pattern-complete state), c in {0,1}.
  const delta: number[][] = [];
  for (let q = 0; q <= m; q++) delta.push([0, 0]);
  for (let q = 0; q <= m; q++) {
    for (const c of [0, 1]) {
      if (q < m && pattern[q] === c) delta[q][c] = q + 1;
      else if (q === 0) delta[q][c] = 0;
      else delta[q][c] = delta[pi[q - 1]][c]; // pi[q-1] < q: already filled in this loop
    }
  }
  return delta;
}

// table[k][q] = number of length-k completions from state q that never reach the dead state m.
// Iterative (not recursive) so it stays stack-safe for large n.
function buildCompletionsTable(delta: number[][], m: number, n: number): number[][] {
  const table: number[][] = new Array(n + 1);
  table[0] = new Array(m).fill(1); // nothing left to place: exactly one (empty) completion from any live state
  for (let k = 1; k <= n; k++) {
    const prev = table[k - 1];
    const row = new Array(m).fill(0);
    for (let q = 0; q < m; q++) {
      let total = 0;
      for (const c of [0, 1]) {
        const nq = delta[q][c];
        if (nq < m) total += prev[nq];
      }
      row[q] = total;
    }
    table[k] = row;
  }
  return table;
}

function avoidingCount(pattern: number[], n: number): number {
  if (n < 0) return 0;
  const m = pattern.length;
  const delta = buildDelta(pattern);
  return buildCompletionsTable(delta, m, n)[n][0];
}

function avoidingUnrank(pattern: number[], n: number, r: number): number[] {
  if (n <= 0) return [];
  const m = pattern.length;
  const delta = buildDelta(pattern);
  const table = buildCompletionsTable(delta, m, n);
  const total = table[n][0];
  let rem = normRank(r, total);
  let state = 0;
  const bits: number[] = [];
  for (let i = 0; i < n; i++) {
    const remaining = n - i - 1;
    const nq0 = delta[state][0];
    const c0 = nq0 < m ? table[remaining][nq0] : 0;
    if (rem < c0) {
      bits.push(0);
      state = nq0;
    } else {
      rem -= c0;
      bits.push(1);
      state = delta[state][1];
    }
  }
  return bits;
}

function avoidingRank(pattern: number[], e: any): number {
  const bits = e as number[];
  const n = bits.length;
  if (n <= 0) return 0;
  const m = pattern.length;
  const delta = buildDelta(pattern);
  const table = buildCompletionsTable(delta, m, n);
  let state = 0;
  let r = 0;
  for (let i = 0; i < n; i++) {
    const remaining = n - i - 1;
    const bit = bits[i];
    if (bit === 1) {
      const nq0 = delta[state][0];
      r += nq0 < m ? table[remaining][nq0] : 0;
    }
    state = delta[state][bit];
  }
  return r;
}

// Independent avoidance check — a bare substring scan, deliberately NOT built from delta/table above,
// so valid() can't agree with a bug shared by count/unrank/rank's shared automaton.
function containsFactor(bits: number[], pattern: number[]): boolean {
  const n = bits.length;
  const m = pattern.length;
  for (let i = 0; i + m <= n; i++) {
    let match = true;
    for (let j = 0; j < m; j++) {
      if (bits[i + j] !== pattern[j]) { match = false; break; }
    }
    if (match) return true;
  }
  return false;
}

function avoidingValid(pattern: number[], e: any, n: number): boolean {
  if (!Array.isArray(e) || e.length !== n) return false;
  for (const b of e) {
    if (b !== 0 && b !== 1) return false;
  }
  return !containsFactor(e, pattern);
}

// ─── BinaryStringsAvoiding101(n): length-n strings over {0,1} with no occurrence of the factor "101". ──

const PATTERN_101 = [1, 0, 1];

function binaryStringsAvoiding101Count(p: number[]): number {
  return avoidingCount(PATTERN_101, p[0]);
}
function binaryStringsAvoiding101Unrank(p: number[], r: number): number[] {
  return avoidingUnrank(PATTERN_101, p[0], r);
}
function binaryStringsAvoiding101Rank(e: any, _p: number[]): number {
  return avoidingRank(PATTERN_101, e);
}
function binaryStringsAvoiding101Valid(e: any, p: number[]): boolean {
  return avoidingValid(PATTERN_101, e, p[0]);
}

// ─── BinaryStringsAvoiding0101(n): length-n strings over {0,1} with no occurrence of the factor "0101". ─

const PATTERN_0101 = [0, 1, 0, 1];

function binaryStringsAvoiding0101Count(p: number[]): number {
  return avoidingCount(PATTERN_0101, p[0]);
}
function binaryStringsAvoiding0101Unrank(p: number[], r: number): number[] {
  return avoidingUnrank(PATTERN_0101, p[0], r);
}
function binaryStringsAvoiding0101Rank(e: any, _p: number[]): number {
  return avoidingRank(PATTERN_0101, e);
}
function binaryStringsAvoiding0101Valid(e: any, p: number[]): boolean {
  return avoidingValid(PATTERN_0101, e, p[0]);
}

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "BinaryStringsAvoiding101",
    paramCount: 1,
    kind: "ints",
    count: binaryStringsAvoiding101Count,
    unrank: binaryStringsAvoiding101Unrank,
    rank: binaryStringsAvoiding101Rank,
    valid: binaryStringsAvoiding101Valid,
  },
  {
    head: "BinaryStringsAvoiding0101",
    paramCount: 1,
    kind: "ints",
    count: binaryStringsAvoiding0101Count,
    unrank: binaryStringsAvoiding0101Unrank,
    rank: binaryStringsAvoiding0101Rank,
    valid: binaryStringsAvoiding0101Valid,
  },
];
