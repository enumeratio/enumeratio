// The `bench-data` branch (design/benchmarking.md §7): each run's files under `runs/<id>/`,
// with `run.json` describing it, and `index.json` rebuilt from those, so two jobs publishing
// at once only ever conflict on files they both derive.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { quantile } from "./stats.ts";
import type { BenchIndex, CaseResult, Report } from "./types.ts";

export type RunMeta = BenchIndex["runs"][number];

export function buildIndex(dataDir: string): BenchIndex {
  const runsDir = join(dataDir, "runs");
  const runs = existsSync(runsDir)
    ? readdirSync(runsDir)
        .filter((id) => existsSync(join(runsDir, id, "run.json")))
        .map((id) => JSON.parse(readFileSync(join(runsDir, id, "run.json"), "utf8")) as RunMeta)
    : [];
  runs.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return { schema: 1, runs };
}

export interface Drift {
  readonly name: string;
  readonly medianNs: number;
  readonly trailingNs: number;
  readonly ratio: number;
  readonly priorRuns: number;
}

export interface DriftOptions {
  /** Current over trailing median, at least. */
  readonly ratio: number;
  /** And slower by at least this much, in ns. */
  readonly floorNs: number;
  /** Prior runs needed before a case is judged at all. */
  readonly minRuns: number;
  /** How far back the trailing median looks. */
  readonly window: number;
}

/** Hosted runners wobble, so both a ratio and an absolute floor must be crossed, as in tools/perf. */
export const DRIFT: DriftOptions = { ratio: 1.5, floorNs: 1e6, minRuns: 5, window: 20 };

/**
 * Cases in `current` that got slower than the trailing median of the same system's earlier
 * reports, `prior` oldest first. Only `ok` results count on either side.
 */
export function detectDrift(current: Report, prior: readonly Report[], options: DriftOptions = DRIFT): Drift[] {
  const history = new Map<string, number[]>();
  for (const report of prior.slice(-options.window)) {
    for (const r of report.results) {
      if (r.status === "ok" && r.median !== undefined) {
        history.set(r.name, [...(history.get(r.name) ?? []), r.median]);
      }
    }
  }
  const drifted: Drift[] = [];
  for (const r of current.results as CaseResult[]) {
    const past = history.get(r.name);
    if (r.status !== "ok" || r.median === undefined || past === undefined) continue;
    if (past.length < options.minRuns) continue;
    const trailingNs = quantile(
      [...past].sort((a, b) => a - b),
      0.5,
    );
    const ratio = r.median / trailingNs;
    if (ratio >= options.ratio && r.median - trailingNs >= options.floorNs) {
      drifted.push({ name: r.name, medianNs: r.median, trailingNs, ratio, priorRuns: past.length });
    }
  }
  return drifted.sort((a, b) => b.ratio - a.ratio);
}
