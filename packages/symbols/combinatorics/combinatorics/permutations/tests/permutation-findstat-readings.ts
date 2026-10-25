// Independent readings of the permutation statistics adopted from FindStat, written against
// the definitions in FindStat's words (positions counted from 1) rather than against the
// expressions.
const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0);
const range = (from: number, to: number): number[] =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, k) => from + k);
const descents = (p: number[]): number[] => range(1, p.length - 1).filter((i) => p[i - 1]! > p[i]!);
const ascents = (p: number[]): number[] => range(1, p.length - 1).filter((i) => p[i - 1]! < p[i]!);
/** Peaks of a word, interior positions only. */
const peaksOf = (w: number[]): number =>
  range(2, w.length - 1).filter((i) => w[i - 2]! < w[i - 1]! && w[i - 1]! > w[i]!).length;
const cycles = (p: number[]): number[][] => {
  const seen = new Set<number>();
  const out: number[][] = [];
  for (let start = 1; start <= p.length; start++) {
    if (seen.has(start)) continue;
    const cycle: number[] = [];
    for (let j = start; !seen.has(j); j = p[j - 1]!) {
      seen.add(j);
      cycle.push(j);
    }
    out.push(cycle);
  }
  return out;
};
const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));
const inverse = (p: number[]): number[] => {
  const q = new Array<number>(p.length);
  p.forEach((v, i) => (q[v - 1] = i + 1));
  return q;
};
const indices = (p: number[]): number[] => p.map((_, i) => i);
const pairs = (p: number[]): [number, number][] =>
  indices(p).flatMap((i) =>
    indices(p)
      .filter((j) => j > i)
      .map((j): [number, number] => [i, j]),
  );
const inversionPairs = (p: number[]) => pairs(p).filter(([i, j]) => p[i]! > p[j]!);
const triples = (p: number[]): [number, number, number][] =>
  pairs(p).flatMap(([i, j]) =>
    indices(p)
      .filter((k) => k > j)
      .map((k): [number, number, number] => [p[i]!, p[j]!, p[k]!]),
  );
const before = (p: number[], i: number) => p.slice(0, i);
const after = (p: number[], i: number) => p.slice(i + 1);
const isLeftToRightMaximum = (p: number[], i: number) => before(p, i).every((v) => v < p[i]!);
const isLeftToRightMinimum = (p: number[], i: number) => before(p, i).every((v) => v > p[i]!);
const isRightToLeftMaximum = (p: number[], i: number) => after(p, i).every((v) => v < p[i]!);
const isRightToLeftMinimum = (p: number[], i: number) => after(p, i).every((v) => v > p[i]!);

/** Subsequences of p order-isomorphic to `pattern`, found by comparing every pair of positions. */
const patternOccurrences = (p: number[], pattern: number[]): number => {
  const k = pattern.length;
  const choose = (from: number, left: number): number[][] =>
    left === 0
      ? [[]]
      : range(from, p.length - left).flatMap((i) => choose(i + 1, left - 1).map((rest) => [i, ...rest]));
  return choose(0, k).filter((at) =>
    range(0, k - 1).every((a) => range(0, k - 1).every((b) => p[at[a]!]! < p[at[b]!]! === pattern[a]! < pattern[b]!)),
  ).length;
};

/** Whether the entries of p at the 0-based positions `at` are order-isomorphic to `pattern`. */
const matchesAt = (p: number[], at: number[], pattern: number[]): boolean =>
  at.every((x, a) => at.every((y, b) => p[x]! < p[y]! === pattern[a]! < pattern[b]!));
/** The 0-based increasing position tuples of length k that satisfy `allowed`. */
const tuples = (n: number, k: number, allowed: (at: number[]) => boolean): number[][] => {
  const choose = (from: number, left: number): number[][] =>
    left === 0 ? [[]] : range(from, n - left).flatMap((i) => choose(i + 1, left - 1).map((rest) => [i, ...rest]));
  return choose(0, k).filter(allowed);
};
/** Occurrences of `pattern` at position tuples `allowed` admits (adjacency and fixed-start conditions). */
const vincular = (p: number[], pattern: number[], allowed: (at: number[]) => boolean): number =>
  tuples(p.length, pattern.length, allowed).filter((at) => matchesAt(p, at, pattern)).length;
const adjacentStart = (at: number[]) => at[1] === at[0]! + 1;
const fromFirst = (at: number[]) => at[0] === 0;
const anyOf = (p: number[], patterns: number[][]): number => sum(patterns.map((q) => patternOccurrences(p, q)));

export const FINDSTAT_READINGS: Record<string, (p: number[]) => number> = {
  LeftOuterPeaks: (p) => peaksOf([0, ...p]),
  RightOuterPeaks: (p) => peaksOf([...p, 0]),
  OuterPeaks: (p) => peaksOf([0, ...p, 0]),
  DoubleAscents: (p) => range(0, p.length - 3).filter((i) => p[i]! < p[i + 1]! && p[i + 1]! < p[i + 2]!).length,
  DoubleDescents: (p) => range(0, p.length - 3).filter((i) => p[i]! > p[i + 1]! && p[i + 1]! > p[i + 2]!).length,
  IsolatedDescents: (p) => {
    const d = new Set(descents(p));
    return [...d].filter((i) => !d.has(i - 1) && !d.has(i + 1)).length;
  },
  BigAscents: (p) => range(0, p.length - 2).filter((i) => p[i + 1]! - p[i]! > 1).length,
  BigDescents: (p) => range(0, p.length - 2).filter((i) => p[i]! - p[i + 1]! > 1).length,
  DescentTopSum: (p) => sum(descents(p).map((i) => p[i - 1]!)),
  DescentBottomSum: (p) => sum(descents(p).map((i) => p[i]!)),
  AscentTopSum: (p) => sum(ascents(p).map((i) => p[i]!)),
  AscentBottomSum: (p) => sum(ascents(p).map((i) => p[i - 1]!)),
  ComajorIndex: (p) => sum(descents(p).map((i) => p.length - i)),
  NontrivialCycles: (p) => cycles(p).filter((c) => c.length > 1).length,
  ShortestCycleLength: (p) => (p.length === 0 ? 0 : Math.min(...cycles(p).map((c) => c.length))),
  ConjugacyClassSize: (p) => {
    const multiplicity = new Map<number, number>();
    for (const c of cycles(p)) multiplicity.set(c.length, (multiplicity.get(c.length) ?? 0) + 1);
    let centralizer = 1;
    for (const [size, times] of multiplicity) centralizer *= size ** times * factorial(times);
    return factorial(p.length) / centralizer;
  },
  WeakAntiexcedances: (p) => range(1, p.length).filter((i) => p[i - 1]! <= i).length,
  OccurrencesOf321: (p) => triples(p).filter(([a, b, c]) => a > b && b > c).length,
  OccurrencesOf312: (p) => triples(p).filter(([a, b, c]) => b < c && c < a).length,
  OccurrencesOf231: (p) => triples(p).filter(([a, b, c]) => c < a && a < b).length,
  NonLeftToRightMaxima: (p) => indices(p).filter((i) => !isLeftToRightMaximum(p, i)).length,
  ExclusiveLeftToRightMaxima: (p) =>
    indices(p).filter((i) => isLeftToRightMaximum(p, i) && !isRightToLeftMinimum(p, i)).length,
  ExclusiveRightToLeftMinima: (p) =>
    indices(p).filter((i) => isRightToLeftMinimum(p, i) && !isLeftToRightMaximum(p, i)).length,
  NonRecords: (p) =>
    indices(p).filter(
      (i) =>
        !isLeftToRightMaximum(p, i) &&
        !isLeftToRightMinimum(p, i) &&
        !isRightToLeftMaximum(p, i) &&
        !isRightToLeftMinimum(p, i),
    ).length,
  NonInversions: (p) => pairs(p).filter(([i, j]) => p[i]! < p[j]!).length,
  InversionSum: (p) => sum(inversionPairs(p).map(([i, j]) => j - i)),
  EvenInversions: (p) => inversionPairs(p).filter(([i, j]) => (j - i) % 2 === 0).length,
  OddInversions: (p) => inversionPairs(p).filter(([i, j]) => (j - i) % 2 === 1).length,
  InverseMajorIndex: (p) => sum(descents(inverse(p))),

  // The second batch.
  FirstEntry: (p) => p[0] ?? 0,
  LastEntry: (p) => p[p.length - 1] ?? 0,
  Successions: (p) => indices(p).filter((i) => p[i + 1] === p[i]! + 1).length,
  Adjacencies: (p) => indices(p).filter((i) => p[i + 1] === p[i]! - 1).length,
  TwoRises: (p) => indices(p).filter((i) => p[i + 1] === p[i]! + 2).length,
  MaximalRiseSize: (p) => Math.max(0, ...indices(p).flatMap((i) => (i + 1 < p.length ? [p[i + 1]! - p[i]!] : []))),
  BigAscentsAfterPrependingZero: (p) => {
    const q = [0, ...p];
    return indices(q).filter((i) => i + 1 < q.length && q[i + 1]! - q[i]! > 1).length;
  },
  VeryBigAscents: (p) => indices(p).filter((i) => i + 1 < p.length && p[i + 1]! - p[i]! > 2).length,
  VeryBigDescents: (p) => indices(p).filter((i) => i + 1 < p.length && p[i]! - p[i + 1]! > 2).length,
  SmallExcedances: (p) => range(1, p.length).filter((i) => p[i - 1] === i + 1).length,
  TwoExcedances: (p) => range(1, p.length).filter((i) => p[i - 1] === i + 2).length,
  BigExcedances: (p) => range(1, p.length).filter((i) => p[i - 1]! - i > 1).length,
  DoubleExcedances: (p) => range(1, p.length).filter((i) => i < p[i - 1]! && p[i - 1]! < p[p[i - 1]! - 1]!).length,
  DoubleDeficiencies: (p) => range(1, p.length).filter((i) => i > p[i - 1]! && p[i - 1]! > p[p[i - 1]! - 1]!).length,
  NestedExcedances: (p) => pairs(p).filter(([a, b]) => a + 1 < b + 1 && b + 1 < p[b]! && p[b]! < p[a]!).length,
  PureExcedances: (p) =>
    range(1, p.length).filter((i) => p[i - 1]! > i && !before(p, i).some((v) => i <= v && v < p[i - 1]!)).length,
  GlobalAscents: (p) =>
    range(1, p.length - 1).filter((i) =>
      range(1, i).every((j) => range(i + 1, p.length).every((k) => p[j - 1]! < p[k - 1]!)),
    ).length,
  GlobalDescents: (p) =>
    range(1, p.length - 1).filter((i) =>
      range(1, i).every((j) => range(i + 1, p.length).every((k) => p[j - 1]! > p[k - 1]!)),
    ).length,
  DecompositionNumber: (p) =>
    range(1, p.length).filter((k) =>
      p
        .slice(0, k)
        .toSorted((a, b) => a - b)
        .every((v, i) => v === i + 1),
    ).length,
  CyclesOfLengthAtLeastThree: (p) => cycles(p).filter((c) => c.length >= 3).length,
  InversionsOfDistanceAtMostTwo: (p) => inversionPairs(p).filter(([i, j]) => j - i <= 2).length,
  NonInversionSum: (p) =>
    sum(
      pairs(p)
        .filter(([i, j]) => p[i]! < p[j]!)
        .map(([i, j]) => j - i),
    ),
  TotalDisplacement: (p) => sum(p.map((v, i) => Math.abs(v - (i + 1)))),
  DescentDifferenceSum: (p) => sum(descents(p).map((i) => p[i - 1]! - p[i]!)),
  ShiftedMajorIndex: (p) => sum(range(1, p.length - 1).filter((i) => p[i - 1]! - p[i]! >= 2)),
  Recoils: (p) => {
    const q = inverse(p);
    return descents(q).length;
  },
  DescentsOrRecoils: (p) => new Set([...descents(p), ...descents(inverse(p))]).size,
  LeftToRightMaximaPositionSum: (p) =>
    sum(
      indices(p)
        .filter((i) => isLeftToRightMaximum(p, i))
        .map((i) => i + 1),
    ),
  ArithmeticProgressionsOfLengthTwo: (p) => triples(p).filter(([a, b, c]) => c - b === b - a).length,
  OccurrencesOf1324: (p) => patternOccurrences(p, [1, 3, 2, 4]),
  OccurrencesOf2143: (p) => patternOccurrences(p, [2, 1, 4, 3]),
  OccurrencesOf4231: (p) => patternOccurrences(p, [4, 2, 3, 1]),
  OccurrencesOf2413: (p) => patternOccurrences(p, [2, 4, 1, 3]),
  OccurrencesOf1432: (p) => patternOccurrences(p, [1, 4, 3, 2]),

  // The third batch.
  OccurrencesOf21Dash3: (p) => vincular(p, [2, 1, 3], adjacentStart),
  OccurrencesOf13Dash2: (p) => vincular(p, [1, 3, 2], adjacentStart),
  OccurrencesOf12Dash3: (p) => vincular(p, [1, 2, 3], adjacentStart),
  OccurrencesOf31Dash2: (p) => vincular(p, [3, 1, 2], adjacentStart),
  OccurrencesOf23Dash1: (p) => vincular(p, [2, 3, 1], adjacentStart),
  OccurrencesOf32Dash1: (p) => vincular(p, [3, 2, 1], adjacentStart),
  OccurrencesOfInitial213: (p) => vincular(p, [2, 1, 3], fromFirst),
  OccurrencesOfInitial231: (p) => vincular(p, [2, 3, 1], fromFirst),
  OccurrencesOfInitial312: (p) => vincular(p, [3, 1, 2], fromFirst),
  OccurrencesOfInitial321: (p) => vincular(p, [3, 2, 1], fromFirst),
  OccurrencesOfInitial132: (p) => vincular(p, [1, 3, 2], fromFirst),
  OccurrencesOfInitial123: (p) => vincular(p, [1, 2, 3], fromFirst),
  OccurrencesOfInitial12Dash3: (p) => vincular(p, [1, 2, 3], (at) => at[0] === 0 && at[1] === 1),
  OccurrencesOfInitial2Dash13: (p) => vincular(p, [2, 1, 3], (at) => fromFirst(at) && at[2] === at[1]! + 1),
  OccurrencesOfInitial1Dash23: (p) => vincular(p, [1, 2, 3], (at) => fromFirst(at) && at[2] === at[1]! + 1),
  OccurrencesOfConsecutive132: (p) => vincular(p, [1, 3, 2], (at) => at[1] === at[0]! + 1 && at[2] === at[1]! + 1),
  OccurrencesOf3241: (p) => patternOccurrences(p, [3, 2, 4, 1]),
  OccurrencesOf4213: (p) => patternOccurrences(p, [4, 2, 1, 3]),
  OccurrencesOf123Or132: (p) =>
    anyOf(p, [
      [1, 2, 3],
      [1, 3, 2],
    ]),
  OccurrencesOf213Or321: (p) =>
    anyOf(p, [
      [2, 1, 3],
      [3, 2, 1],
    ]),
  OccurrencesOf132Or321: (p) =>
    anyOf(p, [
      [1, 3, 2],
      [3, 2, 1],
    ]),
  OccurrencesOf132Or213Or321: (p) =>
    anyOf(p, [
      [1, 3, 2],
      [2, 1, 3],
      [3, 2, 1],
    ]),
  OccurrencesOf3241Or4231: (p) =>
    anyOf(p, [
      [3, 2, 4, 1],
      [4, 2, 3, 1],
    ]),
  OccurrencesOf4132Or4231: (p) =>
    anyOf(p, [
      [4, 1, 3, 2],
      [4, 2, 3, 1],
    ]),
  OccurrencesOf3412Or4231: (p) =>
    anyOf(p, [
      [3, 4, 1, 2],
      [4, 2, 3, 1],
    ]),
  OccurrencesOf2143Or4213: (p) =>
    anyOf(p, [
      [2, 1, 4, 3],
      [4, 2, 1, 3],
    ]),
  // FindStat's cyclic successor of i is i mod n + 1.
  SmallWeakExcedances: (p) => range(1, p.length).filter((i) => [i, i + 1].includes(p[i - 1]!)).length,
  NonSmallExcedances: (p) => range(1, p.length).filter((i) => p[i - 1] !== i + 1).length,
  NonSmallWeakExcedances: (p) => range(1, p.length).filter((i) => ![i, i + 1].includes(p[i - 1]!)).length,
  CyclicSmallExcedances: (p) => range(1, p.length).filter((i) => p[i - 1] === (i % p.length) + 1).length,
  CyclicSmallWeakExcedances: (p) =>
    range(1, p.length).filter((i) => [i, (i % p.length) + 1].includes(p[i - 1]!)).length,
  NonCyclicSmallExcedances: (p) => range(1, p.length).filter((i) => p[i - 1] !== (i % p.length) + 1).length,
  NonCyclicSmallWeakExcedances: (p) =>
    range(1, p.length).filter((i) => ![i, (i % p.length) + 1].includes(p[i - 1]!)).length,
};
