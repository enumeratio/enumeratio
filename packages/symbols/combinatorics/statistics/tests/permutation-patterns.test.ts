// Denert's statistic, patience-sorting subsequences, and the length-3 pattern-occurrence
// statistics — plus the coverage check and Denert's extra invariant tests. Split out of
// permutation.test.ts (see permutation-helpers.ts) purely to give vitest more, smaller files
// to parallelise across workers alongside the slow cycle-structure group.
import { expect, test } from "vite-plus/test";
import { PERMUTATION_STATISTICS } from "../src/permutation.ts";
import {
  ALL,
  checkAgainstEngine,
  denert,
  EXPECTED,
  evaluate,
  pairs,
  permutations,
} from "./permutation-helpers.ts";

test("every definition has an independent reading to check against", () => {
  // A definition nobody checks is a second implementation waiting to rot.
  for (const definition of PERMUTATION_STATISTICS)
    expect(EXPECTED[definition.head], definition.head).toBeDefined();
});

checkAgainstEngine([
  "Denert",
  "OccurrencesOf123",
  "OccurrencesOf132",
  "OccurrencesOf213",
  "StackSortable",
  "LongestIncreasingSubsequence",
  "LongestDecreasingSubsequence",
]);

// Denert's statistic (den) is Mahonian: its distribution over S_n is the q-factorial
// [n]_q! = prod_{k=1}^{n} (1 + q + ... + q^{k-1}). Checked with the plain-loop reading
// (fast enough to reach n = 7, unlike routing 5040 permutations through compute-engine) since
// the exhaustive test above already holds it to that reading through the real definition up
// to n = 6.
function qFactorialCoefficients(n: number): number[] {
  let coefficients = [1];
  for (let k = 1; k <= n; k++) {
    const block = Array.from({ length: k }, () => 1); // 1 + q + ... + q^(k-1)
    const next = Array.from({ length: coefficients.length + block.length - 1 }, () => 0);
    for (const [i, c] of coefficients.entries())
      for (const [j, b] of block.entries()) next[i + j] += c * b;
    coefficients = next;
  }
  return coefficients;
}

test("Denert is Mahonian: its distribution over S_n matches the q-factorial, n <= 7", () => {
  for (let n = 0; n <= 7; n++) {
    const counts: number[] = [];
    for (const p of permutations(n)) counts[denert(p)] = (counts[denert(p)] ?? 0) + 1;
    expect(
      Array.from({ length: counts.length }, (_, i) => counts[i] ?? 0),
      `n=${n}`,
    ).toEqual(qFactorialCoefficients(n));
  }
});

test("(Excedances, Denert) is equidistributed with (Descents, MajorIndex), n <= 6", () => {
  const key = (a: number, b: number) => `${a},${b}`;
  const tally = (stat: (p: number[]) => [number, number]) => {
    const counts = new Map<string, number>();
    for (const p of ALL) {
      const k = key(...stat(p));
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return counts;
  };
  const den = tally((p) => [p.filter((v, i) => v > i + 1).length, evaluate("Denert", p)]);
  const majDes = tally((p) => {
    const descents = pairs(p, (i) => p[i - 1] > p[i]);
    return [descents.length, descents.reduce((a, b) => a + b, 0)];
  });
  expect(Object.fromEntries(den)).toEqual(Object.fromEntries(majDes));
});

test("Denert golden values", () => {
  expect(evaluate("Denert", [2, 3, 1])).toBe(3);
  expect(evaluate("Denert", [3, 2, 1])).toBe(2);
  expect(evaluate("Denert", [1, 3, 2])).toBe(2);
  expect(evaluate("Denert", [1, 2, 3])).toBe(0);
});
