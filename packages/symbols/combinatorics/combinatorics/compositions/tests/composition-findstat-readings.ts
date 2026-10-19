// Independent readings of the composition statistics adopted from FindStat, written against
// FindStat's definitions (and the geometry they name) rather than against the expressions:
// brute force where the expression is a recurrence or a formula, a simulation of the path where
// it is a state machine.

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);
const pairs = (c: readonly number[]): [number, number][] => c.slice(1).map((v, i) => [c[i]!, v]);
const indices = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

/** The multiplicity of each part size that occurs. */
const multiplicities = (c: readonly number[]): number[] => {
  const seen = new Map<number, number>();
  for (const part of c) seen.set(part, (seen.get(part) ?? 0) + 1);
  return [...seen.values()];
};

/** The maximal runs of equal parts, as lengths. */
const runs = (c: readonly number[]): number[] => {
  const lengths: number[] = [];
  for (const [i, part] of c.entries()) {
    if (i > 0 && part === c[i - 1]) lengths[lengths.length - 1]!++;
    else lengths.push(1);
  }
  return lengths;
};

/** Every subsequence of `c`, as the chosen parts in order. */
const subsequences = (c: readonly number[]): number[][] =>
  c.reduce<number[][]>((all, part) => [...all, ...all.map((s) => [...s, part])], [[]]);
const longest = (c: readonly number[], ok: (s: readonly number[]) => boolean): number =>
  Math.max(
    ...subsequences(c)
      .filter(ok)
      .map((s) => s.length),
  );
const consecutively = (s: readonly number[], test: (a: number, b: number) => boolean): boolean =>
  pairs(s).every(([a, b]) => test(a, b));

/** A record: the part is above (strong) or not below (weak) all that come before. */
const records = (c: readonly number[], strong: boolean): number[] =>
  indices(c.length).filter((i) => c.slice(0, i).every((before) => (strong ? before < c[i]! : before <= c[i]!)));

/**
 * The bargraph's boundary as steps U, H, D: for each bar, climb or descend to its height, then
 * cross it; finally come down to the axis.
 */
function bargraph(c: readonly number[]): string {
  let steps = "";
  let height = 0;
  for (const bar of c) {
    steps += (bar > height ? "U" : "D").repeat(Math.abs(bar - height)) + "H";
    height = bar;
  }
  return steps + "D".repeat(height);
}
/** The height after each step of the word. */
const heights = (steps: string): number[] =>
  steps
    .split("")
    .reduce<number[]>((acc, step) => [...acc, (acc.at(-1) ?? 0) + (step === "U" ? 1 : step === "D" ? -1 : 0)], []);

/** Every ordering of 1 .. n. */
function* orderings(n: number): Generator<number[]> {
  const rest = (taken: number[]): Generator<number[]> =>
    taken.length === n
      ? (function* () {
          yield taken;
        })()
      : (function* () {
          for (let v = 1; v <= n; v++) if (!taken.includes(v)) yield* rest([...taken, v]);
        })();
  yield* rest([]);
}

/** Standard immaculate tableaux: fillings of 1 .. n with rows increasing and the first column increasing downwards. */
function immaculate(c: readonly number[]): number {
  const n = sum(c);
  let found = 0;
  for (const filling of orderings(n)) {
    let at = 0;
    const rows = c.map((len) => filling.slice(at, (at += len)));
    const rowsIncrease = rows.every((row) => consecutively(row, (a, b) => a < b));
    if (
      rowsIncrease &&
      consecutively(
        rows.map((row) => row[0]!),
        (a, b) => a < b,
      )
    )
      found++;
  }
  return n === 0 ? 1 : found;
}

/** Permutations of 1 .. n whose descents are exactly the partial sums of the composition. */
function ribbonFillings(c: readonly number[]): number {
  const n = sum(c);
  const descents = new Set(c.slice(0, -1).map((_, i) => sum(c.slice(0, i + 1))));
  let found = 0;
  for (const p of orderings(n)) {
    const here = new Set(
      indices(n - 1)
        .filter((i) => p[i]! > p[i + 1]!)
        .map((i) => i + 1),
    );
    if (here.size === descents.size && [...here].every((d) => descents.has(d))) found++;
  }
  return found;
}

/** The ribbon as a skew shape lambda/mu (Sage's `composition_to_ribbon`), rows top to bottom. */
function ribbon(c: readonly number[]): { outer: number[]; inner: number[] } {
  const outer: number[] = [];
  const inner: number[] = [];
  let indent = 0;
  for (const part of c.toReversed()) {
    if (indent > 0) inner.push(indent);
    outer.push(part + indent);
    indent += part - 1;
  }
  return { outer: outer.toReversed(), inner: inner.toReversed() };
}

export type Reading = (c: readonly number[]) => number;

export const COMPOSITION_READINGS: Record<string, Reading> = {
  LargestPart: (c) => Math.max(0, ...c),
  FirstPart: (c) => c[0] ?? 0,
  LastPart: (c) => c.at(-1) ?? 0,
  SmallestPart: (c) => (c.length === 0 ? 0 : Math.min(...c)),
  DistinctParts: (c) => new Set(c).size,
  LargestMultiplicity: (c) => Math.max(0, ...multiplicities(c)),
  SmallestMultiplicity: (c) => (c.length === 0 ? 0 : Math.min(...multiplicities(c))),
  DistinctMultiplicities: (c) => new Set(multiplicities(c)).size,
  Ascents: (c) => pairs(c).filter(([a, b]) => a < b).length,
  WeakDescentCount: (c) => pairs(c).filter(([a, b]) => a >= b).length,
  Peaks: (c) => c.filter((part, i) => i > 0 && i < c.length - 1 && part > c[i - 1]! && part > c[i + 1]!).length,
  Inversions: (c) => c.flatMap((a, i) => c.slice(i + 1).filter((b) => a > b)).length,
  // The descents of the composition are its running totals short of the whole.
  CompositionMajorIndex: (c) => sum(c.map((_, i) => sum(c.slice(0, i + 1))).slice(0, -1)),
  MajorIndex: (c) => sum(pairs(c).flatMap(([a, b], i) => (a > b ? [i + 1] : []))),
  WeakMajorIndex: (c) => sum(pairs(c).flatMap(([a, b], i) => (a >= b ? [i + 1] : []))),
  AbsoluteVariation: (c) => sum(pairs(c).map(([a, b]) => Math.abs(b - a))),
  Variation: (c) => sum(pairs(c).map(([a, b]) => b - a)),
  AscentVariation: (c) => sum(pairs(c).map(([a, b]) => Math.max(b - a, 0))),
  StrongRecordCount: (c) => records(c, true).length,
  WeakRecordCount: (c) => records(c, false).length,
  StrongRecordPositionSum: (c) => sum(records(c, true).map((i) => i + 1)),
  WeakRecordPositionSum: (c) => sum(records(c, false).map((i) => i + 1)),
  LongestWeaklyIncreasingSubsequence: (c) =>
    c.length === 0 ? 0 : longest(c, (s) => consecutively(s, (a, b) => a <= b)),
  LongestDecreasingSubsequence: (c) => (c.length === 0 ? 0 : longest(c, (s) => consecutively(s, (a, b) => a > b))),
  LongestStaircase: (c) => longest(c, (s) => s.every((part, m) => part >= m + 1)),
  ConstantRunCount: (c) => runs(c).length,
  LongestConstantRun: (c) => Math.max(0, ...runs(c)),
  ShortestConstantRun: (c) => (c.length === 0 ? 0 : Math.min(...runs(c))),
  BargraphPeakCount: (c) => bargraph(c).match(/UH*D/g)?.length ?? 0,
  BargraphHalfPerimeter: (c) =>
    bargraph(c)
      .split("")
      .filter((step) => step !== "D").length,
  BargraphUpStepCount: (c) =>
    bargraph(c)
      .split("")
      .filter((step) => step === "U").length,
  // A valley is D H* U; its height is the level the H steps run along.
  BargraphValleyHeightSum: (c) => {
    const steps = bargraph(c);
    const level = heights(steps);
    return sum([...steps.matchAll(/DH*U/g)].map((m) => level[m.index!]!));
  },
  AsymmetryDegree: (c) => indices(Math.floor(c.length / 2)).filter((i) => c[i] !== c[c.length - 1 - i]).length,
  PartsEqualToReversedPart: (c) => c.filter((part, i) => part === c.toReversed()[i]).length,
  RotationOrbitSize: (c) => new Set(c.map((_, r) => [...c.slice(r), ...c.slice(0, r)].join(","))).size,
  StandardImmaculateTableauCount: immaculate,
  StandardRibbonTableauCount: (c) => (sum(c) === 0 ? 1 : ribbonFillings(c)),
  // Sage's count: the outer corners of lambda, and the inner partition's addable cells; one cell is one corner.
  RibbonCornerCount: (c) => {
    if (sum(c) === 0) return 0;
    if (sum(c) === 1) return 1;
    const { outer, inner } = ribbon(c);
    return new Set(outer).size + 1 + new Set(inner).size;
  },
};
