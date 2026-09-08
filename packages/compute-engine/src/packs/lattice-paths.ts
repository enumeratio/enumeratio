// Lattice paths & Catalan objects — Dyck/Motzkin/Schröder/Delannoy step-sequences, standard Young
// tableaux, triangulations, and non-crossing matchings. Pure-TS rank/unrank kernels: no I/O, plain
// JS numbers/arrays. Consolidated from five parallel-authored packs; every kernel's
// rank(unrank(p,r),p)===r certification lives in test/selfcert.test.ts.

import type { PackEntry } from "./types.js";
import { binomial } from "./_shared.js";

const normRank = (r: number, total: number): number =>
  total > 0 ? (((Math.trunc(r) % total) + total) % total) : 0;

// ---- GrandDyckPaths(n) ------------------------------------------------------
// Free lattice paths of 2n steps over {+1,-1}, starting and ending at height
// 0, with NO non-negativity constraint (allowed below zero) — i.e. any
// sequence of n up-steps and n down-steps in any order. Count = C(2n,n):
// choose which n of the 2n positions are up-steps. unrank/rank delegate
// straight to a colex-order k-subset unrank/rank on the up-step positions.

// Colex (combinatorial number system) unrank of a k-subset of {0,...,N-1}.
// Standard combinadic decomposition: find the subset {c_k>...>c_1} such that
// r = C(c_k,k)+C(c_{k-1},k-1)+...+C(c_1,1), by greedily taking the largest
// candidate at each digit whose binomial coefficient still fits under the
// remaining rank. Returns the subset sorted ascending.
function kSubsetUnrank(N: number, k: number, r: number): number[] {
  const descending: number[] = [];
  let rem = r;
  let upperBound = N - 1; // largest value still eligible (must stay < previous pick)
  for (let kk = k; kk >= 1; kk--) {
    let c = upperBound;
    while (binomial(c, kk) > rem) c--;
    descending.push(c);
    rem -= binomial(c, kk);
    upperBound = c - 1;
  }
  return descending.reverse();
}

// Exact inverse of kSubsetUnrank: given a subset sorted ascending, recover
// its colex rank as sum_j C(e[j], j+1) (the same combinadic sum, read off
// an ascending array instead of descending).
function kSubsetRank(ascending: number[]): number {
  let rank = 0;
  for (let j = 0; j < ascending.length; j++) rank += binomial(ascending[j], j + 1);
  return rank;
}

function grandDyckPathsCount(p: number[]): number {
  const n = p[0];
  return binomial(2 * n, n);
}

function grandDyckPathsUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const N = 2 * n;
  const ups = kSubsetUnrank(N, n, r);
  const path = new Array(N).fill(-1);
  for (const pos of ups) path[pos] = 1;
  return path;
}

function grandDyckPathsRank(e: number[], p: number[]): number {
  const positions: number[] = [];
  for (let i = 0; i < e.length; i++) if (e[i] === 1) positions.push(i);
  return kSubsetRank(positions);
}

function grandDyckPathsValid(e: any, p: number[]): boolean {
  const n = p[0];
  const N = 2 * n;
  if (!Array.isArray(e) || e.length !== N) return false;
  let sum = 0;
  for (const v of e) {
    if (v !== 1 && v !== -1) return false;
    sum += v;
  }
  return sum === 0;
}

// ---- GrandMotzkinPaths(n) / DelannoyPaths(n) -------------------------------

// ─── GrandMotzkinPaths(n): length-n paths with steps U=+1, LEVEL=0, D=-1, starting AND
// ending at height 0, with NO non-negativity constraint — free to wander below zero (unlike
// the ordinary Motzkin paths, which are floored at h>=0). Counted by the central trinomial
// coefficient — the coefficient of x^n in (1+x+x^2)^n: 1,1,3,7,19,51,141,... g(rem,h)
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

// ─── BicoloredMotzkinPaths(n): Motzkin paths of length n (steps U=+1, D=-1, LEVEL=0)
// that stay at height >=0 throughout and end back at height 0, where every LEVEL step
// carries one of 2 colors. Encoded as a flat token sequence: 1=U, -1=D, 10=level-color-0,
// 11=level-color-1. g(rem,h) = number of ways to complete `rem` more steps from height h
// down to 0 while staying >=0: g(0,h)=[h===0], g(rem,h) = g(rem-1,h+1) [U, always valid]
// + 2*g(rem-1,h) [level, 2 colors] + (h>=1 ? g(rem-1,h-1) : 0) [D, needs h>=1]. count(n) =
// g(n,0), evaluated directly from this DP table (not hardcoded). This DP-derived count
// sequence turns out to equal Catalan(n+1) (n=0:1, n=1:2, n=2:5, ...) — a known bijective
// fact for 2-colored Motzkin paths — but count() below always returns the table value, so
// if that identity ever broke for some n the table (not the formula) would still be right.
// unrank/rank walk the same four-way split in a fixed order — U, level-color-0,
// level-color-1, D — so the two are exact inverses of each other. ───────────────────────

function bicoloredMotzkinTable(n: number): number[][] {
  const g: number[][] = [];
  for (let rem = 0; rem <= n; rem++) g.push(new Array(n + 2).fill(0));
  for (let h = 0; h <= n + 1; h++) g[0][h] = h === 0 ? 1 : 0;
  for (let rem = 1; rem <= n; rem++) {
    for (let h = 0; h <= n; h++) {
      const u = g[rem - 1][h + 1] ?? 0;
      const l = g[rem - 1][h];
      const d = h >= 1 ? g[rem - 1][h - 1] : 0;
      g[rem][h] = u + 2 * l + d;
    }
  }
  return g;
}

function bicoloredMotzkinCount(p: number[]): number {
  const n = p[0];
  if (n < 0) return 0;
  return bicoloredMotzkinTable(n)[n][0];
}

function bicoloredMotzkinUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const g = bicoloredMotzkinTable(n);
  let rr = normRank(r, g[n][0]);
  const out: number[] = [];
  let h = 0;
  for (let rem = n; rem > 0; rem--) {
    const u = g[rem - 1][h + 1] ?? 0;
    if (rr < u) {
      out.push(1);
      h++;
      continue;
    }
    rr -= u;
    const l = g[rem - 1][h];
    if (rr < l) {
      out.push(10);
      continue;
    }
    rr -= l;
    if (rr < l) {
      out.push(11);
      continue;
    }
    rr -= l;
    const d = h >= 1 ? g[rem - 1][h - 1] : 0;
    if (rr < d) {
      out.push(-1);
      h--;
      continue;
    }
    throw new Error(`BicoloredMotzkinPaths: rank out of range for n=${n}`);
  }
  return out;
}

function bicoloredMotzkinRank(e: any, p: number[]): number {
  const n = p[0];
  const g = bicoloredMotzkinTable(n);
  const seq: number[] = e;
  let h = 0;
  let rank = 0;
  for (let i = 0; i < seq.length; i++) {
    const rem = seq.length - i;
    const u = g[rem - 1][h + 1] ?? 0;
    const l = g[rem - 1][h];
    const tok = seq[i];
    if (tok === 1) h++;
    else if (tok === 10) rank += u;
    else if (tok === 11) rank += u + l;
    else if (tok === -1) {
      rank += u + 2 * l;
      h--;
    }
  }
  return rank;
}

function bicoloredMotzkinValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e) || e.length !== n) return false;
  let h = 0;
  for (const tok of e) {
    if (tok === 1) h++;
    else if (tok === -1) {
      if (h === 0) return false;
      h--;
    } else if (tok !== 10 && tok !== 11) return false;
  }
  return h === 0;
}

// ---- StandardYoungTableaux2xN(n) -------------------------------------------
// Standard Young tableaux of the 2×n rectangular shape: two rows of length n
// filled with 1..2n, strictly increasing along each row (left to right) and
// down each column. Bijects with ballot sequences of n U's + n D's (U = goes
// to row1, D = goes to row2): scanning values 1..2n in increasing order,
// value i is assigned to row1 or row2; column-strictness requires row1's
// column j to already hold a smaller value before row2 fills the same
// column j — i.e. at the moment a D is placed, more U's than D's have been
// placed so far. That's exactly the classic Dyck/ballot admissibility
// condition, and the resulting bijection has count = Catalan(n).
//
// sytCountUD(u,d) = # valid completions with u U's and d D's remaining,
// given the prefix built so far is already admissible. Admissibility of
// taking a D from state (u,d) reduces to the local test d>u (remaining d
// exceeds remaining u), which is equivalent to "more U's placed than D's so
// far" since placed-so-far = (n-u, n-d). unrank/rank walk the U-branch
// before the D-branch at every position, so they are exact inverses by
// construction; sytCountUD(n,n) = Catalan(n).

function sytCountUD(u: number, d: number, memo: Map<string, number>): number {
  if (u === 0 && d === 0) return 1;
  const key = u + "," + d;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  let total = 0;
  if (u > 0) total += sytCountUD(u - 1, d, memo);
  if (d > 0 && d > u) total += sytCountUD(u, d - 1, memo);
  memo.set(key, total);
  return total;
}

function syt2xnCount(p: number[]): number {
  const n = p[0];
  return sytCountUD(n, n, new Map());
}

function syt2xnUnrank(p: number[], r: number): number[][] {
  const n = p[0];
  const memo = new Map<string, number>();
  let u = n;
  let d = n;
  let rem = r;
  const row1: number[] = [];
  const row2: number[] = [];
  for (let i = 1; i <= 2 * n; i++) {
    const cU = u > 0 ? sytCountUD(u - 1, d, memo) : 0;
    if (u > 0 && rem < cU) {
      row1.push(i);
      u--;
    } else {
      if (u > 0) rem -= cU;
      row2.push(i);
      d--;
    }
  }
  return [row1, row2];
}

function syt2xnRank(e: number[][], p: number[]): number {
  const n = p[0];
  const memo = new Map<string, number>();
  const row1 = e[0] ?? [];
  const isRow1 = new Array(2 * n + 1).fill(false);
  for (const v of row1) isRow1[v] = true;
  let u = n;
  let d = n;
  let rank = 0;
  for (let i = 1; i <= 2 * n; i++) {
    const cU = u > 0 ? sytCountUD(u - 1, d, memo) : 0;
    if (isRow1[i]) {
      u--;
    } else {
      rank += cU;
      d--;
    }
  }
  return rank;
}

function syt2xnValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e) || e.length !== 2) return false;
  const [row1, row2] = e;
  if (!Array.isArray(row1) || !Array.isArray(row2)) return false;
  if (row1.length !== n || row2.length !== n) return false;
  const seen = new Array(2 * n + 1).fill(false);
  for (let i = 0; i < n; i++) {
    const v = row1[i];
    if (!Number.isInteger(v) || v < 1 || v > 2 * n || seen[v]) return false;
    seen[v] = true;
    if (i > 0 && v <= row1[i - 1]) return false;
  }
  for (let i = 0; i < n; i++) {
    const v = row2[i];
    if (!Number.isInteger(v) || v < 1 || v > 2 * n || seen[v]) return false;
    seen[v] = true;
    if (i > 0 && v <= row2[i - 1]) return false;
  }
  for (let i = 0; i < n; i++) {
    if (row1[i] >= row2[i]) return false; // column-strict: row1 sits above row2
  }
  return true;
}

// ---- LittleSchroderPaths(n) -------------------------------------------------
// Schröder paths of width 2n: steps U (+1, width 1), D (-1, width 1), and L
// (level, width 2), starting and ending at height 0, never going below the
// x-axis, with NO level step taken while at height 0 (that restriction is
// what turns the (big) Schröder count into the LITTLE Schröder / super-
// Catalan number: 1,1,3,11,45,197,...).
//
// schroderCountG(w,h) = # valid completions from "w width remaining, at
// height h": w===0 accepts only h===0; otherwise try U (w-1,h+1, always
// legal), D (w-1,h-1, only if h>0 so height can't go negative), then L
// (w-2,h, only if h>0 per the no-level-on-axis rule and w>=2). unrank/rank
// walk the same U-then-D-then-L branch order at every step, so they are
// exact inverses by construction; schroderCountG(2n,0) is the little
// Schröder number s(n).

function schroderCountG(w: number, h: number, memo: Map<string, number>): number {
  if (w === 0) return h === 0 ? 1 : 0;
  const key = w + "," + h;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  let total = schroderCountG(w - 1, h + 1, memo); // U
  if (h > 0) total += schroderCountG(w - 1, h - 1, memo); // D
  if (h > 0 && w >= 2) total += schroderCountG(w - 2, h, memo); // L
  memo.set(key, total);
  return total;
}

function littleSchroderCount(p: number[]): number {
  const n = p[0];
  return schroderCountG(2 * n, 0, new Map());
}

function littleSchroderUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const memo = new Map<string, number>();
  let w = 2 * n;
  let h = 0;
  let rem = r;
  const seq: number[] = [];
  while (!(w === 0 && h === 0)) {
    const cU = schroderCountG(w - 1, h + 1, memo);
    if (rem < cU) {
      seq.push(1);
      w -= 1;
      h += 1;
      continue;
    }
    rem -= cU;
    const cD = h > 0 ? schroderCountG(w - 1, h - 1, memo) : 0;
    if (h > 0 && rem < cD) {
      seq.push(-1);
      w -= 1;
      h -= 1;
      continue;
    }
    if (h > 0) rem -= cD;
    seq.push(2); // L
    w -= 2;
  }
  return seq;
}

function littleSchroderRank(e: number[], p: number[]): number {
  const n = p[0];
  const memo = new Map<string, number>();
  let w = 2 * n;
  let h = 0;
  let rank = 0;
  for (const tok of e) {
    const cU = schroderCountG(w - 1, h + 1, memo);
    if (tok === 1) {
      w -= 1;
      h += 1;
      continue;
    }
    rank += cU;
    const cD = h > 0 ? schroderCountG(w - 1, h - 1, memo) : 0;
    if (tok === -1) {
      w -= 1;
      h -= 1;
      continue;
    }
    rank += cD;
    w -= 2; // L
  }
  return rank;
}

function littleSchroderValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  let w = 0;
  let h = 0;
  for (const tok of e) {
    if (tok === 1) {
      h += 1;
      w += 1;
    } else if (tok === -1) {
      h -= 1;
      w += 1;
      if (h < 0) return false;
    } else if (tok === 2) {
      if (h === 0) return false; // no level step on the x-axis
      w += 2;
    } else {
      return false;
    }
  }
  return h === 0 && w === 2 * n;
}

// ---- Triangulations(n) / NonCrossingMatchings(n) ---------------------------
// Both collections decompose by the same Catalan convolution, just over different
// combinatorial objects (diagonals vs. chords) — same block sizes, same unrank/rank duality.

// Catalan numbers, memoized. C_0=1, C_n = sum_{i=0}^{n-1} C_i * C_{n-1-i}.
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
    head: "GrandDyckPaths",
    paramCount: 1,
    kind: "ints",
    count: grandDyckPathsCount,
    unrank: grandDyckPathsUnrank,
    rank: grandDyckPathsRank,
    valid: grandDyckPathsValid,
  },
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
  {
    head: "BicoloredMotzkinPaths",
    paramCount: 1,
    kind: "ints",
    count: bicoloredMotzkinCount,
    unrank: bicoloredMotzkinUnrank,
    rank: bicoloredMotzkinRank,
    valid: bicoloredMotzkinValid,
  },
  {
    head: "StandardYoungTableaux2xN",
    paramCount: 1,
    kind: "blocks",
    count: syt2xnCount,
    unrank: syt2xnUnrank,
    rank: syt2xnRank,
    valid: syt2xnValid,
  },
  {
    head: "LittleSchroderPaths",
    paramCount: 1,
    kind: "ints",
    count: littleSchroderCount,
    unrank: littleSchroderUnrank,
    rank: littleSchroderRank,
    valid: littleSchroderValid,
  },
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
