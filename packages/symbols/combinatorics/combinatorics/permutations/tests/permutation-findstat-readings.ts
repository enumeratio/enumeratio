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

/** Maximal runs of consecutive small ascents (steps i with p(i+1) = p(i) + 1), as 0-based step lists. */
const raftsOf = (p: number[]): number[][] => {
  const rafts: number[][] = [[]];
  for (let i = 0; i < p.length - 1; i++) {
    if (p[i + 1] === p[i]! + 1) rafts[rafts.length - 1]!.push(i);
    else rafts.push([]);
  }
  return rafts.filter((r) => r.length > 0);
};
const raftSteps = (p: number[]): Set<number> => new Set(raftsOf(p).flat());
const consecutiveGaps = (p: number[]): number[] => range(0, p.length - 2).map((i) => Math.abs(p[i]! - p[i + 1]!));

const adjacentEnd = (at: number[]) => at[2] === at[1]! + 1;

/** The smallest d >= 1 at which the entry at 0-based position i meets a greater entry, the ends counting as greater. */
const gapToGreater = (p: number[], i: number): number => {
  const n = p.length;
  const q = [n + 1, ...p, n + 1];
  let d = 1;
  while (!(q[i + 1 - d]! > q[i + 1]! || q[i + 1 + d]! > q[i + 1]!)) d++;
  return d;
};
const longestIncreasing = (p: number[]): number => {
  const best: number[] = [];
  p.forEach((v, i) => (best[i] = 1 + Math.max(0, ...best.slice(0, i).filter((_, k) => p[k]! < v))));
  return Math.max(0, ...best);
};
/** The 1-based pairs (i, j), over every ordered pair of positions, for which `holds(i, j, p(i), p(j))`. */
const orderedPairs = (p: number[], holds: (i: number, j: number, a: number, b: number) => boolean): number =>
  sum(range(1, p.length).map((i) => range(1, p.length).filter((j) => holds(i, j, p[i - 1]!, p[j - 1]!)).length));
const cyclicallyOrdered = (a: number, b: number, c: number, d: number): boolean =>
  (a < b && b < c && c < d) || (b < c && c < d && d < a) || (c < d && d < a && a < b) || (d < a && a < b && b < c);
/** How many distinct positions the pattern's letter number `mark` takes over the occurrences of the pattern. */
const letterPositions = (p: number[], pattern: number[], mark: number): number =>
  new Set(tuples(p.length, pattern.length, (at) => matchesAt(p, at, pattern)).map((at) => at[mark])).size;
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
/** Shareshian and Wachs's admissible inversions: i < j, p(i) > p(j), and p(j) < p(j+1) or a smaller entry between. */
const shareshianWachs = (p: number[]): number =>
  sum(
    range(1, p.length).map(
      (i) =>
        range(i + 1, p.length).filter(
          (j) =>
            p[i - 1]! > p[j - 1]! &&
            ((j < p.length && p[j - 1]! < p[j]!) || range(i + 1, j - 1).some((k) => p[k - 1]! < p[j - 1]!)),
        ).length,
    ),
  );

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

  // The fourth batch.
  OccurrencesOf132Or231: (p) =>
    anyOf(p, [
      [1, 3, 2],
      [2, 3, 1],
    ]),
  OccurrencesOf132Or213: (p) =>
    anyOf(p, [
      [1, 3, 2],
      [2, 1, 3],
    ]),
  OccurrencesOf132Or312: (p) =>
    anyOf(p, [
      [1, 3, 2],
      [3, 1, 2],
    ]),
  OccurrencesOf123Or231: (p) =>
    anyOf(p, [
      [1, 2, 3],
      [2, 3, 1],
    ]),
  OccurrencesOf123Or213: (p) =>
    anyOf(p, [
      [1, 2, 3],
      [2, 1, 3],
    ]),
  OccurrencesOf123Or321: (p) =>
    anyOf(p, [
      [1, 2, 3],
      [3, 2, 1],
    ]),
  OccurrencesOf123Or312: (p) =>
    anyOf(p, [
      [1, 2, 3],
      [3, 1, 2],
    ]),
  OccurrencesOf231Or312: (p) =>
    anyOf(p, [
      [2, 3, 1],
      [3, 1, 2],
    ]),
  OccurrencesOf213Or312: (p) =>
    anyOf(p, [
      [2, 1, 3],
      [3, 1, 2],
    ]),
  OccurrencesOf213Or231: (p) =>
    anyOf(p, [
      [2, 1, 3],
      [2, 3, 1],
    ]),
  OccurrencesOf231Or321: (p) =>
    anyOf(p, [
      [2, 3, 1],
      [3, 2, 1],
    ]),
  OccurrencesOf312Or321: (p) =>
    anyOf(p, [
      [3, 1, 2],
      [3, 2, 1],
    ]),
  OccurrencesOf321Or3412: (p) => anyOf(p, [[3, 2, 1]]) + anyOf(p, [[3, 4, 1, 2]]),
  OccurrencesOf52341: (p) => patternOccurrences(p, [5, 2, 3, 4, 1]),
  OccurrencesOf41352Or42351Or51342Or52341: (p) =>
    anyOf(p, [
      [4, 1, 3, 5, 2],
      [4, 2, 3, 5, 1],
      [5, 1, 3, 4, 2],
      [5, 2, 3, 4, 1],
    ]),
  ThreeExcedances: (p) => range(1, p.length).filter((i) => p[i - 1] === i + 3).length,
  ThreeRises: (p) => ascents(p).filter((i) => p[i] === p[i - 1]! + 3).length,
  BigDeficiencies: (p) => range(1, p.length).filter((i) => i - p[i - 1]! > 1).length,
  DescentsOfDistanceTwo: (p) => range(1, p.length - 2).filter((i) => p[i - 1]! > p[i + 1]!).length,
  AscentsOfDistanceTwo: (p) => range(1, p.length - 2).filter((i) => p[i - 1]! < p[i + 1]!).length,
  DoubleSuccessions: (p) =>
    range(1, p.length - 2).filter((i) => p[i] === p[i - 1]! + 1 && p[i + 1] === p[i - 1]! + 2).length,
  DescentsPlusRecoils: (p) => descents(p).length + descents(inverse(p)).length,
  DescentsAndRecoils: (p) => descents(p).filter((i) => descents(inverse(p)).includes(i)).length,
  OddDescents: (p) => descents(p).filter((i) => i % 2 === 1).length,
  EvenDescents: (p) => descents(p).filter((i) => i % 2 === 0).length,
  // FindStat's loop: walk back from the end while the entries rise, with n + 1 prepended.
  FinalRises: (p) => {
    const n = p.length;
    const w = [n + 1, ...p];
    let rise = 0;
    while (w[n - 1 - rise]! < w[n - rise]!) rise++;
    return rise;
  },
  MidPointsOfOccurrencesOf321: (p) =>
    indices(p).filter((j) => before(p, j).some((v) => v > p[j]!) && after(p, j).some((v) => v < p[j]!)).length,
  MidPointsOfOccurrencesOf123: (p) =>
    indices(p).filter((j) => before(p, j).some((v) => v < p[j]!) && after(p, j).some((v) => v > p[j]!)).length,
  LeftToRightMaximaOrRightToLeftMinima: (p) =>
    indices(p).filter((i) => isLeftToRightMaximum(p, i) || isRightToLeftMinimum(p, i)).length,
  MajorIndexMinusInversions: (p) => sum(descents(p)) - inversionPairs(p).length,
  InversionsPlusMajorIndex: (p) => sum(descents(p)) + inversionPairs(p).length,
  MajorIndexMinusExcedances: (p) => sum(descents(p)) - range(1, p.length).filter((i) => p[i - 1]! > i).length,
  MaximalDisplacement: (p) => Math.max(0, ...range(1, p.length).map((i) => Math.abs(p[i - 1]! - i))),

  // The fifth batch, each written the way FindStat's code reads it.
  ValleysIncludingBoundary: (p) => {
    const w = [p.length + 1, ...p, p.length + 1];
    return range(1, p.length).filter((i) => w[i - 1]! > w[i]! && w[i]! < w[i + 1]!).length;
  },
  MaximalExcedance: (p) => Math.max(0, ...p.map((v, i) => v - i - 1)),
  AdjacentCycles: (p) => cycles(p).filter((c) => c.every((v, k) => v === c[0]! + k)).length,
  StrongFixedPoints: (p) =>
    indices(p).filter((i) => before(p, i).every((v) => v < p[i]!) && after(p, i).every((v) => v > p[i]!)).length,
  SortingIndex: (p) => {
    const sort = (q: number[]): number => {
      const n = q.length;
      if (n === 0) return 0;
      const x = q.indexOf(n) + 1;
      if (x === n) return sort(q.slice(0, n - 1));
      const swapped = [...q];
      [swapped[x - 1], swapped[n - 1]] = [swapped[n - 1]!, swapped[x - 1]!];
      return n - x + sort(swapped.slice(0, n - 1));
    };
    return sort(p);
  },
  Load: (p) => sum(descents(inverse(p).toReversed())),
  CycleDescents: (p) => sum(cycles(p).map((c) => range(0, c.length - 2).filter((a) => c[a]! > c[a + 1]!).length)),
  DescentsAfterZeroingFixedPoints: (p) => descents(p.map((v, i) => (v === i + 1 ? 0 : v))).length,
  MajorIndexAfterZeroingFixedPoints: (p) => sum(descents(p.map((v, i) => (v === i + 1 ? 0 : v)))),
  ElizaldePakRank: (p) => {
    let k = 0;
    while (range(1, k).every((i) => p[i - 1]! > k)) k++;
    return k - 1;
  },
  Disorder: (p) => {
    let i = 1;
    let pos = 0;
    let count = 0;
    while (i < p.length) {
      if (p[pos] === i) i++;
      else if (p[pos]! > i) count++;
      pos = (pos + 1) % p.length;
    }
    return count;
  },
  CyclesOfLengthAtMostTwo: (p) => cycles(p).filter((c) => c.length <= 2).length,
  CyclesOfLengthAtMostThree: (p) => cycles(p).filter((c) => c.length <= 3).length,
  InversionsOfDistanceAtMostThree: (p) => inversionPairs(p).filter(([i, j]) => j - i <= 3).length,
  FirstDirectSummandSize: (p) => {
    if (p.length === 0) return 0;
    let k = 1;
    while (
      !p
        .slice(0, k)
        .toSorted((a, b) => a - b)
        .every((v, i) => v === i + 1)
    )
      k++;
    return k;
  },
  LargestDirectSummandSize: (p) => {
    let start = 0;
    let best = 0;
    const seen: number[] = [];
    for (const v of p) {
      seen.push(v);
      if (Math.max(...seen) === seen.length) {
        best = Math.max(best, seen.length - start);
        start = seen.length;
      }
    }
    return best;
  },
  StretchingPairs: (p) => pairs(p).filter(([i, j]) => p[i]! < i + 1 && j + 1 < p[j]! && i < j).length,
  InversionIndex: (p) => sum(inversionPairs(p).map(([i]) => p[i]!)),
  TotalSquaredDisplacement: (p) => sum(p.map((v, i) => (v - i - 1) ** 2)),
  LeftToRightMaximaXorRightToLeftMinima: (p) => {
    const lrmax = new Set(indices(p).filter((i) => isLeftToRightMaximum(p, i)));
    const rlmin = new Set(indices(p).filter((i) => isRightToLeftMinimum(p, i)));
    return [...lrmax].filter((i) => !rlmin.has(i)).length + [...rlmin].filter((i) => !lrmax.has(i)).length;
  },
  MaximalSuccessiveDifference: (p) =>
    p.length < 2 ? 0 : Math.max(...range(0, p.length - 2).map((i) => p[i + 1]! - p[i]!)),
  MajorIndexPlusInverseMajorIndex: (p) => sum(descents(p)) + sum(descents(inverse(p))),
  Tier: (p) => new Set(triples(p).flatMap(([a, b, c]) => (c < a && a < b && a === c + 1 ? [a] : []))).size,
  Rafts: (p) => {
    const rafts: number[][] = [[]];
    for (let i = 0; i < p.length - 1; i++) {
      if (p[i + 1] === p[i]! + 1) rafts[rafts.length - 1]!.push(i);
      else rafts.push([]);
    }
    return rafts.filter((r) => r.length > 0).length;
  },
  WeakExcedanceMidPointsOfOccurrencesOf321: (p) =>
    indices(p).filter(
      (j) => p[j]! >= j + 1 && before(p, j).some((v) => v > p[j]!) && after(p, j).some((v) => v < p[j]!),
    ).length,
  NonWeakExcedanceMidPointsOfOccurrencesOf321: (p) =>
    indices(p).filter((j) => p[j]! < j + 1 && before(p, j).some((v) => v > p[j]!) && after(p, j).some((v) => v < p[j]!))
      .length,
  TwoShiftedMajorIndex: (p) => sum(range(1, p.length - 1).filter((i) => p[i - 1]! - p[i]! > 2)),
  ThreeShiftedMajorIndex: (p) => sum(range(1, p.length - 1).filter((i) => p[i - 1]! - p[i]! > 3)),
  PinnacleSum: (p) =>
    sum(
      range(1, p.length - 2)
        .filter((i) => p[i - 1]! < p[i]! && p[i]! > p[i + 1]!)
        .map((i) => p[i]!),
    ),
  AugmentedDoubleAscents: (p) => {
    const q = [0, ...p];
    return range(0, q.length - 3).filter((i) => q[i]! < q[i + 1]! && q[i + 1]! < q[i + 2]!).length;
  },

  // Batch 5.
  AlternatingRuns: (p) => peaksOf(p) + peaksOf(p.map((v) => p.length + 1 - v)),
  UpDownRuns: (p) => {
    if (p.length === 0) return 0;
    const switches = peaksOf(p) + peaksOf(p.map((v) => p.length + 1 - v));
    return p.length > 1 && p[0]! > p[1]! ? switches + 2 : switches + 1;
  },
  NonInitialLeftToRightMinima: (p) =>
    range(2, p.length).filter((j) => p.slice(0, j - 1).every((v) => v > p[j - 1]!)).length,
  RightFloats: (p) => {
    const r = raftSteps(p);
    return range(0, p.length - 2).filter((i) => p[i + 1]! > p[i]! + 1 && !r.has(i - 1) && !r.has(i + 1)).length;
  },
  RightRopes: (p) => {
    const lasts = raftsOf(p).map((r) => r[r.length - 1]!);
    return lasts.filter((last) => last < p.length - 2 && p[last + 1]! < p[last + 2]!).length;
  },
  RightTethers: (p) => {
    const rafts = raftsOf(p);
    return range(0, rafts.length - 2).filter(
      (i) =>
        rafts[i]![rafts[i]!.length - 1]! + 2 === rafts[i + 1]![0]! &&
        p[rafts[i]![rafts[i]!.length - 1]! + 1]! < p[rafts[i + 1]![0]!]!,
    ).length;
  },
  MinimalJump: (p) => (p.length < 2 ? 0 : Math.min(...consecutiveGaps(p))),
  MaximalJump: (p) => (p.length < 2 ? 0 : Math.max(...consecutiveGaps(p))),
  CyclicMaximalJump: (p) => (p.length === 0 ? 0 : Math.max(...consecutiveGaps([...p, p[0]!]))),
  NeighboringNumber: (p) => (p.length < 2 ? 0 : Math.min(...consecutiveGaps(p), Math.abs(p[0]! - p[p.length - 1]!))),
  DistinctDiagonalSums: (p) =>
    new Set(range(1 - p.length, p.length - 1).map((k) => p.filter((v, i) => v - i - 1 === k).length)).size,
  MaximalDiagonalOccupancy: (p) =>
    p.length === 0
      ? 0
      : Math.max(...range(1 - p.length, p.length - 1).map((k) => p.filter((v, i) => v - i - 1 === k).length)),
  DescentsOfDistanceThree: (p) => range(0, p.length - 4).filter((i) => p[i]! > p[i + 3]!).length,
  RepeatedLehmerCodeEntries: (p) => {
    const code = p.map((v, i) => p.slice(i + 1).filter((w) => w < v).length);
    return p.length - new Set(code).size;
  },
  AdjacenciesWithZeroAppended: (p) => range(0, p.length - 1).filter((i) => p[i]! === (p[i + 1] ?? 0) + 1).length,
  SmallestFixedPoint: (p) => [...p, p.length + 1].findIndex((v, i) => v === i + 1) + 1,
  LargestWeakExcedancePosition: (p) => Math.max(0, ...range(1, p.length).filter((i) => p[i - 1]! >= i)),
  FixedPointsBeforeLargestMovedPoint: (p) => {
    const moved = range(1, p.length).filter((i) => p[i - 1]! !== i);
    return moved.length === 0 ? 0 : range(1, Math.max(...moved)).filter((i) => p[i - 1]! === i).length;
  },
  AscentTopsWithSmallerValuesBefore: (p) =>
    range(0, p.length - 2).filter(
      (i) => p[i]! < p[i + 1]! && range(1, p[i + 1]! - 1).every((v) => p.slice(0, i + 1).includes(v)),
    ).length,
  DescentsOfTypeTwo: (p) =>
    range(0, p.length - 2).filter((i) => p[i]! > p[i + 1]! && p.slice(0, i).every((v) => v < p[i]!)).length,
  LongestSuccessionRun: (p) => {
    let best = 0;
    let run = 0;
    p.forEach((v, i) => {
      run = i > 0 && v === p[i - 1]! + 1 ? run + 1 : 1;
      best = Math.max(best, run);
    });
    return best;
  },
  MaximalModularDisplacement: (p) => {
    const n = p.length;
    const mod = (a: number) => ((a % n) + n) % n;
    return n === 0 ? 0 : Math.max(...p.map((e, i) => Math.min(mod(e - 1 - i), mod(i - e + 1))));
  },
  AdjacentTranspositions: (p) =>
    cycles(p).filter((c) => c.length === 2 && Math.max(...c) - Math.min(...c) === 1).length,
  CyclicallyAdjacentTranspositions: (p) =>
    cycles(p).filter((c) => c.length === 2 && [1, p.length - 1].includes(Math.max(...c) - Math.min(...c))).length,
  Bonds: (p) => range(0, p.length - 2).filter((i) => Math.abs(p[i]! - p[i + 1]!) === 1).length,
  CyclicBonds: (p) => (p.length === 0 ? 0 : p.filter((v, i) => Math.abs(v - p[(i + 1) % p.length]!) === 1).length),
  Crossings: (p) =>
    sum(
      range(1, p.length).map(
        (i) =>
          range(1, p.length).filter((j) => {
            const a = p[i - 1]!;
            const b = p[j - 1]!;
            return (i < j && j <= a && a < b) || (a < b && b < i && i < j);
          }).length,
      ),
    ),
  Nestings: (p) =>
    sum(
      range(1, p.length).map(
        (i) =>
          range(1, p.length).filter((j) => {
            const a = p[i - 1]!;
            const b = p[j - 1]!;
            return (j < i && i < a && a < b) || (b < a && a <= i && i < j);
          }).length,
      ),
    ),
  Alignments: (p) =>
    sum(
      range(1, p.length).map(
        (i) =>
          range(1, p.length).filter((j) => {
            const a = p[i - 1]!;
            const b = p[j - 1]!;
            return (
              (j < i && i < a && a < b) ||
              (b < a && a <= i && i < j) ||
              (j <= b && b < a && a < i) ||
              (a < i && i < j && j <= b)
            );
          }).length,
      ),
    ),
  CyclicValleys: (p) => {
    const n = p.length;
    return n === 0 ? 0 : range(0, n - 1).filter((i) => p[(i + n - 1) % n]! > p[i]! && p[i]! < p[(i + 1) % n]!).length;
  },
  CyclePeaks: (p) => {
    const q = inverse(p);
    return range(1, p.length).filter((i) => q[i - 1]! < i && i > p[i - 1]!).length;
  },
  NonOverlappingDescents: (p) => {
    let i = 0;
    let c = 0;
    while (i < p.length - 1) {
      if (p[i]! > p[i + 1]!) {
        c++;
        i += 2;
      } else i++;
    }
    return c;
  },
  VisibleInversions: (p) => inversionPairs(p).filter(([i, j]) => p[j]! <= Math.min(i + 1, p[i]!)).length,
  InvisibleInversions: (p) => inversionPairs(p).filter(([i, j]) => p[i]! > p[j]! && p[j]! > i + 1).length,
  PrefixSumProduct: (p) => range(1, p.length - 1).reduce((acc, i) => acc * sum(p.slice(0, i)), 1),

  // Batch 6.
  OneBoxPatterns: (p) => p.filter((v, i) => p.some((w, j) => Math.abs(i - j) + Math.abs(v - w) === 2)).length,
  MaximumOfDescentsAndInverseDescents: (p) => Math.max(descents(p).length, descents(inverse(p)).length),
  InvisibleDescents: (p) => descents(p).filter((i) => p[i]! > i).length,
  VisibleDescents: (p) => descents(p).filter((i) => p[i]! <= Math.min(i, p[i - 1]!)).length,
  GreaterNeighborOfMaximum: (p) => {
    if (p.length === 0) return 0;
    const q = [0, ...p, 0];
    const i = q.indexOf(p.length);
    return Math.max(q[i - 1]!, q[i + 1]!);
  },
  InversionsOfThirdEntry: (p) => p.slice(3).filter((v) => v < p[2]!).length,
  InversionsOfSecondEntry: (p) => p.slice(2).filter((v) => v < p[1]!).length,
  SumOfDistancesToGreaterElement: (p) => sum(p.map((_, i) => gapToGreater(p, i))),
  NormalizedSumOfDistancesToGreaterElement: (p) => sum(p.map((_, i) => gapToGreater(p, i) - 1)),
  HalfParityMismatches: (p) => p.filter((v, i) => Math.abs(i + 1 - v) % 2 === 1).length / 2,
  DescentWeightMinusInversions: (p) => sum(descents(p).map((i) => i * (p.length - i))) - inversionPairs(p).length,
  ReducedWordSupport: (p) => {
    // Bubble sort to the identity: the swaps are a reduced word.
    const q = [...p];
    const used = new Set<number>();
    for (let swapped = true; swapped;) {
      swapped = false;
      for (let i = 0; i + 1 < q.length; i++) {
        if (q[i]! > q[i + 1]!) {
          [q[i], q[i + 1]] = [q[i + 1]!, q[i]!];
          used.add(i + 1);
          swapped = true;
        }
      }
    }
    return used.size;
  },
  PermutationCosine: (p) => sum(p.map((v, i) => (i + 1) * v)),
  Mak: (p) =>
    vincular(p, [2, 3, 1], adjacentEnd) +
    vincular(p, [3, 2, 1], adjacentStart) +
    vincular(p, [1, 3, 2], adjacentEnd) +
    vincular(p, [2, 1], adjacentStart),
  Mad: (p) =>
    2 * vincular(p, [2, 3, 1], adjacentEnd) +
    vincular(p, [3, 1, 2], adjacentStart) +
    vincular(p, [2, 1], adjacentStart),
  Makl: (p) =>
    vincular(p, [1, 3, 2], adjacentEnd) +
    vincular(p, [3, 1, 2], adjacentStart) +
    vincular(p, [3, 2, 1], adjacentStart) +
    vincular(p, [2, 1], adjacentStart),
  BabsonSteingrimssonStatistic: (p) =>
    vincular(p, [1, 3, 2], adjacentStart) +
    vincular(p, [2, 1, 3], adjacentStart) +
    vincular(p, [3, 2, 1], adjacentStart) +
    vincular(p, [2, 1], adjacentStart),
  UlamDistance: (p) => p.length - longestIncreasing(inverse(p)),
  EvenWeakDeficienciesAndOddWeakExcedances: (p) =>
    range(1, p.length).filter((i) => (i % 2 === 0 ? p[i - 1]! <= i : p[i - 1]! >= i)).length,
  VerticalSeparators: (p) => range(2, p.length - 1).filter((i) => Math.abs(p[i - 2]! - p[i]!) === 1).length,
  CyclicAlignments: (p) => orderedPairs(p, (i, j, a, b) => cyclicallyOrdered(i, j, b, a)),
  CyclicMisalignments: (p) => orderedPairs(p, (i, j, a, b) => cyclicallyOrdered(i, a, j, b)),
  CyclicCrossings: (p) => orderedPairs(p, (i, j, a, b) => cyclicallyOrdered(i, b, a, j)),
  RestrictedNonInversionsBetweenExcedances: (p) => orderedPairs(p, (i, j, a, b) => i < j && j < a && a < b),
  InversionsBetweenExcedancesWithLinkedGreater: (p) =>
    orderedPairs(p, (i, j, a, b) => i < j && j < b && b < a && inverse(p)[j - 1]! < j),
  RestrictedNonInversionsBetweenExcedancesWithLinkedRightmost: (p) =>
    orderedPairs(p, (i, j, a, b) => i < j && j < a && a < b && inverse(p)[j - 1]! < j),
  InversionsBetweenExcedancesAndFixedPoints: (p) => orderedPairs(p, (i, j, a, b) => i < j && j === b && b < a),
  UpperMiddleEntry: (p) => (p.length === 0 ? 0 : p[Math.floor(p.length / 2)]!),
  LowerMiddleEntry: (p) => (p.length === 0 ? 0 : p[Math.floor((p.length + 1) / 2) - 1]!),
  Convexity: (p) => Math.max(0, ...range(1, p.length - 2).map((i) => 2 * p[i]! - p[i - 1]! - p[i + 1]!)),
  ProperBlocks: (p) => {
    if (p.length <= 2) return 0;
    const windows = pairs(p).filter(([i, j]) => {
      const w = p.slice(i, j + 1);
      return Math.max(...w) - Math.min(...w) === j - i;
    });
    return windows.length - 1;
  },
  HertzsprungOccurrencesOf132: (p) =>
    range(0, p.length - 3).filter((i) => {
      const d = p[i]! - 1;
      return p[i + 1]! - 3 === d && p[i + 2]! - 2 === d;
    }).length,
  PositionsOfLetterOneIn123: (p) => letterPositions(p, [1, 2, 3], 0),
  PositionsOfLetterOneIn132: (p) => letterPositions(p, [1, 3, 2], 0),
  PositionsOfLetterTwoIn213: (p) => letterPositions(p, [2, 1, 3], 0),
  PositionsOfLetterThreeIn132: (p) => letterPositions(p, [1, 3, 2], 1),
  OccurrencesOf14Dash2Dash3Or14Dash3Dash2: (p) =>
    sum(
      range(0, p.length - 2).map((i) => {
        if (p[i]! > p[i + 1]!) return 0;
        const c = p.slice(i + 2).filter((v) => p[i]! < v && v < p[i + 1]!).length;
        return (c * (c - 1)) / 2;
      }),
    ),
  InversionsOfCyclicEmbedding: (p) => {
    const n = p.length;
    const q = new Array<number>(n + 1);
    p.forEach((v, i) => (q[v - 1] = i + 1 < n ? p[i + 1]! : n + 1));
    q[n] = n === 0 ? 1 : p[0]!;
    return inversionPairs(q).length;
  },
  ShareshianWachsAdmissibleInversions: (p) => shareshianWachs(p),
  AdmissibleInversionsPlusDescents: (p) => shareshianWachs(p) + descents(p).length,
  AdmissibleInversions: (p) =>
    range(1, p.length).reduce(
      (total, i) =>
        total +
        range(i + 1, p.length).filter(
          (j) =>
            p[i - 1]! > p[j - 1]! &&
            ((i > 1 && p[i - 2]! < p[i - 1]!) || range(i + 1, j - 1).some((l) => p[i - 1]! < p[l - 1]!)),
        ).length,
      0,
    ),
  LargestGreatestCommonDivisorOfPositionAndValue: (p) => Math.max(0, ...p.map((v, i) => gcd(i + 1, v))),
};
