// pack-l.ts — pure-TS rank/unrank kernels for two combinatorial collections:
// StandardYoungTableaux2xN(n) and LittleSchroderPaths(n). Self-contained: no
// imports, no I/O, plain JS numbers/arrays. See .scratch/pack-l-selfcert.mts
// for the exhaustive rank(unrank(p,r),p)===r certification over n=0..7.

export type PackEntry = {
  head: string; // PascalCase MathJSON head, e.g. "StandardYoungTableaux2xN"
  paramCount: 1 | 2; // number of integer parameters
  kind: "ints" | "blocks"; // element shape: flat int list, OR a list of int lists
  count: (p: number[]) => number; // p = [n] or [n,k]; closed-form or DP count
  unrank: (p: number[], r: number) => number[] | number[][]; // 0-based
  rank: (e: any, p: number[]) => number; // exact 0-based inverse of unrank
  valid: (e: any, p: number[]) => boolean; // is e a member of this collection at params p
};

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

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
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
];
