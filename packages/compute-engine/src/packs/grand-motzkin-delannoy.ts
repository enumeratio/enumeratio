// pack-w.ts — pure-TS rank/unrank kernels for two combinatorial collections:
// GrandMotzkinPaths(n) and DelannoyPaths(n). Self-contained: no imports, no
// I/O, plain JS numbers/arrays. See .scratch/pack-w-selfcert.mts for the
// exhaustive rank(unrank(p,r),p)===r certification (GrandMotzkinPaths n=0..9,
// DelannoyPaths n=0..5) plus the central-trinomial / central-Delannoy
// reference-value checks.

import type { PackEntry } from "./types.js";

const normRank = (r: number, total: number): number =>
  total > 0 ? (((Math.trunc(r) % total) + total) % total) : 0;

// ─── GrandMotzkinPaths(n): length-n paths with steps U=+1, LEVEL=0, D=-1, starting AND
// ending at height 0, with NO non-negativity constraint — free to wander below zero (unlike
// the ordinary Motzkin paths in pack-o.ts, which are floored at h>=0). Counted by the central
// trinomial coefficient — the coefficient of x^n in (1+x+x^2)^n: 1,1,3,7,19,51,141,... g(rem,h)
// = number of length-rem completions from height h back to 0, h ranging over ALL integers:
// g(0,h)=[h===0], g(rem,h) = g(rem-1,h+1) [U] + g(rem-1,h) [LEVEL] + g(rem-1,h-1) [D]. Since a
// height reachable in <=n steps never exceeds n in magnitude, the table shifts h by +n (hh =
// h+n) so it fits a plain 0-based array of size 2n+1; count(n) = g(n, h=0 -> hh=n). unrank/rank
// walk the same three-way split at each position in the fixed order U, LEVEL, D. ─────────────

function grandMotzkinTable(n: number): number[][] {
  // g[rem][hh] = # length-rem paths from height (hh-n) back to height 0, unconstrained.
  const size = 2 * n + 1;
  const g: number[][] = [];
  for (let rem = 0; rem <= n; rem++) g.push(new Array(size).fill(0));
  g[0][n] = 1; // rem=0, height 0 (hh=n): exactly one (empty) completion
  for (let rem = 1; rem <= n; rem++) {
    for (let hh = 0; hh < size; hh++) {
      const u = hh + 1 < size ? g[rem - 1][hh + 1] : 0; // U: h -> h+1
      const l = g[rem - 1][hh]; // LEVEL: h unchanged
      const d = hh - 1 >= 0 ? g[rem - 1][hh - 1] : 0; // D: h -> h-1
      g[rem][hh] = u + l + d;
    }
  }
  return g;
}

function grandMotzkinPathsCount(p: number[]): number {
  const n = p[0];
  if (n < 0) return 0;
  return grandMotzkinTable(n)[n][n];
}

function grandMotzkinPathsUnrank(p: number[], r: number): number[] {
  const n = p[0];
  if (n <= 0) return [];
  const g = grandMotzkinTable(n);
  const size = g[0].length;
  let rem_r = normRank(r, g[n][n]);
  const out: number[] = [];
  let hh = n; // current height, offset by +n; starts at height 0
  for (let rem = n; rem > 0; rem--) {
    const u = hh + 1 < size ? g[rem - 1][hh + 1] : 0;
    if (rem_r < u) {
      out.push(1); // U
      hh++;
      continue;
    }
    rem_r -= u;
    const l = g[rem - 1][hh];
    if (rem_r < l) {
      out.push(0); // LEVEL
      continue;
    }
    rem_r -= l;
    out.push(-1); // D (the only choice left)
    hh--;
  }
  return out;
}

function grandMotzkinPathsRank(e: any, p: number[]): number {
  const n = p[0];
  if (n <= 0) return 0;
  const g = grandMotzkinTable(n);
  const size = g[0].length;
  const seq = e as number[];
  let hh = n;
  let rank = 0;
  for (let i = 0; i < seq.length; i++) {
    const rem = seq.length - i;
    const u = hh + 1 < size ? g[rem - 1][hh + 1] : 0;
    const tok = seq[i];
    if (tok === 1) {
      hh++; // U: no earlier siblings
    } else if (tok === 0) {
      rank += u; // LEVEL: U came before it
      // hh unchanged
    } else {
      const l = g[rem - 1][hh];
      rank += u + l; // D: both U and LEVEL came before it
      hh--;
    }
  }
  return rank;
}

function grandMotzkinPathsValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e) || e.length !== n) return false;
  let h = 0;
  for (const step of e) {
    if (step !== 1 && step !== 0 && step !== -1) return false;
    h += step;
  }
  return h === 0; // no floor on h along the way — only the endpoint matters
}

// ─── DelannoyPaths(n): lattice paths from (0,0) to (n,n) using steps E=(1,0), N=(0,1), and the
// diagonal D=(1,1) — encoded as a token sequence over {0=E,1=N,2=D} whose LENGTH varies (n, for
// an all-diagonal path, up to 2n for an all-E/N path). Counted by the central Delannoy number:
// 1,3,13,63,321,1683,... f(i,j) = # paths from (i,j) to (n,n): f(n,n)=1, f(i,j) = f(i+1,j) [E,
// if i+1<=n] + f(i,j+1) [N, if j+1<=n] + f(i+1,j+1) [D, if both in range]. count(n) = f(0,0).
// unrank/rank walk from (0,0) toward (n,n), trying E then N then D at each step (an out-of-range
// move — one that would overshoot n — simply has block size 0 and is skipped). ─────────────────

function delannoyTable(n: number): number[][] {
  // f[i][j] = # Delannoy paths from (i,j) to (n,n).
  const f: number[][] = [];
  for (let i = 0; i <= n; i++) f.push(new Array(n + 1).fill(0));
  f[n][n] = 1;
  for (let i = n; i >= 0; i--) {
    for (let j = n; j >= 0; j--) {
      if (i === n && j === n) continue; // base case already set
      const e = i + 1 <= n ? f[i + 1][j] : 0;
      const nStep = j + 1 <= n ? f[i][j + 1] : 0;
      const d = i + 1 <= n && j + 1 <= n ? f[i + 1][j + 1] : 0;
      f[i][j] = e + nStep + d;
    }
  }
  return f;
}

function delannoyPathsCount(p: number[]): number {
  const n = p[0];
  if (n < 0) return 0;
  return delannoyTable(n)[0][0];
}

function delannoyPathsUnrank(p: number[], r: number): number[] {
  const n = p[0];
  if (n <= 0) return [];
  const f = delannoyTable(n);
  let rem_r = normRank(r, f[0][0]);
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < n) {
    const blockE = i + 1 <= n ? f[i + 1][j] : 0;
    if (rem_r < blockE) {
      out.push(0); // E
      i++;
      continue;
    }
    rem_r -= blockE;
    const blockN = j + 1 <= n ? f[i][j + 1] : 0;
    if (rem_r < blockN) {
      out.push(1); // N
      j++;
      continue;
    }
    rem_r -= blockN;
    out.push(2); // D (the only choice left)
    i++;
    j++;
  }
  return out;
}

function delannoyPathsRank(e: any, p: number[]): number {
  const n = p[0];
  if (n <= 0) return 0;
  const f = delannoyTable(n);
  const seq = e as number[];
  let i = 0;
  let j = 0;
  let rank = 0;
  for (const step of seq) {
    if (step === 0) {
      i++; // E: no earlier siblings
      continue;
    }
    const blockE = i + 1 <= n ? f[i + 1][j] : 0;
    rank += blockE;
    if (step === 1) {
      j++; // N: E came before it
      continue;
    }
    const blockN = j + 1 <= n ? f[i][j + 1] : 0;
    rank += blockN; // D: both E and N came before it
    i++;
    j++;
  }
  return rank;
}

function delannoyPathsValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  let i = 0;
  let j = 0;
  for (const step of e) {
    if (step === 0) i++;
    else if (step === 1) j++;
    else if (step === 2) {
      i++;
      j++;
    } else return false;
    if (i > n || j > n) return false; // overshoot past the target corner
  }
  return i === n && j === n;
}

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "GrandMotzkinPaths",
    paramCount: 1,
    kind: "ints",
    count: grandMotzkinPathsCount,
    unrank: grandMotzkinPathsUnrank,
    rank: grandMotzkinPathsRank,
    valid: grandMotzkinPathsValid,
  },
  {
    head: "DelannoyPaths",
    paramCount: 1,
    kind: "ints",
    count: delannoyPathsCount,
    unrank: delannoyPathsUnrank,
    rank: delannoyPathsRank,
    valid: delannoyPathsValid,
  },
];
