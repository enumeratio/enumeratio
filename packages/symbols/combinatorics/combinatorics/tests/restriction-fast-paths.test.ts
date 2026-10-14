// The direct tests behind Separable, Vexillary and Connected permutations and the k = n − 1 cycle fibers
// (collections/src/families/exact-triangles.ts), each held to a second route: pattern avoidance by brute
// force, the series 1 − 1/Σ n! xⁿ, the Schröder sum, the transpositions listed in lex order.
// tests/fast-kernels.test.ts holds the same families to Epsil; tests/lex-restriction-guard.test.ts to a
// time budget at large n.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { kernelOn } from "../collections/src/families/epsil.ts";
import {
  connectedExact,
  isConnectedPermutation,
  isSeparablePermutation,
  isVexillaryPermutation,
} from "../collections/src/families/exact-triangles.ts";
import { allFamilies } from "../collections/src/families/index.ts";

const ce = bareEngine();
const kernelFor = (head: string) =>
  kernelOn(
    ce,
    allFamilies.find((f) => f.head === head)!,
  );
const iota = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1);

/** Lexicographic order on permutations of one length. */
const lexically = (a: number[], b: number[]): number =>
  a[a.findIndex((v, i) => v !== b[i])] - b[a.findIndex((v, i) => v !== b[i])];

function permutationsOf(n: number): number[][] {
  const out: number[][] = [];
  const place = (prefix: number[], rest: number[]): void => {
    if (rest.length === 0) out.push(prefix);
    else
      rest.forEach((v, i) =>
        place(
          [...prefix, v],
          rest.filter((_, j) => j !== i),
        ),
      );
  };
  place([], iota(n));
  return out;
}

/** Whether `x` has a subsequence in the order pattern of `pattern`. */
function contains(x: number[], pattern: number[]): boolean {
  const k = pattern.length;
  const same = (at: number[]): boolean =>
    pattern.every((a, i) => pattern.every((b, j) => a < b === x[at[i]] < x[at[j]]));
  const search = (at: number[], from: number): boolean => {
    if (at.length === k) return same(at);
    for (let i = from; i < x.length; i++) if (search([...at, i], i + 1)) return true;
    return false;
  };
  return search([], 0);
}
const separableByPatterns = (x: number[]): boolean => !contains(x, [2, 4, 1, 3]) && !contains(x, [3, 1, 4, 2]);
const vexillaryByPatterns = (x: number[]): boolean => !contains(x, [2, 1, 4, 3]);
/** No proper prefix holds exactly the values 1 … j. */
const connectedByPrefixes = (x: number[]): boolean =>
  x.every((_, j) => j === x.length - 1 || Math.max(...x.slice(0, j + 1)) !== j + 1);

test("separable, vexillary and connected membership agree with the definitions on every permutation up to 7", () => {
  for (let n = 0; n <= 7; n++)
    for (const x of permutationsOf(n)) {
      expect([x, isSeparablePermutation(x, [n])]).toEqual([x, separableByPatterns(x)]);
      expect([x, isVexillaryPermutation(x, [n])]).toEqual([x, vexillaryByPatterns(x)]);
      expect([x, isConnectedPermutation(x, [n])]).toEqual([x, connectedByPrefixes(x)]);
    }
});

test("membership rejects what is not a permutation of n", () => {
  for (const member of [isSeparablePermutation, isVexillaryPermutation, isConnectedPermutation]) {
    for (const x of [[1, 1, 2], [1, 2], [0, 1, 2], [1, 2, 4], [1, 2, 3.5], "123", null])
      expect(member(x, [3])).toBe(false);
  }
});

// A fixed pseudo-random stream, so a failure repeats.
let seed = 0x9e3779b9;
const random = (below: number): number => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed % below;
};
/** A Fisher–Yates shuffle. */
function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A random separable permutation of n: a random separating tree, leaves 1 … n. */
function randomSeparable(n: number): number[] {
  if (n === 1) return [1];
  const left = 1 + random(n - 1);
  const [a, b] = [randomSeparable(left), randomSeparable(n - left)];
  return random(2) === 0 ? [...a, ...b.map((v) => v + left)] : [...a.map((v) => v + n - left), ...b];
}

test("longer permutations, random ones and separable ones with an entry moved, agree with the definitions", () => {
  for (let trial = 0; trial < 300; trial++) {
    const n = 8 + random(5);
    const x = randomSeparable(n);
    expect(isSeparablePermutation(x, [n])).toBe(true);
    // Two entries swapped, then a random shuffle.
    const moved = x.slice();
    const [i, j] = [random(n), random(n)];
    [moved[i], moved[j]] = [moved[j], moved[i]];
    const shuffled = shuffle(x);
    for (const y of [moved, shuffled]) {
      expect([y, isSeparablePermutation(y, [n])]).toEqual([y, separableByPatterns(y)]);
      expect([y, isVexillaryPermutation(y, [n])]).toEqual([y, vexillaryByPatterns(y)]);
      expect([y, isConnectedPermutation(y, [n])]).toEqual([y, connectedByPrefixes(y)]);
    }
  }
});

/** 1 ⊖ (1 ⊕ (1 ⊖ …)) grown from `core`: each step puts a new smallest entry last or a new largest one last,
 *  a separating tree as deep as the permutation is long. */
function nested(core: number[], n: number): number[] {
  let x = core;
  for (let size = core.length + 1; size <= n; size++) x = size % 2 === 0 ? [...x.map((v) => v + 1), 1] : [...x, size];
  return x;
}

test("a long, deeply nested permutation is separable, and not once a 2413 is at its core", () => {
  const n = 3000;
  expect(isSeparablePermutation(nested([1], n), [n])).toBe(true);
  expect(isSeparablePermutation(nested([2, 4, 1, 3], n), [n])).toBe(false);
  expect(isSeparablePermutation(nested([3, 1, 4, 2], n), [n])).toBe(false);
  // 2413 inflated by long increasing runs: no longer separable, and not by a hair.
  const run = (from: number): number[] => Array.from({ length: 50 }, (_, i) => from + i);
  const inflated = [...run(51), ...run(151), ...run(1), ...run(101)];
  expect(isSeparablePermutation(inflated, [200])).toBe(false);
  // The same blocks as 2143 (still separable, and vexillary's own forbidden pattern).
  const blocks = [...run(51), ...run(1), ...run(151), ...run(101)];
  expect(isSeparablePermutation(blocks, [200])).toBe(true);
  expect(isVexillaryPermutation(blocks, [200])).toBe(false);
  expect(isVexillaryPermutation(inflated, [200])).toBe(true);
});

test("the indecomposable permutations, A003319, by two routes and the first terms", () => {
  // 1 − 1/F for F = Σ n! xⁿ, the series inverted term by term.
  const upTo = 80;
  const fact = [1n];
  for (let i = 1; i <= upTo; i++) fact.push(fact[i - 1] * BigInt(i));
  const inverse = [1n];
  for (let m = 1; m <= upTo; m++) {
    let sum = 0n;
    for (let k = 1; k <= m; k++) sum += fact[k] * inverse[m - k];
    inverse.push(-sum);
  }
  const seriesTerm = (n: number): bigint => (n === 0 ? 1n : -inverse[n]);
  for (let n = 0; n <= upTo; n++) expect([n, connectedExact(n)]).toEqual([n, seriesTerm(n)]);
  expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => Number(connectedExact(n)))).toEqual([
    1, 1, 3, 13, 71, 461, 3447, 29093, 273343, 2829325,
  ]);
  // By enumeration where it is quick.
  for (let n = 0; n <= 8; n++)
    expect(connectedExact(n)).toBe(BigInt(permutationsOf(n).filter(connectedByPrefixes).length));
  const kernel = kernelFor("ConnectedPermutations");
  for (const n of [0, 1, 2, 5, 18, 19, 30, 80]) expect([n, kernel.count([n])]).toEqual([n, connectedExact(n)]);
});

test("the separable permutations of n are the large Schröder number S(n − 1), by its sum", () => {
  const binomial = (n: number, k: number): bigint => {
    let result = 1n;
    for (let i = 1; i <= k; i++) result = (result * BigInt(n - k + i)) / BigInt(i);
    return result;
  };
  /** S(n) = Σₖ C(n, k) C(n + k, k) / (k + 1). */
  const schroder = (n: number): bigint => {
    let total = 0n;
    for (let k = 0; k <= n; k++) total += (binomial(n, k) * binomial(n + k, k)) / BigInt(k + 1);
    return total;
  };
  const kernel = kernelFor("SeparablePermutations");
  expect(kernel.count([0])).toBe(1n);
  for (const n of [1, 2, 3, 4, 8, 20, 22, 23, 60, 150, 400])
    expect([n, kernel.count([n])]).toEqual([n, schroder(n - 1)]);
  expect(Array.from({ length: 8 }, (_, n) => Number(kernel.count([n])))).toEqual(
    Array.from({ length: 8 }, (_, n) => permutationsOf(n).filter(separableByPatterns).length),
  );
});

test("the vexillary permutations of n are counted as the lex-order table counts them", () => {
  const kernel = kernelFor("VexillaryPermutations");
  for (let n = 0; n <= 7; n++)
    expect([n, kernel.count([n])]).toEqual([n, BigInt(permutationsOf(n).filter(vexillaryByPatterns).length)]);
});

test("the permutations of n with n − 1 cycles are the transpositions, unranked and ranked in lex order", () => {
  const kernel = kernelFor("KCyclePermutations");
  for (let n = 1; n <= 7; n++) {
    // Those with one swapped pair, found by brute force and sorted lexicographically.
    const listed = permutationsOf(n)
      .filter((x) => x.filter((v, i) => v !== i + 1).length === 2)
      .toSorted(lexically);
    expect([n, kernel.count([n, n - 1])]).toEqual([n, BigInt(listed.length)]);
    listed.forEach((x, r) => {
      expect([n, r, kernel.unrank([n, n - 1], BigInt(r))]).toEqual([n, r, x]);
      expect([n, r, kernel.rank(x, [n, n - 1])]).toEqual([n, r, BigInt(r)]);
    });
  }
  // Every place of a long one, both ways.
  const n = 90;
  const total = Number(kernel.count([n, n - 1]));
  expect(total).toBe((n * (n - 1)) / 2);
  const seen = new Set<string>();
  for (let r = 0; r < total; r++) {
    const x = kernel.unrank([n, n - 1], BigInt(r)) as number[];
    seen.add(x.join(","));
    expect(kernel.rank(x, [n, n - 1])).toBe(BigInt(r));
    expect(kernel.valid(x, [n, n - 1])).toBe(true);
  }
  expect(seen.size).toBe(total);
  expect(() => kernel.unrank([n, n - 1], BigInt(total))).toThrow(RangeError);
});
