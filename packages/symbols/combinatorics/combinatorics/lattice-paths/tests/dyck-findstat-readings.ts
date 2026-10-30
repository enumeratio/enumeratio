// Independent readings of the Dyck-path statistics adopted from FindStat, written against
// FindStat's descriptions (steps, heights, runs, tunnels) rather than against the expressions.
//
// A path is its step word: 1 for an up step (north), 0 for a down step (east).

export type Word = readonly number[];

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);

/** Heights at every vertex, the origin included. */
const heights = (w: Word): number[] => {
  const h = [0];
  for (const s of w) h.push(h[h.length - 1]! + (s === 1 ? 1 : -1));
  return h;
};
/** Maximal runs of equal steps, as [step, length]. */
const runs = (w: Word): [number, number][] => {
  const out: [number, number][] = [];
  for (const s of w) {
    const last = out[out.length - 1];
    if (last && last[0] === s) last[1]++;
    else out.push([s, 1]);
  }
  return out;
};
/** Lengths of the maximal runs of up steps. */
const rises = (w: Word): number[] => runs(w).flatMap(([s, k]) => (s === 1 ? [k] : []));
/** Indices of the up steps that are followed by a down step. */
const peakIndices = (w: Word): number[] => w.flatMap((s, i) => (s === 1 && w[i + 1] === 0 ? [i] : []));
/** Indices of the down steps that are followed by an up step. */
const valleyIndices = (w: Word): number[] => w.flatMap((s, i) => (s === 0 && w[i + 1] === 1 ? [i] : []));
/** Each up step's index paired with the index of its matching down step. */
const tunnels = (w: Word): [number, number][] => {
  const open: number[] = [];
  const out: [number, number][] = [];
  w.forEach((s, i) => {
    if (s === 1) open.push(i);
    else out.push([open.pop()!, i]);
  });
  return out;
};
/** Consecutive pairs of runs (first, second): the pyramids when it is up then down, the valleys' dual otherwise. */
const interactions = (w: Word, first: number): number => {
  const r = runs(w);
  let total = 0;
  for (let k = 0; k + 1 < r.length; k++) if (r[k]![0] === first) total += Math.min(r[k]![1], r[k + 1]![1]);
  return total;
};
/** Pairs of tunnels, one strictly inside the other. */
const nestedPairs = (ts: readonly [number, number][]): number =>
  ts.reduce((acc, [i1, d1]) => acc + ts.filter(([i2, d2]) => i1 < i2 && d2 < d1).length, 0);
const weakPeakMaxima = (w: Word, strict: boolean): number => {
  const h = heights(w);
  let best = 0;
  let found = 0;
  for (const i of peakIndices(w)) {
    const height = h[i + 1]!;
    if (strict ? height > best : height >= best) {
      best = height;
      found++;
    }
  }
  return found;
};
/** Occurrences of a height profile, starting anywhere. */
const profileOccurrences = (w: Word, profile: readonly number[]): number => {
  const h = heights(w);
  let found = 0;
  for (let i = 0; i + profile.length <= h.length; i++) if (profile.every((p, k) => h[i + k] === p)) found++;
  return found;
};

/** a_1 .. a_n: the height right before each up step, the area sequence. */
const areaSequence = (w: Word): number[] => {
  const h = heights(w);
  return w.flatMap((s, i) => (s === 1 ? [h[i]!] : []));
};
const areaOf = (w: Word): number => sum(areaSequence(w));
const dinvOf = (w: Word): number => {
  const a = areaSequence(w);
  let found = 0;
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++) {
      if (a[i] === a[j]) found++;
      if (a[i] === a[j]! + 1) found++;
    }
  return found;
};
/**
 * The bounce path starts at the end and travels toward the origin, so it is the walk of the
 * mirror image (reversed, up and down swapped) from the start: climb to the ceiling above the
 * current diagonal point, cross to the diagonal, repeat. Returns the bounce points reached.
 */
const bouncePoints = (w: Word): number[] => {
  const n = w.length / 2;
  const mirror = w.toReversed().map((s) => 1 - s);
  const h = heights(mirror);
  // The ceiling above column x: the height before the x-th down step plus x.
  const ceilings = mirror.flatMap((s, i) => (s === 0 ? [h[i]!] : [])).map((height, x) => height + x);
  const points = [0];
  while (points[points.length - 1]! < n) points.push(ceilings[points[points.length - 1]!]!);
  return points;
};
const bounceOf = (w: Word): number => {
  const points = bouncePoints(w);
  // Each climb weighs its length by the number of crossings before it.
  return sum(points.slice(1).map((k, c) => c * (k - points[c]!)));
};
const triangle = (w: Word): number => ((w.length / 2) * (w.length / 2 - 1)) / 2 + 0;

// ── the second batch ──────────────────────────────────────────────────────────────────────

const dyckWordCache = new Map<number, Word[]>();
/** Every Dyck word of semilength n. */
const dyckWordsOf = (n: number): Word[] => {
  const cached = dyckWordCache.get(n);
  if (cached) return cached;
  const out: Word[] = [];
  const walk = (word: number[], up: number, down: number): void => {
    if (word.length === 2 * n) out.push(word);
    else {
      if (up < n) walk([...word, 1], up + 1, down);
      if (down < up) walk([...word, 0], up, down + 1);
    }
  };
  walk([], 0, 0);
  dyckWordCache.set(n, out);
  return out;
};
/** Every permutation of 1..n. */
const permutationsOf = (n: number): number[][] =>
  n === 0
    ? [[]]
    : permutationsOf(n - 1).flatMap((p) => Array.from({ length: n }, (_, i) => [...p.slice(0, i), n, ...p.slice(i)]));
/** Occurrences of the factor `first^k second^k`, for every k >= 1, anywhere in the word. */
const factorOccurrences = (w: Word, first: number, second: number): number => {
  let found = 0;
  for (let i = 0; i < w.length; i++)
    for (let k = 1; i + 2 * k <= w.length; k++)
      if (w.slice(i, i + k).every((s) => s === first) && w.slice(i + k, i + 2 * k).every((s) => s === second)) found++;
  return found;
};
/** The path as lattice vertices, up = north and down = east. */
const latticeVertices = (w: Word): [number, number][] => {
  const out: [number, number][] = [[0, 0]];
  for (const s of w) {
    const [x, y] = out[out.length - 1]!;
    out.push(s === 1 ? [x, y + 1] : [x + 1, y]);
  }
  return out;
};
/** Boxes wholly between the path and the diagonal, counted when the peaks whose shadow covers them satisfy `wanted`. */
const boxesBelowPeaks = (w: Word, wanted: (peaks: number) => boolean): number => {
  const vertices = latticeVertices(w);
  const peaks = w.flatMap((s, i) => (s === 1 && w[i + 1] === 0 ? [vertices[i + 1]!] : []));
  // The column [x, x+1] is capped by the path's height after its east step.
  const top = (x: number): number => vertices.find(([vx], i) => i > 0 && w[i - 1] === 0 && vx === x + 1)![1];
  let found = 0;
  for (let x = 0; x < w.length / 2; x++)
    for (let y = x + 1; y + 1 <= top(x); y++)
      if (wanted(peaks.filter(([px, py]) => px <= x && y + 1 <= py).length)) found++;
  return found;
};
/** The bounce path as a Dyck word: a climb up and straight back down for each bounce point. */
const bouncePathWord = (w: Word): number[] => {
  const points = bouncePoints(w);
  return points.slice(1).flatMap((k, c) => {
    const climb = k - points[c]!;
    return [...Array<number>(climb).fill(1), ...Array<number>(climb).fill(0)];
  });
};
/** The Dyck paths of the same semilength whose area sequence is bounded entrywise by the path's (or bounds it). */
const sameSemilengthByArea = (w: Word, below: boolean): number => {
  const a = areaSequence(w);
  return dyckWordsOf(w.length / 2).filter((v) => {
    const b = areaSequence(v);
    return a.every((entry, i) => (below ? entry >= b[i]! : entry <= b[i]!));
  }).length;
};
/** The 3-Catalan paths (steps along x, y or z, always x >= y >= z) to (n, n, n) whose two projections are one Dyck path, by that path. */
const threeCatalanTables = new Map<number, Map<string, number>>();
const threeCatalanCounts = (n: number): Map<string, number> => {
  const cached = threeCatalanTables.get(n);
  if (cached) return cached;
  const table = new Map<string, number>();
  const walk = (x: number, y: number, z: number, xy: string, yz: string): void => {
    if (x === n && y === n && z === n) {
      if (xy === yz) table.set(xy, (table.get(xy) ?? 0) + 1);
      return;
    }
    if (x < n) walk(x + 1, y, z, xy + "1", yz);
    if (y < x) walk(x, y + 1, z, xy + "0", yz + "1");
    if (z < y) walk(x, y, z + 1, xy, yz + "0");
  };
  walk(0, 0, 0, "", "");
  threeCatalanTables.set(n, table);
  return table;
};
/**
 * The polyomino's cells as [column, row], from the pairing of steps: past the first and before the
 * last, the pair (2t, 2t+1) is one step of each bounding path (up-up: north and east; down-down:
 * east and north; up-down: both east; down-up: both north). Column j spans the heights of the two
 * paths' j-th east steps.
 */
const polyominoCells = (w: Word): [number, number][] => {
  const n = w.length / 2;
  const upper = [1];
  const lower = [0];
  for (let t = 1; t < n; t++) {
    const pair = `${w[2 * t - 1]}${w[2 * t]}`;
    upper.push({ "11": 1, "00": 0, "01": 1, "10": 0 }[pair]!);
    lower.push({ "11": 0, "00": 1, "01": 1, "10": 0 }[pair]!);
  }
  upper.push(0);
  lower.push(1);
  const eastHeights = (path: number[]): number[] => {
    let y = 0;
    const out: number[] = [];
    for (const s of path)
      if (s === 1) y++;
      else out.push(y);
    return out;
  };
  const tops = eastHeights(upper);
  const bottoms = eastHeights(lower);
  return tops.flatMap((top, x) =>
    Array.from({ length: top - bottoms[x]! }, (_, k): [number, number] => [x, bottoms[x]! + k]),
  );
};
/** Cells per column, left to right. */
const polyominoColumns = (w: Word): number[] => {
  const cells = polyominoCells(w);
  const width = Math.max(-1, ...cells.map(([x]) => x)) + 1;
  return Array.from({ length: width }, (_, x) => cells.filter(([cx]) => cx === x).length);
};
/** Distinct heights at which the columns start (or end), less the one every polyomino has. */
const polyominoCorners = (w: Word, edge: "bottom" | "top"): number => {
  const cells = polyominoCells(w);
  const width = Math.max(-1, ...cells.map(([x]) => x)) + 1;
  const edges = Array.from({ length: width }, (_, x) => {
    const ys = cells.filter(([cx]) => cx === x).map(([, y]) => y);
    return edge === "bottom" ? Math.min(...ys) : Math.max(...ys);
  });
  return new Set(edges).size - 1;
};

// ── natural descents (St001955, St001956), as FindStat's rules state them ──────────────────

/** True if the steps from 1-based position `from` read `pattern`. */
const readsAt = (w: Word, from: number, pattern: readonly number[]): boolean =>
  from >= 1 && pattern.every((s, offset) => w[from - 1 + offset] === s);
const naturalDescentsOf = (w: Word): number[] => {
  let pivot = 1;
  while (w[2 * pivot - 1] !== 0) pivot++;
  const found: number[] = [];
  for (let k = 1; k <= w.length + 1; k++) {
    const past = k - 2 >= pivot;
    if (
      (past && readsAt(w, 2 * k - 3, [0, 1])) ||
      (past && readsAt(w, 2 * k - 3, [1, 0])) ||
      (k - 1 >= pivot && readsAt(w, 2 * k - 2, [0, 1, 1])) ||
      (k === pivot && readsAt(w, 2 * k - 1, [0, 0])) ||
      (k < pivot && readsAt(w, 2 * k - 1, [0, 1]))
    )
      found.push(k);
  }
  return found;
};

// ── the invariant's descents (St001104) ────────────────────────────────────────────────────

const invariantDescentsOf = (w: Word): number => {
  const pairs = Array.from({ length: w.length / 2 }, (_, i) => `${w[2 * i]}${w[2 * i + 1]}`);
  let level = 0;
  let found = 0;
  for (let i = 0; i + 1 < pairs.length; i++) {
    const [here, next] = [pairs[i], pairs[i + 1]];
    if (here === "11") {
      level++;
      if (next === "01" || (next === "00" && level > 1)) found++;
    } else if (here === "10") {
      if (next !== "10") found++;
    } else if (here === "01") {
      if (next === "00") found++;
    } else level--;
  }
  return found;
};

// ── the standard monomial relative to the diagonal (St001508) ──────────────────────────────

const standardMonomialSize = (w: Word): number => {
  const blockers = Array.from({ length: w.length / 2 }, (_, i) => 2 * i + 1);
  let open = 0;
  let size = 0;
  w.forEach((s, index) => {
    const position = index + 1;
    if (s === 1) {
      if (blockers.length === 0 || position < blockers[0]!) open++;
      else blockers.shift();
    } else if (open > 0) {
      open--;
      size++;
      blockers.shift();
    }
  });
  return size;
};

// ── Biane's noncrossing partition and merging its singletons (St001932) ────────────────────

const mergeableSingletonPairs = (w: Word): number => {
  const open: number[] = [];
  let ups = 0;
  let run = -1;
  const blocks = new Map<number, number[]>();
  w.forEach((s, i) => {
    if (s === 1) open.push(++ups);
    else {
      if (i === 0 || w[i - 1] === 1) run++;
      blocks.set(run, [...(blocks.get(run) ?? []), open.pop()!]);
    }
  });
  const parts = [...blocks.values()];
  // Two blocks cross when some a < c < b < d has a, b in one and c, d in the other.
  const cross = (x: number[], y: number[]): boolean =>
    x.some((a) => x.some((b) => y.some((c) => y.some((d) => a < c && c < b && b < d))));
  const noncrossing = (ps: number[][]): boolean => ps.every((x) => ps.every((y) => x === y || !cross(x, y)));
  const singles = parts.filter((b) => b.length === 1);
  let found = 0;
  for (let i = 0; i < singles.length; i++)
    for (let j = i + 1; j < singles.length; j++) {
      const merged = [...singles[i]!, ...singles[j]!];
      if (noncrossing([...parts.filter((b) => b !== singles[i] && b !== singles[j]), merged])) found++;
    }
  return found;
};

// ── the linear Nakayama algebra of a path (module counts by projective dimension) ──────────

/**
 * Kupisch series from the reversed path, as FindStat builds it: one entry per down step of the
 * reversed path (one more than the height it starts from), then a final 1. A module (top x, length
 * y) is projective when y is the entry at x; its syzygy has top x + y and length entry - y.
 */
const nakayama = (w: Word) => {
  const reversed = w.toReversed().map((s) => 1 - s);
  const h = heights(reversed);
  const series = [...reversed.flatMap((s, i) => (s === 0 ? [1 + h[i]!] : [])), 1];
  const projectiveDimension = (top: number, length: number): number => {
    let [x, y, steps] = [top, length, 0];
    while (y !== series[x]) {
      [x, y] = [x + y, series[x]! - y];
      steps++;
    }
    return steps;
  };
  const modules = series.flatMap((entry, x) => Array.from({ length: entry }, (_, k): [number, number] => [x, k + 1]));
  const simple = modules.filter(([, y]) => y === 1).map(([x, y]) => projectiveDimension(x, y));
  // An injective module cannot be lengthened to the left.
  const injective = modules
    .filter(([x, y]) => x === 0 || series[x - 1]! <= y)
    .map(([x, y]) => projectiveDimension(x, y));
  const all = modules.map(([x, y]) => projectiveDimension(x, y));
  return { simple, injective, all, global: Math.max(...simple) };
};
const overNakayama =
  (body: (a: ReturnType<typeof nakayama>) => number) =>
  (w: Word): number =>
    w.length === 0 ? 0 : body(nakayama(w));
const countOf = (xs: readonly number[], test: (d: number) => boolean): number => xs.filter(test).length;
const peaksOf = (w: Word): number => w.filter((s, i) => s === 1 && w[i + 1] === 0).length;

export const DYCK_READINGS: Record<string, (w: Word) => number> = {
  SetValuedTableauNaturalDescents: (w) => (w.length === 0 ? 0 : naturalDescentsOf(w).length),
  SetValuedTableauComajorIndex: (w) =>
    w.length === 0 ? 0 : naturalDescentsOf(w).reduce((total, k) => total + w.length / 2 + 1 - k, 0),
  AdjointInvariantDescents: invariantDescentsOf,
  DiagonalStandardMonomialDegree: standardMonomialSize,
  NoncrossingMergeableSingletonPairs: mergeableSingletonPairs,
  NakayamaGlobalDimension: overNakayama((a) => a.global),
  FirstSimpleProjectiveDimension: overNakayama((a) => a.simple[0]!),
  SimpleProjectiveDimensionSum: overNakayama((a) => sum(a.simple)),
  SimpleProjectiveDimensionProduct: overNakayama((a) => a.simple.reduce((p, d) => (d === 0 ? p : p * d), 1)),
  SimplesOfMaximalProjectiveDimension: overNakayama((a) => countOf(a.simple, (d) => d === a.global)),
  SimplesOfProjectiveDimensionTwo: overNakayama((a) => countOf(a.simple, (d) => d === 2)),
  SimplesOfProjectiveDimensionThree: overNakayama((a) => countOf(a.simple, (d) => d === 3)),
  SimplesOfProjectiveDimensionFour: overNakayama((a) => countOf(a.simple, (d) => d === 4)),
  SimplesOfProjectiveDimensionAtMostTwo: overNakayama((a) => countOf(a.simple, (d) => d <= 2)),
  SimplesOfProjectiveDimensionAtMostThree: overNakayama((a) => countOf(a.simple, (d) => d <= 3)),
  SimplesOfProjectiveDimensionAtMostFour: overNakayama((a) => countOf(a.simple, (d) => d <= 4)),
  SimplesOfEvenProjectiveDimension: overNakayama((a) => countOf(a.simple, (d) => d % 2 === 0)),
  SimplesOfMaximalEvenProjectiveDimension: overNakayama((a) => {
    const target = Math.max(...a.simple.filter((d) => d % 2 === 0));
    return countOf(a.simple, (d) => d === target);
  }),
  HalfEvenSimpleProjectiveDimensionSum: overNakayama((a) => sum(a.simple.filter((d) => d % 2 === 0)) / 2),
  FirstSimpleOfMaximalProjectiveDimension: overNakayama((a) => a.simple.indexOf(a.global)),
  LastSimpleOfMaximalProjectiveDimension: overNakayama((a) => a.simple.lastIndexOf(a.global)),
  PeaksMinusNakayamaGlobalDimension: (w) => (w.length === 0 ? 0 : peaksOf(w) - nakayama(w).global),
  InjectiveProjectiveDimensionSum: overNakayama((a) => sum(a.injective)),
  InjectivesOfProjectiveDimensionOne: overNakayama((a) => countOf(a.injective, (d) => d === 1)),
  InjectivesOfProjectiveDimensionAtMostOne: overNakayama((a) => countOf(a.injective, (d) => d <= 1)),
  InjectivesOfProjectiveDimensionAtMostTwo: overNakayama((a) => countOf(a.injective, (d) => d <= 2)),
  InjectivesOfProjectiveDimensionOneBelowMaximal: overNakayama((a) => countOf(a.injective, (d) => d === a.global - 1)),
  InjectivesOfEvenProjectiveDimension: overNakayama((a) => countOf(a.injective, (d) => d % 2 === 0)),
  ModulesOfMaximalProjectiveDimension: overNakayama((a) => countOf(a.all, (d) => d === a.global)),
  ModulesOfProjectiveDimensionAtMostOne: overNakayama((a) => countOf(a.all, (d) => d <= 1)),
  InjectivesOfMaximalProjectiveDimension: overNakayama((a) => countOf(a.injective, (d) => d === a.global)),
  Area: areaOf,
  Bounce: bounceOf,
  BounceCount: (w) => (w.length === 0 ? 0 : bouncePoints(w).length - 2),
  DinvDeficit: (w) => triangle(w) - areaOf(w) - dinvOf(w),
  BounceDeficit: (w) => triangle(w) - areaOf(w) - bounceOf(w),
  UpStepsAtEvenPositions: (w) => w.filter((s, i) => s === 1 && (i + 1) % 2 === 0).length,

  UpperInteractions: (w) => interactions(w, 0),
  PyramidWeight: (w) => interactions(w, 1),

  CenteredTunnels: (w) => tunnels(w).filter(([i, d]) => i + d + 1 === w.length).length,
  LeftTunnels: (w) => tunnels(w).filter(([i, d]) => i + d + 1 < w.length).length,
  CenteredMultitunnels: (w) => {
    const n = w.length / 2;
    const h = heights(w);
    let found = 0;
    for (let i = 1; i <= n; i++) {
      const from = n - i;
      const to = n + i;
      if (h[to] === h[from] && h.slice(from, to + 1).every((v) => v >= h[from]!)) found++;
    }
    return found;
  },

  NestedCenteredTunnelPairs: (w) => nestedPairs(tunnels(w).filter(([i, d]) => i + d + 1 === w.length)),
  NestedLeftTunnelPairs: (w) => nestedPairs(tunnels(w).filter(([i, d]) => i + d + 1 < w.length)),
  ValleyTunnelSemilengthSum: (w) => {
    const ends = new Set(valleyIndices(w));
    return sum(tunnels(w).flatMap(([i, d]) => (ends.has(d) ? [(d + 1 - i) / 2] : [])));
  },

  RisesOfLengthTwo: (w) => rises(w).filter((r) => r === 2).length,
  RisesOfLengthThree: (w) => rises(w).filter((r) => r === 3).length,
  RisesOfLengthAtLeastThree: (w) => rises(w).filter((r) => r >= 3).length,
  RunsOfLengthOne: (w) => runs(w).filter(([, k]) => k === 1).length,
  RisesOfLengthOneAtOddHeight: (w) => {
    const h = heights(w);
    let at = 0;
    let found = 0;
    for (const [s, k] of runs(w)) {
      if (s === 1 && k === 1 && h[at]! % 2 === 1) found++;
      at += k;
    }
    return found;
  },

  PeakRectangleAreaSum: (w) => {
    const peaks = peakIndices(w);
    const valleys = valleyIndices(w);
    return sum(valleys.map((j, a) => (j - peaks[a]!) * (peaks[a + 1]! - j)));
  },
  SkewHookPositionSum: (w) => {
    const ups: number[] = [];
    const downs: number[] = [];
    w.forEach((s, i) => (s === 1 ? ups : downs).push(i));
    const rank = (i: number): number => w.slice(0, i + 1).filter((s) => s === w[i]).length;
    let total = 0;
    for (let k = 2; k < w.length; k++) {
      if (w[k - 2] === 1 && w[k - 1] === 1 && w[k] === 0) total += rank(k);
      if (w[k - 2] === 0 && w[k - 1] === 0 && w[k] === 1) total += rank(k - 1);
    }
    return total;
  },
  DownStepMajorIndex: (w) => sum(valleyIndices(w).map((d) => w.slice(0, d + 1).filter((s) => s === 0).length)),
  UpStepMajorIndex: (w) => sum(valleyIndices(w).map((d) => w.slice(0, d + 1).filter((s) => s === 1).length)),

  LongestZigzag: (w) => {
    let best = 0;
    let current = 0;
    w.forEach((s, i) => {
      current = i > 0 && w[i - 1] !== s ? current + 1 : 1;
      best = Math.max(best, current);
    });
    return best;
  },
  BicoloredMotzkinHeight: (w) => {
    let h = 0;
    let top = 0;
    for (let i = 0; i < w.length; i += 2) {
      if (w[i] === 1 && w[i + 1] === 1) h++;
      else if (w[i] === 0 && w[i + 1] === 0) h--;
      top = Math.max(top, h);
    }
    return top;
  },
  BicoloredMotzkinLevelSteps: (w) => {
    let found = 0;
    for (let i = 0; i < w.length; i += 2) if (w[i] !== w[i + 1]) found++;
    return found;
  },
  MinimalValleyHeight: (w) => {
    const h = heights(w);
    return Math.min(w.length / 2, ...valleyIndices(w).map((d) => h[d + 1]!));
  },
  HillsOfSizeTwo: (w) => profileOccurrences(w, [0, 1, 2, 1, 0]),
  HillsOfSizeThree: (w) => profileOccurrences(w, [0, 1, 2, 3, 2, 1, 0]),
  MinimalPeakHeight: (w) => {
    const h = heights(w);
    return w.length === 0 ? 0 : Math.min(...peakIndices(w).map((i) => h[i + 1]!));
  },
  PeakLeftToRightMaxima: (w) => weakPeakMaxima(w, true),
  WeakPeakLeftToRightMaxima: (w) => weakPeakMaxima(w, false),
  BoxWeight: (w) => {
    let level = 1;
    let weight = 1;
    for (const s of w) {
      if (s === 0) level++;
      else weight *= level;
    }
    return weight;
  },
  MiddleNonRunHeight: (w) => {
    const h = heights(w);
    const turns = w.flatMap((s, i) => (i + 1 < w.length && s !== w[i + 1] ? [h[i + 1]!] : []));
    return turns.length === 0 ? 0 : turns[(turns.length - 1) / 2]!;
  },
  SymmetryDegree: (w) => {
    const h = heights(w);
    const r = w.toReversed().map((s) => 1 - s);
    const hr = heights(r);
    let found = 0;
    for (let i = 0; i < w.length / 2; i++) if (h[2 * i] === hr[2 * i] && h[2 * i + 1] === hr[2 * i + 1]) found++;
    return found;
  },
  ParkingFunctionCount: (w) => {
    const a = areaSequence(w);
    // The permutations whose entries increase wherever the area sequence does.
    return permutationsOf(a.length).filter((p) =>
      p.every((v, i) => i + 1 >= p.length || a[i]! >= a[i + 1]! || v < p[i + 1]!),
    ).length;
  },
  ValleyPositionSum: (w) => sum(valleyIndices(w).map((i) => i + 1)),
  InteractionDifference: (w) => factorOccurrences(w, 1, 0) - factorOccurrences(w, 0, 1),
  NonFinalConstantRunsOfLengthAtLeastTwo: (w) =>
    runs(w)
      .slice(0, -1)
      .filter(([, k]) => k >= 2).length,
  LongTunnels: (w) => {
    // Tunnels as pairs of vertices, merged end to start until none will.
    let ts: [number, number][] = tunnels(w).map(([i, d]) => [i, d + 1]);
    for (;;) {
      const t1 = ts.find((a) => ts.some((b) => a[1] === b[0]));
      if (!t1) break;
      const t2 = ts.find((b) => t1[1] === b[0])!;
      ts = [...ts.filter((t) => t !== t1 && t !== t2), [t1[0], t2[1]]];
    }
    return ts.length;
  },
  HalfMacMahonEqualIndex: (w) => sum(w.flatMap((s, i) => (s === w[i + 1] ? [i + 1] : []))) / 2,
  BoxesBelowOnePeak: (w) => boxesBelowPeaks(w, (peaks) => peaks === 1),
  BoxesBelowAtLeastTwoPeaks: (w) => boxesBelowPeaks(w, (peaks) => peaks >= 2),
  DoubleStepVisiblePoints: (w) => {
    const h = heights(w);
    // A vertex inside the path, between two steps of one kind.
    const between = (v: number, step: number): boolean => v > 0 && v < w.length && w[v - 1] === step && w[v] === step;
    let found = 0;
    for (let i = 0; i <= w.length; i++)
      for (let j = h[i]! - 2; j >= 0; j -= 2) {
        const northWest = h.some((hv, v) => between(v, 1) && v + hv === i + j);
        const northEast = h.some((hv, v) => between(v, 0) && v - hv === i - j);
        if (northWest && northEast) found++;
      }
    return found;
  },
  AreaAboveBouncePath: (w) => (w.length === 0 ? 0 : areaOf(w) - areaOf(bouncePathWord(w))),
  WeaklyBelowDyckPathCount: (w) => sameSemilengthByArea(w, true),
  ProperlyBelowDyckPathCount: (w) => sameSemilengthByArea(w, true) - 1,
  WeaklyAboveDyckPathCount: (w) => sameSemilengthByArea(w, false),
  ProperlyAboveDyckPathCount: (w) => sameSemilengthByArea(w, false) - 1,
  WeaklyAboveLatticePathCount: (w) => {
    const h = heights(w);
    let found = 0;
    // Every up-down sequence of the same length, kept when it never dips below the path.
    for (let mask = 0; mask < 2 ** w.length; mask++) {
      let height = 0;
      let ok = true;
      for (let t = 0; t < w.length && ok; t++) {
        height += (mask >> t) & 1 ? 1 : -1;
        ok = height >= h[t + 1]!;
      }
      if (ok) found++;
    }
    return found;
  },
  NorthStepOrderingCount: (w) => {
    const n = w.length / 2;
    const easts = (step: number): number => w.slice(0, step).filter((s) => s === 0).length;
    const norths = w.flatMap((s, i) => (s === 1 ? [i] : []));
    // rank[m] is the place in the order of the m-th up step. Up steps with no down step between them
    // are not told apart (FindStat counts the monomial's coefficient), so their ranks must increase.
    return permutationsOf(n).filter((rank) => {
      for (let k = 1; k <= n; k++)
        for (const [m, step] of norths.entries()) if (easts(step) >= k && rank[m]! <= k) return false;
      return norths.every((step, m) => m === 0 || easts(step) !== easts(norths[m - 1]!) || rank[m - 1]! < rank[m]!);
    }).length;
  },
  ThreeCatalanPathCount: (w) => threeCatalanCounts(w.length / 2).get(w.join("")) ?? 0,
  ParallelogramPolyominoArea: (w) => (w.length === 0 ? 0 : polyominoCells(w).length),
  ParallelogramPolyominoNormalizedArea: (w) => (w.length === 0 ? 0 : polyominoCells(w).length - w.length / 2),
  ParallelogramPolyominoMinimalColumnHeight: (w) => (w.length === 0 ? 0 : Math.min(...polyominoColumns(w))),
  ParallelogramPolyominoMaximalColumnHeight: (w) => (w.length === 0 ? 0 : Math.max(...polyominoColumns(w))),
  ParallelogramPolyominoInnerCorners: (w) =>
    w.length === 0 ? 0 : polyominoCorners(w, "bottom") + polyominoCorners(w, "top"),
  ParallelogramPolyominoUpperInnerCorners: (w) => (w.length === 0 ? 0 : polyominoCorners(w, "bottom")),
};

/** The FindStat statistic each reading is held to. */
export const DYCK_FINDSTAT: Record<string, string> = {
  Area: "St000012",
  Bounce: "St000005",
  BounceCount: "St000306",
  DinvDeficit: "St000369",
  BounceDeficit: "St000376",
  UpStepsAtEvenPositions: "St000329",
  UpperInteractions: "St000331",
  PyramidWeight: "St000144",
  CenteredTunnels: "St000117",
  LeftTunnels: "St000120",
  NestedCenteredTunnelPairs: "St000790",
  NestedLeftTunnelPairs: "St000791",
  ValleyTunnelSemilengthSum: "St000476",
  CenteredMultitunnels: "St000675",
  RisesOfLengthTwo: "St000658",
  RisesOfLengthThree: "St000661",
  RisesOfLengthAtLeastThree: "St000660",
  RunsOfLengthOne: "St001669",
  RisesOfLengthOneAtOddHeight: "St001172",
  PeakRectangleAreaSum: "St000645",
  SkewHookPositionSum: "St000946",
  DownStepMajorIndex: "St000947",
  UpStepMajorIndex: "St001161",
  LongestZigzag: "St000981",
  BicoloredMotzkinHeight: "St001031",
  BicoloredMotzkinLevelSteps: "St001032",
  MinimalValleyHeight: "St001107",
  HillsOfSizeTwo: "St001139",
  HillsOfSizeThree: "St001141",
  MinimalPeakHeight: "St001481",
  PeakLeftToRightMaxima: "St001732",
  WeakPeakLeftToRightMaxima: "St001733",
  BoxWeight: "St001808",
  MiddleNonRunHeight: "St001910",
  SymmetryDegree: "St001523",
  ParkingFunctionCount: "St000014",
  ValleyPositionSum: "St000027",
  InteractionDifference: "St000335",
  NonFinalConstantRunsOfLengthAtLeastTwo: "St000340",
  LongTunnels: "St000443",
  HalfMacMahonEqualIndex: "St000979",
  BoxesBelowOnePeak: "St000984",
  BoxesBelowAtLeastTwoPeaks: "St000980",
  DoubleStepVisiblePoints: "St000683",
  AreaAboveBouncePath: "St001584",
  WeaklyBelowDyckPathCount: "St000418",
  ProperlyBelowDyckPathCount: "St000421",
  WeaklyAboveDyckPathCount: "St000420",
  ProperlyAboveDyckPathCount: "St000419",
  WeaklyAboveLatticePathCount: "St001361",
  NorthStepOrderingCount: "St001786",
  ThreeCatalanPathCount: "St001800",
  ParallelogramPolyominoArea: "St001034",
  ParallelogramPolyominoNormalizedArea: "St001033",
  ParallelogramPolyominoMinimalColumnHeight: "St001038",
  ParallelogramPolyominoMaximalColumnHeight: "St001039",
  ParallelogramPolyominoInnerCorners: "St001036",
  ParallelogramPolyominoUpperInnerCorners: "St001037",
  SetValuedTableauNaturalDescents: "St001955",
  SetValuedTableauComajorIndex: "St001956",
  AdjointInvariantDescents: "St001104",
  DiagonalStandardMonomialDegree: "St001508",
  NoncrossingMergeableSingletonPairs: "St001932",
  NakayamaGlobalDimension: "St000684",
  FirstSimpleProjectiveDimension: "St001135",
  SimpleProjectiveDimensionSum: "St001019",
  SimpleProjectiveDimensionProduct: "St001299",
  SimplesOfMaximalProjectiveDimension: "St001006",
  SimplesOfProjectiveDimensionTwo: "St001011",
  SimplesOfProjectiveDimensionThree: "St001022",
  SimplesOfProjectiveDimensionFour: "St001025",
  SimplesOfProjectiveDimensionAtMostTwo: "St001012",
  SimplesOfProjectiveDimensionAtMostThree: "St001023",
  SimplesOfProjectiveDimensionAtMostFour: "St001190",
  SimplesOfEvenProjectiveDimension: "St001165",
  SimplesOfMaximalEvenProjectiveDimension: "St001493",
  HalfEvenSimpleProjectiveDimensionSum: "St001507",
  FirstSimpleOfMaximalProjectiveDimension: "St001264",
  LastSimpleOfMaximalProjectiveDimension: "St001265",
  PeaksMinusNakayamaGlobalDimension: "St000966",
  InjectiveProjectiveDimensionSum: "St001018",
  InjectivesOfProjectiveDimensionOne: "St001008",
  InjectivesOfProjectiveDimensionAtMostOne: "St001180",
  InjectivesOfProjectiveDimensionAtMostTwo: "St001179",
  InjectivesOfMaximalProjectiveDimension: "St001009",
};
