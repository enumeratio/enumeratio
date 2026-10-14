import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { applyDefinition, declareStatistics } from "../../src/statistics/declare.ts";
import { PARTITION_STATISTICS } from "../src/statistics.ts";

const ce = bareEngine();
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
  applyDefinition(ce, index.get(`${head}@IntegerPartition`)!, ce.box(["List", ...l])).re;

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

const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0);
const product = (a: number[]): number => a.reduce((x, y) => x * y, 1);
/** How often each distinct part occurs. */
const multiplicities = (l: number[]): Map<number, number> => {
  const out = new Map<number, number>();
  for (const part of l) out.set(part, (out.get(part) ?? 0) + 1);
  return out;
};
/** Every cell as (arm, leg, hook), rows and columns counted from 1. */
const cellData = (l: number[]): { row: number; column: number; arm: number; leg: number }[] => {
  const c = conjugate(l);
  return l.flatMap((part, i) =>
    Array.from({ length: part }, (_, k) => ({
      row: i + 1,
      column: k + 1,
      arm: part - (k + 1),
      leg: c[k]! - (i + 1),
    })),
  );
};
const durfeeSide = (l: number[]): number => l.filter((p, i) => p >= i + 1).length;
/** The largest k with a staircase (k, k-1, ..., 1) inside the diagram. */
const staircaseSide = (l: number[]): number => {
  let side = 0;
  for (let k = 1; k <= l.length + 1; k++)
    if (Array.from({ length: k }, (_, i) => (l[i] ?? 0) >= k - i).every(Boolean)) side = k;
  return side;
};
const diagonalCells = (l: number[]) => cellData(l).filter((cell) => cell.row === cell.column);

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
  HookLengthOfFirstCell: (l) => (l.length === 0 ? 0 : hooks(l)[0]!),
  HookLengthOfLastDiagonalCell: (l) => {
    const cell = diagonalCells(l).at(-1);
    return cell ? cell.arm + cell.leg + 1 : 0;
  },
  DiagonalHookLengthProduct: (l) => product(diagonalCells(l).map((cell) => cell.arm + cell.leg + 1)),
  SymmetricDiagonalHooks: (l) => diagonalCells(l).filter((cell) => cell.arm === cell.leg).length,
  CellsOutsideDurfeeSquare: (l) => sum(l) - durfeeSide(l) ** 2,
  FirstRowHookLengthSum: (l) =>
    hooks(l)
      .slice(0, l[0] ?? 0)
      .reduce((a, b) => a + b, 0),
  HookLengthSquareSum: (l) => hooks(l).reduce((a, h) => a + h * h, 0),
  CohookLengthProduct: (l) => product(cellData(l).map((cell) => cell.row + cell.column - 1)),
  DiagonalInversions: (l) => cellData(l).filter((cell) => [0, 1].includes(cell.arm - cell.leg)).length,
  DiagonalInversionDefect: (l) => cellData(l).filter((cell) => ![0, 1].includes(cell.arm - cell.leg)).length,
  CellsWithEqualArmAndLeg: (l) => cellData(l).filter((cell) => cell.arm === cell.leg).length,
  LargestRepeatedPart: (l) =>
    Math.max(0, ...[...multiplicities(l)].filter(([, times]) => times > 1).map(([part]) => part)),
  MultiplicityOfSmallestPart: (l) => (l.length === 0 ? 0 : l.filter((p) => p === l.at(-1)).length),
  FlooredHalfMultiplicitySum: (l) => sum([...multiplicities(l).values()].map((times) => Math.floor(times / 2))),
  DistinctRepeatedParts: (l) => [...multiplicities(l).values()].filter((times) => times > 1).length,
  SingletonParts: (l) => [...multiplicities(l).values()].filter((times) => times === 1).length,
  DistinctMultiplicities: (l) => new Set(multiplicities(l).values()).size,
  LargestMultiplicity: (l) => Math.max(0, ...multiplicities(l).values()),
  PartsEqualToMultiplicity: (l) => l.filter((p) => multiplicities(l).get(p) === p).length,
  DistinctPartsEqualToMultiplicity: (l) => [...multiplicities(l)].filter(([part, times]) => part === times).length,
  WeightedSize: (l) => sum(conjugate(l).map((column) => (column * (column - 1)) / 2)),
  AddableCells: (l) => new Set(l).size + 1,
  PartsExceedingOnes: (l) => {
    const ones = l.filter((p) => p === 1).length;
    return l.filter((p) => p > ones).length;
  },
  ContentSum: (l) => sum(cellData(l).map((cell) => cell.column - cell.row)),
  LargestStaircaseSide: (l) => staircaseSide(l),
  ContainingSquareSide: (l) => (l.length === 0 ? 0 : Math.max(l[0]!, l.length)),
  CellsOutsideLargestStaircase: (l) => sum(l) - (staircaseSide(l) * (staircaseSide(l) + 1)) / 2,
  Aft: (l) => (l.length === 0 ? 0 : sum(l) - Math.max(l[0]!, l.length)),
  SmallestMissingPart: (l) => {
    let part = 1;
    while (l.includes(part)) part++;
    return part;
  },
  PairwiseProductSum: (l) => (sum(l) ** 2 - sum(l.map((p) => p * p))) / 2,
};

test("every partition definition has an independent reading", () => {
  for (const definition of PARTITION_STATISTICS) expect(EXPECTED[definition.head], definition.head).toBeDefined();
});

for (const definition of PARTITION_STATISTICS) {
  test(`${definition.head} agrees over every partition of 0..8`, () => {
    const expected = EXPECTED[definition.head]!;
    for (const l of ALL) expect(evaluate(definition.head, l), `[${l.join(", ")}]`).toBe(expected(l));
  });
}

// Larger partitions run nightly (DEEP_TESTS=1).
test.skipIf(!process.env.DEEP_TESTS)(
  "every partition definition agrees over every partition of 9..12",
  () => {
    for (const l of [9, 10, 11, 12].flatMap((n) => partitions(n)))
      for (const definition of PARTITION_STATISTICS)
        expect(evaluate(definition.head, l), `${definition.head} [${l.join(", ")}]`).toBe(
          EXPECTED[definition.head]!(l),
        );
  },
  1_800_000,
);
