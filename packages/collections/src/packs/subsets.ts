// Subsets: size-bounded, parity-bounded, and gap-avoiding subset families. Pure
// rank/unrank kernels over plain JS numbers/arrays, lifted from the sibling
// @enumeratio library. Each kernel satisfies rank(unrank(p, r), p) === r.

import { binomial } from "./shared.ts";
import type { PackEntry } from "./types.ts";

const normRank = (r: number, total: number): number =>
  total > 0 ? ((Math.trunc(r) % total) + total) % total : 0;

// SubsetsWithoutConsecutive(n): subsets of {1,...,n} with no two consecutive
// integers. Count is the Fibonacci number a(n) = F(n+2). unrank puts the
// "exclude n" block first (size a(n-1)), then "include n" (size a(n-2)).
function subsetsNoConsecTable(n: number): number[] {
  const a: number[] = Array.from({ length: Math.max(n, 0) + 1 }, () => 0);
  a[0] = 1;
  if (n >= 1) a[1] = 2;
  for (let m = 2; m <= n; m++) a[m] = a[m - 1] + a[m - 2];
  return a;
}

function subsetsNoConsecCount(p: number[]): number {
  const n = p[0];
  if (n < 0) return 0;
  return subsetsNoConsecTable(n)[n];
}

function unrankSubsetsNoConsec(n: number, r: number, a: number[]): number[] {
  if (n === 0) return [];
  if (n === 1) return r === 0 ? [] : [1];
  const excludeBlock = a[n - 1];
  if (r < excludeBlock) return unrankSubsetsNoConsec(n - 1, r, a);
  const rest = unrankSubsetsNoConsec(n - 2, r - excludeBlock, a);
  return [...rest, n];
}

function rankSubsetsNoConsec(e: number[], n: number, a: number[]): number {
  if (n === 0) return 0;
  if (n === 1) return e.length === 0 ? 0 : 1;
  if (e.length === 0 || e[e.length - 1] !== n) {
    return rankSubsetsNoConsec(e, n - 1, a);
  }
  return a[n - 1] + rankSubsetsNoConsec(e.slice(0, -1), n - 2, a);
}

function subsetsWithoutConsecutiveUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const a = subsetsNoConsecTable(n);
  return unrankSubsetsNoConsec(n, normRank(r, a[n] ?? 0), a);
}

function subsetsWithoutConsecutiveRank(e: unknown, p: number[]): number {
  const n = p[0];
  return rankSubsetsNoConsec(e as number[], n, subsetsNoConsecTable(n));
}

function subsetsWithoutConsecutiveValid(e: unknown, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  for (let i = 0; i < e.length; i++) {
    const x: unknown = e[i];
    if (typeof x !== "number" || !Number.isInteger(x) || x < 1 || x > n) return false;
    if (i > 0 && x <= e[i - 1] + 1) return false;
  }
  return true;
}

// SubsetsOfSizeAtMost(n, k): subsets of {1,...,n} of size <= k, ordered by size
// then colex within a size block. count(n, k) = sum_{i=0}^{k} C(n, i).
function kSubsetUnrank(n: number, k: number, r: number): number[] {
  if (k === 0) return [];
  const c: number[] = Array.from({ length: k }, () => 0);
  let rem = r;
  for (let i = k; i >= 1; i--) {
    let ci = i - 1;
    while (ci + 1 <= n - 1 && binomial(ci + 1, i) <= rem) ci++;
    c[i - 1] = ci;
    rem -= binomial(ci, i);
  }
  return c;
}

function kSubsetRank(e0: number[]): number {
  let r = 0;
  for (let i = 1; i <= e0.length; i++) r += binomial(e0[i - 1], i);
  return r;
}

function subsetsAtMostKCount(p: number[]): number {
  const [n, k] = p;
  if (n < 0 || k < 0) return 0;
  let total = 0;
  for (let i = 0; i <= k; i++) total += binomial(n, i);
  return total;
}

function subsetsAtMostKUnrank(p: number[], r: number): number[] {
  const [n, k] = p;
  let rr = normRank(r, subsetsAtMostKCount(p));
  for (let size = 0; size <= k; size++) {
    const block = binomial(n, size);
    if (rr < block) return kSubsetUnrank(n, size, rr).map((x) => x + 1);
    rr -= block;
  }
  throw new Error(`SubsetsOfSizeAtMost: rank out of range for n=${n}, k=${k}`);
}

function subsetsAtMostKRank(e: unknown, p: number[]): number {
  const n = p[0];
  const es = e as number[];
  let offset = 0;
  for (let i = 0; i < es.length; i++) offset += binomial(n, i);
  return offset + kSubsetRank(es.map((x) => x - 1));
}

function subsetsAtMostKValid(e: unknown, p: number[]): boolean {
  const [n, k] = p;
  if (!Array.isArray(e) || e.length > k) return false;
  for (let i = 0; i < e.length; i++) {
    const x: unknown = e[i];
    if (typeof x !== "number" || !Number.isInteger(x) || x < 1 || x > n) return false;
    if (i > 0 && x <= e[i - 1]) return false;
  }
  return true;
}

// EvenSubsets(n) / OddSubsets(n): subsets of {1,...,n} of even (resp. odd) size,
// bijected to all 2^(n-1) subsets S of {1,...,n-1} (adjoin n to flip parity).
function maskToSubset(mask: number, maxElem: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < maxElem; i++) if (mask & (1 << i)) out.push(i + 1);
  return out;
}

function subsetToMask(s: number[]): number {
  let mask = 0;
  for (const x of s) mask |= 1 << (x - 1);
  return mask;
}

function evenOddCount(n: number, wantOdd: boolean): number {
  if (n < 0) return 0;
  if (n === 0) return wantOdd ? 0 : 1;
  return 2 ** (n - 1);
}

function evenOddUnrank(p: number[], r: number, wantOdd: boolean): number[] {
  const n = p[0];
  if (n <= 0) return [];
  const s = maskToSubset(normRank(r, evenOddCount(n, wantOdd)), n - 1);
  const parityMatches = s.length % 2 === (wantOdd ? 1 : 0);
  return parityMatches ? s : [...s, n];
}

function evenOddRank(e: unknown, p: number[]): number {
  const n = p[0];
  if (n <= 0) return 0;
  const es = e as number[];
  const s = es.length > 0 && es[es.length - 1] === n ? es.slice(0, -1) : es;
  return subsetToMask(s);
}

function evenOddValid(e: unknown, p: number[], wantOdd: boolean): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  for (let i = 0; i < e.length; i++) {
    const x: unknown = e[i];
    if (typeof x !== "number" || !Number.isInteger(x) || x < 1 || x > n) return false;
    if (i > 0 && x <= e[i - 1]) return false;
  }
  return e.length % 2 === (wantOdd ? 1 : 0);
}

export const entries: readonly PackEntry[] = [
  {
    head: "SubsetsWithoutConsecutive",
    paramCount: 1,
    kind: "ints",
    count: subsetsNoConsecCount,
    unrank: subsetsWithoutConsecutiveUnrank,
    rank: subsetsWithoutConsecutiveRank,
    valid: subsetsWithoutConsecutiveValid,
  },
  {
    head: "SubsetsOfSizeAtMost",
    paramCount: 2,
    kind: "ints",
    count: subsetsAtMostKCount,
    unrank: subsetsAtMostKUnrank,
    rank: subsetsAtMostKRank,
    valid: subsetsAtMostKValid,
  },
  {
    head: "EvenSubsets",
    paramCount: 1,
    kind: "ints",
    count: (p) => evenOddCount(p[0], false),
    unrank: (p, r) => evenOddUnrank(p, r, false),
    rank: evenOddRank,
    valid: (e, p) => evenOddValid(e, p, false),
  },
  {
    head: "OddSubsets",
    paramCount: 1,
    kind: "ints",
    count: (p) => evenOddCount(p[0], true),
    unrank: (p, r) => evenOddUnrank(p, r, true),
    rank: evenOddRank,
    valid: (e, p) => evenOddValid(e, p, true),
  },
];
