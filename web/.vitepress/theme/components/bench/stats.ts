// Pure helpers for the bench viewer: unit formatting, geometric means, cross-job ratio
// chaining, and the ok-intersection across selected systems (design/benchmarking.md §8).
import type { BenchSystem, CaseResult, IndexRun, Status } from "./types.ts";

/** Auto-scaled duration: picks ns/µs/ms/s so the number stays in a readable range. */
export function formatNs(ns: number): string {
  const units: readonly [string, number][] = [
    ["ns", 1],
    ["µs", 1e3],
    ["ms", 1e6],
    ["s", 1e9],
  ];
  let unit = units[0];
  for (const u of units) if (ns >= u[1]) unit = u;
  const value = ns / unit[1];
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${unit[0]}`;
}

/** Ratio as `1.00×` (or `×`/`÷` text alongside colour, never colour alone). */
export function formatRatio(ratio: number): string {
  return ratio >= 1 ? `${ratio.toFixed(2)}×` : `÷${(1 / ratio).toFixed(2)}`;
}

/** Geometric mean of positive numbers; NaN for an empty input (caller decides how to show it). */
export function geomean(xs: readonly number[]): number {
  if (xs.length === 0) return Number.NaN;
  const sumLog = xs.reduce((s, x) => s + Math.log(x), 0);
  return Math.exp(sumLog / xs.length);
}

/** A lookup by case name for one system's results within a run. */
export function byName(results: readonly CaseResult[]): ReadonlyMap<string, CaseResult> {
  return new Map(results.map((r) => [r.name, r]));
}

/**
 * Case names where every given system is `status: "ok"` in its own result map.
 * Order follows `allNames` (typically the baseline's case order).
 */
export function okIntersection(
  allNames: readonly string[],
  bySystem: ReadonlyMap<BenchSystem, ReadonlyMap<string, CaseResult>>,
  systems: readonly BenchSystem[],
): string[] {
  return allNames.filter((name) => systems.every((sys) => bySystem.get(sys)?.get(name)?.status === "ok"));
}

/** Direct ratio: `system`'s median over `baseline`'s median, same run. */
export function directRatio(systemMedian: number, baselineMedian: number): number {
  return systemMedian / baselineMedian;
}

/**
 * Cross-job ratio, chained through each run's own TS anchor: each side is first taken
 * relative to TS on its own machine, so the machines cancel. With TS as the baseline the
 * second factor is 1 and this is just the system's ratio to TS in its own run.
 */
export function chainedRatio(
  systemMedian: number,
  tsMedianOwnRun: number,
  baselineMedian: number,
  tsMedianBaselineRun: number,
): number {
  return systemMedian / tsMedianOwnRun / (baselineMedian / tsMedianBaselineRun);
}

/** Status shown for a cell that isn't in the ok-intersection: reason text for a tooltip. */
export function statusReason(status: Status, reason?: string): string {
  return reason ? `${status}: ${reason}` : status;
}

/** Distinct jobs among a set of index runs, keyed by run id. */
export function jobOf(runs: readonly IndexRun[], runId: string): string | undefined {
  return runs.find((r) => r.id === runId)?.job;
}

/**
 * Normalises a series to its own first value (geometric-mean style tag averaging):
 * each entry divided by the first ok entry, so multiple benchmarks with different absolute
 * scales can be averaged together.
 */
export function normaliseToFirst(xs: readonly number[]): number[] {
  const first = xs.find((x) => Number.isFinite(x) && x > 0);
  if (first === undefined) return xs.map(() => Number.NaN);
  return xs.map((x) => x / first);
}

/** "Nice" log-scale tick values spanning [lo, hi] (powers of 10, plus 2/5 steps if it's tight). */
export function logTicks(lo: number, hi: number): number[] {
  if (!(lo > 0) || !(hi > 0) || lo >= hi) return [...new Set([lo, hi].filter((x) => x > 0))];
  const lo10 = Math.floor(Math.log10(lo));
  const hi10 = Math.ceil(Math.log10(hi));
  const ticks: number[] = [];
  for (let e = lo10; e <= hi10; e++) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** e;
      if (v >= lo * 0.999 && v <= hi * 1.001) ticks.push(v);
    }
  }
  return ticks.length > 1 ? ticks : [lo, hi];
}
