// Summary statistics every runner's samples go through, in one place, so a statistic means
// the same thing for every system (design/benchmarking.md §5).

import type { Summary } from "./types.ts";

/** Quantile by linear interpolation between order statistics (Hyndman–Fan type 7, R's default). */
export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  const at = (sorted.length - 1) * q;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (b - a) * (at - lo);
}

export function summarise(samples: readonly number[]): Summary {
  const sorted = [...samples].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const fence = 1.5 * (q3 - q1);
  return {
    median: quantile(sorted, 0.5),
    q1,
    q3,
    min: sorted[0] ?? Number.NaN,
    max: sorted.at(-1) ?? Number.NaN,
    outliers: sorted.filter((x) => x < q1 - fence || x > q3 + fence).length,
  };
}

/** Geometric mean: the cross-system summary of per-benchmark ratios, independent of the baseline. */
export function geomean(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  return Math.exp(values.reduce((sum, v) => sum + Math.log(v), 0) / values.length);
}
