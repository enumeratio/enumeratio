import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyDefinition, declareStatistics } from "../src/declare.ts";
import { PARTITION_STATISTICS } from "../src/partition.ts";

const ce = new ComputeEngine();
// Declared, not just indexed: StandardTableauCount is defined in terms of the
// HookProduct HEAD, so the engine has to be able to resolve it.
const index = declareStatistics(ce, PARTITION_STATISTICS);

/** Partitions of n, as weakly decreasing part lists. */
function partitions(n: number, cap = n): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (let part = Math.min(n, cap); part >= 1; part--)
    for (const rest of partitions(n - part, part)) out.push([part, ...rest]);
  return out;
}
const ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8].flatMap((n) => partitions(n));

const evaluate = (head: string, l: number[]): number =>
  applyDefinition(ce, index.get(`${head}@IntegerPartitions`)!, ce.box(["List", ...l])).re;

// Independent readings, written against the Young diagram rather than against the
// expressions — same values, different route.
const conjugate = (l: number[]): number[] => {
  const largest = l[0] ?? 0;
  return Array.from({ length: largest }, (_, k) => l.filter((part) => part >= k + 1).length);
};
const hooks = (l: number[]): number[] => {
  const c = conjugate(l);
  const out: number[] = [];
  l.forEach((part, i) => {
    for (let j = 1; j <= part; j++) out.push(part - j + (c[j - 1]! - (i + 1)) + 1);
  });
  return out;
};

const EXPECTED: Record<string, (l: number[]) => number> = {
  LargestPart: (l) => (l.length === 0 ? 0 : Math.max(...l)),
  MultiplicityOfLargestPart: (l) => (l.length === 0 ? 0 : l.filter((p) => p === l[0]).length),
  DistinctParts: (l) => new Set(l).size,
  EvenParts: (l) => l.filter((p) => p % 2 === 0).length,
  OddParts: (l) => l.filter((p) => p % 2 === 1).length,
  PartsEqualOne: (l) => l.filter((p) => p === 1).length,
  PartsAtLeastTwo: (l) => l.filter((p) => p >= 2).length,
  ConjugateOddParts: (l) => conjugate(l).filter((p) => p % 2 === 1).length,
  ConjugateDistinctParts: (l) => new Set(conjugate(l)).size,
  DurfeeSquare: (l) => l.filter((p, i) => p >= i + 1).length,
  ArmOfFirstCell: (l) => (l.length === 0 ? 0 : l[0]! - 1),
  LegOfFirstCell: (l) => (l.length === 0 ? 0 : l.length - 1),
  Corners: (l) => l.filter((p, i) => i === l.length - 1 || p > l[i + 1]!).length,
  Perimeter: (l) => (l.length === 0 ? 0 : Math.max(...l) + l.length),
  IsSelfConjugate: (l) => {
    const c = conjugate(l);
    return c.length === l.length && c.every((v, i) => v === l[i]) ? 1 : 0;
  },
  SumOfHookLengths: (l) => hooks(l).reduce((a, b) => a + b, 0),
  HookProduct: (l) => hooks(l).reduce((a, b) => a * b, 1),
  DysonRank: (l) => (l.length === 0 ? 0 : Math.max(...l) - l.length),
  Crank: (l) => {
    const ones = l.filter((p) => p === 1).length;
    if (l.length === 0) return 0;
    return ones === 0 ? Math.max(...l) : l.filter((p) => p > ones).length - ones;
  },
};

test("every partition definition has an independent reading", () => {
  for (const definition of PARTITION_STATISTICS) expect(EXPECTED[definition.head], definition.head).toBeDefined();
});

for (const definition of PARTITION_STATISTICS) {
  test(`${definition.head} agrees over every partition of 0..8`, () => {
    const expected = EXPECTED[definition.head]!;
    for (const l of ALL) expect(evaluate(definition.head, l), `[${l}]`).toBe(expected(l));
  });
}
