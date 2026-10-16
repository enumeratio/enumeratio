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

export const DYCK_READINGS: Record<string, (w: Word) => number> = {
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
};

/** The FindStat statistic each reading is held to. */
export const DYCK_FINDSTAT: Record<string, string> = {
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
};
