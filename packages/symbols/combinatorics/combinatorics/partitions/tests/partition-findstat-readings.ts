// Independent readings of the integer-partition statistics adopted from FindStat, written
// against the Young diagram and the multiset of parts rather than against the expressions.
//
// A partition is its parts in weakly decreasing order.

export type Partition = readonly number[];

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);
const product = (a: readonly number[]): number => a.reduce((x, y) => x * y, 1);
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lcm = (a: number, b: number): number => (a * b) / gcd(a, b);
const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));
const largestEven = (l: Partition): number => Math.max(0, ...l.filter((p) => p % 2 === 0));

/** Column lengths: the conjugate partition. */
const conjugate = (l: Partition): number[] =>
  Array.from({ length: l[0] ?? 0 }, (_, k) => l.filter((p) => p >= k + 1).length);

/** The sums of the sub-multisets of the parts, the empty one excluded. */
const subsetSums = (l: Partition): Set<number> => {
  let sums = new Set([0]);
  for (const p of l) sums = new Set([...sums, ...[...sums].map((s) => s + p)]);
  sums.delete(0);
  return sums;
};

/** Arm and leg of every cell. */
const cells = (l: Partition): { arm: number; leg: number }[] => {
  const c = conjugate(l);
  return l.flatMap((part, i) => Array.from({ length: part }, (_, k) => ({ arm: part - k - 1, leg: c[k]! - i - 1 })));
};

const binomial = (n: number, k: number): number => {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let j = 1; j <= k; j++) r = (r * (n - k + j)) / j;
  return r;
};
/** Parts to a permutation of 1..n with those cycle lengths: p[i] is the image of i. */
const permutationOfCycleType = (l: Partition): number[] => {
  const p: number[] = [];
  let start = 0;
  for (const length of l) {
    for (let k = 0; k < length; k++) p[start + k] = start + ((k + 1) % length);
    start += length;
  }
  return p;
};
/** The subsets of 0..n-1 of the given size (any size when omitted), as bitmasks. */
const subsetMasks = (n: number, size?: number): number[] => {
  const out: number[] = [];
  for (let mask = 0; mask < 1 << n; mask++) {
    let bits = 0;
    for (let b = 0; b < n; b++) bits += (mask >> b) & 1;
    if (size === undefined || bits === size) out.push(mask);
  }
  return out;
};
const invariantSubsets = (l: Partition, size?: number): number => {
  const p = permutationOfCycleType(l);
  const n = p.length;
  return subsetMasks(n, size).filter((mask) => p.every((image, i) => ((mask >> i) & 1) === ((mask >> image) & 1)))
    .length;
};
/** Subset-sum differences: |sum(S) - sum(rest)| over every split of the parts. */
const splitDifferences = (l: Partition): number[] => {
  const n = sum(l);
  return subsetMasks(l.length).map((mask) => Math.abs(n - 2 * sum(l.filter((_, i) => (mask >> i) & 1))));
};
/** Partitions mu with l[i] >= mu[i] >= l[i+1] (the part after the last is 0), counted by walking the choices. */
const interlacing = (l: Partition, i = 0): number => {
  if (i === l.length) return 1;
  let total = 0;
  for (let m = l[i + 1] ?? 0; m <= l[i]!; m++) total += interlacing(l, i + 1);
  return total;
};
/** The number of ways to deal the points 1..n into blocks of these sizes, in order. */
const orderedBlocks = (l: Partition): number => {
  let left = sum(l);
  let ways = 1;
  for (const part of l) {
    ways *= binomial(left, part);
    left -= part;
  }
  return ways;
};
const multiplicities = (l: Partition): number[] => [...new Set(l)].map((part) => l.filter((q) => q === part).length);
/** e_m at k ones: the coefficient of t^m in (1 + t)^k, multiplying the polynomial in one factor at a time. */
const elementaryAtOnes = (k: number, m: number): number => {
  let poly = [1, ...Array<number>(m).fill(0)];
  for (let v = 0; v < k; v++) poly = poly.map((c, d) => c + (poly[d - 1] ?? 0));
  return poly[m]!;
};
export const PARTITION_READINGS: Record<string, (l: Partition) => number> = {
  PartRange: (l) => (l.length === 0 ? 0 : l[0]! - l.at(-1)!),
  ContainingRectangleShortSide: (l) => (l.length === 0 ? 0 : Math.min(l[0]!, l.length)),
  MaximalRectangleHalfPerimeter: (l) => Math.max(0, ...l.map((p, i) => p + i + 1)),
  LargestShiftedPart: (l) => Math.max(0, ...l.map((p, i) => p + i)),
  RemovableHorizontalDominoes: (l) => l.filter((p, i) => p - 2 >= (l[i + 1] ?? 0)).length,
  CellsOutsideFirstRow: (l) => (l.length === 0 ? 0 : sum(l) - l[0]!),
  CellsOutsideFirstHook: (l) => (l.length === 0 ? 0 : sum(l) - (l[0]! + l.length - 1)),
  RowCellPairs: (l) => sum(l.map((p) => (p * (p - 1)) / 2)),
  CellsWithZeroLegAndOddArm: (l) => cells(l).filter((cell) => cell.leg === 0 && cell.arm % 2 === 1).length,
  // Corners counted from the bottom row, which is position 1.
  CornerMajorIndex: (l) => sum(l.map((p, i) => (p > (l[i + 1] ?? 0) ? l.length - i + p - 1 : 0))),
  PartProduct: (l) => product(l),
  PartSquareSum: (l) => sum(l.map((p) => p * p)),
  PartFactorialProduct: (l) => product(l.map(factorial)),
  MultiplicityFactorialProduct: (l) =>
    product([...new Set(l)].map((part) => factorial(l.filter((p) => p === part).length))),
  SumOfEvenParts: (l) => sum(l.filter((p) => p % 2 === 0)),
  SumOfOddParts: (l) => sum(l.filter((p) => p % 2 === 1)),
  SumOfPartsAtLeastTwo: (l) => sum(l.filter((p) => p >= 2)),
  GreatestCommonDivisorOfParts: (l) => l.reduce(gcd, 0),
  LeastCommonMultipleOfParts: (l) => l.reduce(lcm, 1),
  PairwiseGreatestCommonDivisorSum: (l) => sum(l.flatMap((p, i) => l.slice(i + 1).map((q) => gcd(p, q)))),
  LargestEvenPart: largestEven,
  EvenOddCrank: (l) => largestEven(l) - l.filter((p) => p % 2 === 1).length,
  OddPartsBelowLargestEvenPart: (l) => l.filter((p) => p % 2 === 1 && p < largestEven(l)).length,
  DistinctEvenParts: (l) => new Set(l.filter((p) => p % 2 === 0)).size,
  // Row 0 counts +, row 1 counts -, and so on: a checkerboard filling summed over the diagram.
  BerkovichGarvanRank: (l) => sum(l.map((p, i) => (i % 2 === 0 ? 1 : -1) * (p % 2))),
  PartsEqualToNextPart: (l) => l.length - new Set(l).size,
  LargestMissingPart: (l) => {
    if (l.length === 0) return 0;
    let k = l[0]! - 1;
    while (l.includes(k)) k--;
    return k;
  },
  SmallestNonRepeatedInteger: (l) => {
    let k = 1;
    while (l.filter((p) => p === k).length >= 2) k++;
    return k;
  },
  DistinctSubsetSums: (l) => subsetSums(l).size,
  DistinctEvenSubsetSums: (l) => [...subsetSums(l)].filter((s) => s % 2 === 0).length,
  DistinctOddSubsetSums: (l) => [...subsetSums(l)].filter((s) => s % 2 === 1).length,
  PartsNotCongruentToTwoModuloThree: (l) => l.filter((p) => p % 3 !== 2).length,
  PartsNotCongruentToZeroModuloThree: (l) => l.filter((p) => p % 3 !== 0).length,
  PartsNotCongruentToOneModuloThree: (l) => l.filter((p) => p % 3 !== 1).length,
  PartsEqualTwo: (l) => l.filter((p) => p === 2).length,
  HalfSumOfEvenParts: (l) => sum(l.filter((p) => p % 2 === 0)) / 2,
  HalfLargestEvenPart: (l) => largestEven(l) / 2,
  DistinctOddPartsBelowLargestEvenPart: (l) => new Set(l.filter((p) => p % 2 === 1 && p < largestEven(l))).size,
  PartSquareProduct: (l) => product(l.map((p) => p * p)),
  // Choose the parts one after another from what is left of the size.
  MultinomialOfParts: (l) => orderedBlocks(l),
  ExponensConsonantiae: (l) => (l.length === 0 ? 0 : l.reduce(lcm, 1) / l.reduce(gcd, 0)),
  CyclicSievingPolynomialDegree: (l) => (l.length === 0 ? 0 : l.reduce(lcm, 1) - l.reduce(lcm, 1) / l[0]!),
  GiniIndex: (l) => binomial(sum(l) + 1, 2) - sum(conjugate(l).map((c) => binomial(c + 1, 2))),
  InterlacingPartitionCount: (l) => interlacing(l),
  MinimalSubpartitionSizeDifference: (l) => Math.min(...splitDifferences(l)),
  // `+ 0` turns a -0 from a negative factor times 0 into 0.
  AlladiWeight: (l) => (l.length === 0 ? 0 : l.at(-1)! * product(l.slice(0, -1).map((p, i) => p - l[i + 1]! - 1))) + 0,
  SecondAlladiWeight: (l) => {
    if (l.length === 0) return 0;
    const delta = (p: number) => (p % 2 === 0 ? 1 : 0);
    const last = l.at(-1)!;
    return (
      ((last + 1 - delta(last)) / 2) *
        product(l.slice(0, -1).map((p, i) => (p - l[i + 1]! - delta(p) - delta(l[i + 1]!)) / 2)) +
      0
    );
  },
  // z = the product over part sizes j of j^m_j m_j!.
  CentralizerSize: (l) =>
    product(
      [...new Set(l)].map((j) => j ** l.filter((p) => p === j).length * factorial(l.filter((p) => p === j).length)),
    ),
  // n! over z, the size of the conjugacy class of the cycle type.
  ConjugacyClassSize: (l) => factorial(sum(l)) / PARTITION_READINGS.CentralizerSize!(l),
  SetPartitionsWithBlockSizesCount: (l) => orderedBlocks(l) / product(multiplicities(l).map(factorial)),
  // FindStat's formula: the multinomial (n + 1 - k; m_1, ..., m_n) over n + 1.
  KrewerasNumber: (l) => {
    const n = sum(l);
    return factorial(n + 1) / (factorial(n + 1 - l.length) * product(multiplicities(l).map(factorial)) * (n + 1));
  },
  InvariantSubsetCount: (l) => invariantSubsets(l),
  InvariantTwoElementSubsetCount: (l) => invariantSubsets(l, 2),
  InvariantThreeElementSubsetCount: (l) => invariantSubsets(l, 3),
  // Union the edges a permutation of this cycle type carries onto one another.
  EdgeOrbitCount: (l) => {
    const p = permutationOfCycleType(l);
    const n = p.length;
    const seen = new Set<number>();
    let orbits = 0;
    for (let a = 0; a < n; a++)
      for (let b = a + 1; b < n; b++) {
        if (seen.has(a * n + b)) continue;
        orbits++;
        let [u, v] = [a, b];
        while (!seen.has(Math.min(u, v) * n + Math.max(u, v))) {
          seen.add(Math.min(u, v) * n + Math.max(u, v));
          [u, v] = [p[u]!, p[v]!];
        }
      }
    return orbits;
  },
  ElementarySymmetricFunctionAtOne: (l) => product(l.map((p) => elementaryAtOnes(l.length, p))),
  SubsetGreatestCommonDivisorSum: (l) =>
    l.length === 0 ? 0 : sum(subsetMasks(l.length).map((mask) => l.filter((_, i) => (mask >> i) & 1).reduce(gcd, 0))),
};
