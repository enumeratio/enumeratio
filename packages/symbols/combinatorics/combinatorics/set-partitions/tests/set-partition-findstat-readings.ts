// Independent readings of the set-partition statistics adopted from FindStat, written against
// the blocks and their elements rather than against the expressions.
//
// A set partition is its blocks, each ascending, ordered by least element.

export type SetPartition = readonly (readonly number[])[];

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);
const size = (p: SetPartition): number => sum(p.map((b) => b.length));
const first = (b: readonly number[]): number => b[0]!;
const last = (b: readonly number[]): number => b[b.length - 1]!;
const pairs = <T>(xs: readonly T[]): [T, T][] => xs.flatMap((x, i) => xs.slice(i + 1).map((y): [T, T] => [x, y]));

/** The arcs: consecutive elements of one block. */
const arcs = (p: SetPartition): [number, number][] =>
  p.flatMap((b) => b.slice(1).map((e, i): [number, number] => [b[i]!, e]));

/** Block index (from 0, by least element) of each element 1..n, at index element - 1. */
const blockIndex = (p: SetPartition): number[] => {
  const w: number[] = [];
  p.forEach((b, i) => b.forEach((e) => (w[e - 1] = i)));
  return w;
};

/** The restricted growth word with the blocks ordered by greatest element. */
const wordByMaximum = (p: SetPartition): number[] => {
  const w: number[] = [];
  p.toSorted((a, b) => last(a) - last(b)).forEach((b, i) => b.forEach((e) => (w[e - 1] = i)));
  return w;
};

const majorIndex = (w: readonly number[]): number =>
  sum(w.flatMap((v, i) => (i + 1 < w.length && v > w[i + 1]! ? [i + 1] : [])));

/** Pairs of block orderings: for each block k (by least element) and each block l before (`-1`) or
 *  after (`+1`) it, the pair (j, i) with j an opener or closer of k and i an element of l. */
const crossPairs = (p: SetPartition, end: (b: readonly number[]) => number, side: 1 | -1): [number, number][] =>
  p.flatMap((b, k) =>
    p.flatMap((c, l) => ((side === -1 ? l < k : l > k) ? c.map((i): [number, number] => [end(b), i]) : [])),
  );
const countOf = (xs: [number, number][], test: (j: number, i: number) => boolean): number =>
  xs.filter(([j, i]) => test(j, i)).length;

/** Occurrences of a set-partition pattern: subsets of the elements whose restriction has the
 *  pattern's shape, with the given pattern positions required to be openers or closers. */
const occurrences = (
  p: SetPartition,
  pattern: readonly (readonly number[])[],
  openers: readonly number[] = [],
  closers: readonly number[] = [],
): number => {
  const n = size(p);
  const of = blockIndex(p);
  const k = size(pattern);
  const shape = blockIndex(pattern);
  const isOpener = (e: number): boolean => first(p[of[e - 1]!]!) === e;
  const isCloser = (e: number): boolean => last(p[of[e - 1]!]!) === e;
  let total = 0;
  const choose = (chosen: number[], from: number): void => {
    if (chosen.length === k) {
      const same = chosen.every((a, i) =>
        chosen.every((b, j) => (of[a - 1] === of[b - 1]) === (shape[i] === shape[j])),
      );
      if (same && openers.every((i) => isOpener(chosen[i - 1]!)) && closers.every((i) => isCloser(chosen[i - 1]!)))
        total++;
      return;
    }
    for (let e = from; e <= n; e++) choose([...chosen, e], e + 1);
  };
  choose([], 1);
  return total;
};

const rotationOrbit = (p: SetPartition): number => {
  const n = size(p);
  if (n === 0) return 0;
  const w = blockIndex(p);
  for (let k = 1; k <= n; k++) {
    const rotated = Array.from({ length: n }, (_, i) => w[(i + k) % n]!);
    if (w.every((a, i) => w.every((b, j) => (a === b) === (rotated[i] === rotated[j])))) return k;
  }
  return 1;
};

const depthOfElement = (p: SetPartition, i: number): number => arcs(p).filter(([a, b]) => a < i && i < b).length;

export const SET_PARTITION_READINGS: Readonly<Record<string, (p: SetPartition) => number>> = {
  RotationOrbitSize: rotationOrbit,
  IntertwiningNumber: (p) =>
    sum(
      pairs(p).map(
        ([a, b]) =>
          a
            .flatMap((x) => b.map((y) => [x, y] as const))
            .filter(([x, y]) => [...a, ...b].every((e) => e <= Math.min(x, y) || e >= Math.max(x, y))).length,
      ),
    ),
  RightOpenerSmaller: (p) => countOf(crossPairs(p, first, -1), (j, i) => i > j),
  RightOpenerBigger: (p) => countOf(crossPairs(p, first, -1), (j, i) => i < j),
  LeftOpenerSmaller: (p) => countOf(crossPairs(p, first, 1), (j, i) => i > j),
  RightCloserSmaller: (p) => countOf(crossPairs(p, last, -1), (j, i) => i > j),
  RightCloserBigger: (p) => countOf(crossPairs(p, last, -1), (j, i) => i < j),
  LeftCloserSmaller: (p) => countOf(crossPairs(p, last, 1), (j, i) => i > j),
  LeftCloserBigger: (p) => countOf(crossPairs(p, last, 1), (j, i) => i < j),
  BlockMajorIndex: (p) => sum(p.slice(0, -1).map((b, i) => (i + 1) * b.filter((e) => e > first(p[i + 1]!)).length)),
  FlattenedMajorIndex: (p) => majorIndex(p.flat()),
  HuangRhoadesMajorIndex: (p) => {
    const flat = p.flat();
    let cumulative = 0;
    let extra = 0;
    p.slice(0, -1).forEach((b, i) => {
      cumulative += b.length - 1;
      if (last(b) < first(p[i + 1]!)) extra += cumulative;
    });
    return majorIndex(flat) + extra;
  },
  FirstAtomicComponentBlockCount: (p) => {
    const seen: number[] = [];
    for (let i = 0; i < p.length; i++) {
      seen.push(...p[i]!);
      if (Math.max(...seen) === seen.length) return i + 1;
    }
    return 0;
  },
  DepthIndex: (p) => {
    const n = size(p);
    const a = arcs(p);
    const total = sum(a.map((_, i) => n - (i + 1)));
    const vertices = sum(Array.from({ length: n }, (_, i) => depthOfElement(p, i + 1)));
    const arcDepths = sum(a.map(([l, r]) => a.filter(([x, y]) => x < l && r < y).length));
    return total - vertices + arcDepths;
  },
  FlattenedAscentTopsAfterSmaller: (p) => {
    const flat = p.flat();
    return flat.filter((v, i) => {
      if (i + 1 >= flat.length || !(v < flat[i + 1]!)) return false;
      const before = new Set(flat.slice(0, i + 1));
      return Array.from({ length: flat[i + 1]! - 1 }, (_, m) => m + 1).every((m) => before.has(m));
    }).length;
  },
  InterlacingNumber: (p) => {
    const n = size(p);
    const chains = p.map((b) => [...b, n + 1]).map((b) => b.slice(1).map((e, i): [number, number] => [b[i]!, e]));
    return sum(
      pairs(chains).map(
        ([s, t]) =>
          s.slice(0, Math.min(s.length, t.length)).filter(([a, b], i) => {
            const [c, d] = t[i]!;
            return (a < c && c < b && b < d) || (c < a && a < d && d < b);
          }).length,
      ),
    );
  },
  FirstBlockSecondOrSmallestNonsingletonMaximum: (p) => {
    if (p.length === 0) return 0;
    const firstBlock = p[0]!;
    if (firstBlock.length === 1) return 1;
    const closers = p.filter((b) => b.length > 1).map(last);
    return Math.min(firstBlock[1]!, ...closers);
  },
  MahonianWordExcedances: (p) => {
    const w = wordByMaximum(p);
    const sorted = w.toSorted((a, b) => a - b);
    return w.filter((v, i) => sorted[i]! < v).length;
  },
  MahonianWordDescents: (p) => {
    const w = wordByMaximum(p);
    return w.filter((v, i) => i + 1 < w.length && v > w[i + 1]!).length;
  },
  MahonianWordInversions: (p) => {
    const w = wordByMaximum(p);
    return pairs(w).filter(([a, b]) => a > b).length;
  },
  MahonianWordMajorIndex: (p) => majorIndex(wordByMaximum(p)),
  MahonianWordZIndex: (p) => {
    const w = wordByMaximum(p);
    const letters = [...new Set(w)];
    return sum(pairs(letters).map(([a, b]) => majorIndex(w.filter((v) => v === a || v === b))));
  },
  OccurrencesOf12Over3: (p) => occurrences(p, [[1, 2], [3]]),
  OccurrencesOf13Over2: (p) => occurrences(p, [[1, 3], [2]]),
  OccurrencesOf1Over23: (p) => occurrences(p, [[1], [2, 3]]),
  OccurrencesOf1Over2Over3: (p) => occurrences(p, [[1], [2], [3]]),
  OccurrencesOf13Over24: (p) =>
    occurrences(p, [
      [1, 3],
      [2, 4],
    ]),
  OccurrencesOf12Over34: (p) =>
    occurrences(p, [
      [1, 2],
      [3, 4],
    ]),
  SingletonBeforeCloserPairs: (p) => occurrences(p, [[1], [2]], [1], [1, 2]),
  OpenerBeforeCloserPairs: (p) => occurrences(p, [[1], [2]], [1], [2]),
  CloserBeforeSingletonPairs: (p) => occurrences(p, [[1], [2]], [2], [1, 2]),
  CloserBeforeOpenerPairs: (p) => occurrences(p, [[1], [2]], [2], [1]),
  SingletonBeforeLargerPairs: (p) => occurrences(p, [[1], [2]], [1], [1]),
  SmallerBeforeCloserPairs: (p) => occurrences(p, [[1], [2]], [], [2]),
};
