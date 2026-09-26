// Shared universe, independent readings, and evaluation machinery for the sharded
// `permutation-*.test.ts` files. Not itself a test file.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyDefinition } from "../src/declare.ts";
import { PERMUTATION_STATISTICS } from "../src/permutation.ts";
import { bySignature } from "../src/types.ts";

export const ce = new ComputeEngine();
export const index = bySignature(PERMUTATION_STATISTICS);

/** Every permutation of 1..n. */
export function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (const rest of permutations(n - 1))
    for (let i = 0; i <= rest.length; i++) out.push([...rest.slice(0, i), n, ...rest.slice(i)]);
  return out;
}
export const ALL = [0, 1, 2, 3, 4, 5, 6].flatMap(permutations);
/** The triple-loop statistics cost roughly n^3 expression evaluations each, which over 873
 *  permutations runs into minutes. They are checked over 1..5 (206 permutations) instead —
 *  still exhaustive, just over a smaller universe. The cost IS the finding: an expression
 *  definition is a specification, not a fast path. */
export const CUBIC = new Set([
  "LongestIncreasingSubsequence",
  "LongestDecreasingSubsequence",
  "OccurrencesOf123",
  "OccurrencesOf132",
  "OccurrencesOf213",
  "StackSortable",
]);
export const SMALL = [0, 1, 2, 3, 4, 5].flatMap(permutations);

export const evaluate = (head: string, p: number[]): number => {
  const definition = index.get(`${head}@Permutations`);
  if (!definition) throw new Error(`no definition for ${head}`);
  return applyDefinition(ce, definition, ce.box(["List", ...p])).re;
};

// Independent readings. Deliberately written as plain loops in a different style from the
// expressions — a transcription of the same idea would not be evidence of anything.
export const positionsWhere = (p: number[], f: (i: number) => boolean): number[] =>
  p.map((_, k) => k + 1).filter((i) => f(i));
export const pairs = (p: number[], f: (i: number) => boolean): number[] =>
  p
    .slice(0, -1)
    .map((_, k) => k + 1)
    .filter((i) => f(i));

/** Foata–Zeilberger's den, read as a plain loop: sum of excedance positions, plus inversions
 *  within each of the excedance and non-excedance subwords (never across the two). */
export function denert(p: number[]): number {
  const isExc = (i: number) => p[i - 1]! > i;
  let total = 0;
  for (let i = 1; i <= p.length; i++) if (isExc(i)) total += i;
  for (const block of [isExc, (i: number) => !isExc(i)]) {
    for (let i = 1; i <= p.length; i++) {
      if (!block(i)) continue;
      for (let j = i + 1; j <= p.length; j++) {
        if (block(j) && p[i - 1]! > p[j - 1]!) total++;
      }
    }
  }
  return total;
}

/** Cycle lengths, read by walking orbits with a visited set — the ordinary algorithm, which
 *  is exactly what the expression definition deliberately does NOT do. */
export function cycleLengths(p: number[]): number[] {
  const seen = new Array<boolean>(p.length).fill(false);
  const lengths: number[] = [];
  for (let start = 0; start < p.length; start++) {
    if (seen[start]) continue;
    let length = 0;
    let at = start;
    do {
      seen[at] = true;
      at = p[at]! - 1;
      length++;
    } while (at !== start);
    lengths.push(length);
  }
  return lengths;
}
export const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Patience sorting, read with a plain loop: how many piles the entries make. */
export function piles(p: number[], before: (top: number, x: number) => boolean): number {
  const tops: number[] = [];
  for (const x of p) {
    const index = tops.findIndex((top) => !before(top, x));
    if (index < 0) tops.push(x);
    else tops[index] = x;
  }
  return tops.length;
}

/** The longest run of consecutive increases — read with a plain loop. */
export function longestRun(p: number[]): number {
  let best = 0;
  let current = 0;
  for (let k = 0; k < p.length; k++) {
    current = k > 0 && p[k]! > p[k - 1]! ? current + 1 : 1;
    best = Math.max(best, current);
  }
  return best;
}

/** Occurrences of a length-3 pattern, by the values at i < j < k. */
export function triples(p: number[], holds: (a: number, b: number, c: number) => boolean): number {
  let c = 0;
  for (let i = 0; i < p.length; i++)
    for (let j = i + 1; j < p.length; j++) for (let k = j + 1; k < p.length; k++) if (holds(p[i], p[j], p[k])) c++;
  return c;
}

export const EXPECTED: Record<string, (p: number[]) => number> = {
  Descents: (p) => pairs(p, (i) => p[i - 1] > p[i]).length,
  Ascents: (p) => pairs(p, (i) => p[i - 1] < p[i]).length,
  MajorIndex: (p) => pairs(p, (i) => p[i - 1] > p[i]).reduce((a, b) => a + b, 0),
  MinorIndex: (p) => pairs(p, (i) => p[i - 1] < p[i]).reduce((a, b) => a + b, 0),
  Inversions: (p) => {
    let c = 0;
    for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[i] > p[j]) c++;
    return c;
  },
  Sign: (p) => (EXPECTED.Inversions(p) % 2 === 0 ? 1 : -1),
  FixedPoints: (p) => positionsWhere(p, (i) => p[i - 1] === i).length,
  Excedances: (p) => positionsWhere(p, (i) => p[i - 1] > i).length,
  WeakExceedances: (p) => positionsWhere(p, (i) => p[i - 1] >= i).length,
  Antiexcedances: (p) => positionsWhere(p, (i) => p[i - 1] < i).length,
  Peaks: (p) => positionsWhere(p, (i) => i > 1 && i < p.length && p[i - 2] < p[i - 1] && p[i - 1] > p[i]).length,
  Valleys: (p) => positionsWhere(p, (i) => i > 1 && i < p.length && p[i - 2] > p[i - 1] && p[i - 1] < p[i]).length,
  LeftToRightMaxima: (p) => positionsWhere(p, (i) => p.slice(0, i).every((v) => v <= p[i - 1])).length,
  LeftToRightMinima: (p) => positionsWhere(p, (i) => p.slice(0, i).every((v) => v >= p[i - 1])).length,
  RightToLeftMaxima: (p) => positionsWhere(p, (i) => p.slice(i - 1).every((v) => v <= p[i - 1])).length,
  RightToLeftMinima: (p) => positionsWhere(p, (i) => p.slice(i - 1).every((v) => v >= p[i - 1])).length,
  FirstDescent: (p) => pairs(p, (i) => p[i - 1] > p[i])[0] ?? 0,
  LastDescent: (p) => pairs(p, (i) => p[i - 1] > p[i]).at(-1) ?? 0,
  Runs: (p) => (p.length === 0 ? 0 : pairs(p, (i) => p[i - 1] > p[i]).length + 1),
  Depth: (p) => positionsWhere(p, () => true).reduce((a, i) => a + Math.abs(p[i - 1] - i), 0) / 2,
  CyclicDescents: (p) => (p.length < 2 ? 0 : pairs(p, (i) => p[i - 1] > p[i]).length + (p.at(-1)! > p[0] ? 1 : 0)),
  OccurrencesOf123: (p) => triples(p, (a, b, c) => a < b && b < c),
  OccurrencesOf132: (p) => triples(p, (a, b, c) => a < c && c < b),
  OccurrencesOf213: (p) => triples(p, (a, b, c) => b < a && a < c),
  StackSortable: (p) => (triples(p, (a, b, c) => c < a && a < b) === 0 ? 1 : 0),
  CycleCount: (p) => cycleLengths(p).length,
  ReflectionLength: (p) => p.length - cycleLengths(p).length,
  LargestCycleLength: (p) => (p.length === 0 ? 0 : Math.max(...cycleLengths(p))),
  LongestCycleLength: (p) => (p.length === 0 ? 0 : Math.max(...cycleLengths(p))),
  DistinctCycleLengths: (p) => new Set(cycleLengths(p)).size,
  TwoCycleCount: (p) => cycleLengths(p).filter((l) => l === 2).length,
  ThreeCycleCount: (p) => cycleLengths(p).filter((l) => l === 3).length,
  Order: (p) => cycleLengths(p).reduce((a, b) => (a * b) / gcd(a, b), 1),
  LongestRun: longestRun,
  LongestIncreasingSubsequence: (p) => piles(p, (top, x) => top < x),
  LongestDecreasingSubsequence: (p) => piles(p, (top, x) => top > x),
  LargestRunLength: longestRun,
  Denert: denert,
};

/** Generate `${head} agrees over every permutation of 1..N` for each of `heads`, against
 *  `EXPECTED`, over `ALL` (or `SMALL` for the cubic-cost statistics). Called at module top
 *  level in each shard file — vitest collects `test()` calls made this way exactly as it would
 *  ones written inline. */
export function checkAgainstEngine(heads: readonly string[]): void {
  for (const head of heads) {
    const cubic = CUBIC.has(head);
    const universe = cubic ? SMALL : ALL;
    const upTo = cubic ? 5 : 6;
    test(`${head} agrees over every permutation of 1..${upTo}`, () => {
      const expected = EXPECTED[head];
      if (!expected) throw new Error(`no expected reading for ${head}`);
      for (const p of universe) expect(evaluate(head, p), `[${p}]`).toBe(expected(p));
    });
  }
}
