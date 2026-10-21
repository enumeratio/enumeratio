// The `bench-data` branch (https://github.com/enumeratio/enumeratio/wiki/Benchmarking §7): each run's files under `runs/<id>/`,
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
  /** Current over trailing, after dividing out `runnerFactor`. */
  readonly ratio: number;
  readonly priorRuns: number;
  /** Whether the baseline was runs on the same machine fingerprint, or every runner. */
  readonly basis: "same-runner" | "cross-runner";
  /** This run's own median slowdown over all cases (at least 1): the runner, not the code. */
  readonly runnerFactor: number;
}

export interface DriftOptions {
  /** Current over trailing median, at least. */
  readonly ratio: number;
  /** And slower by at least this much, in ns. */
  readonly floorNs: number;
  /** Prior runs needed before a case is judged at all (cross-runner baseline). */
  readonly minRuns: number;
  /** Same, when the baseline is runs on the current machine fingerprint. */
  readonly minSameRunnerRuns: number;
  /** How far back the trailing median looks. */
  readonly window: number;
  /** Cases needed to trust the run-wide slowdown factor. */
  readonly minCasesForFactor: number;
}

/** Hosted runners wobble, so both a ratio and an absolute floor must be crossed, as in tools/perf. */
export const DRIFT: DriftOptions = {
  ratio: 1.5,
  floorNs: 1e6,
  minRuns: 5,
  minSameRunnerRuns: 3,
  window: 20,
  minCasesForFactor: 5,
};

const median = (xs: readonly number[]): number =>
  quantile(
    [...xs].toSorted((a, b) => a - b),
    0.5,
  );

/**
 * Cases in `current` that got slower than the trailing median of the same system's earlier
 * reports, `prior` oldest first. Only `ok` results count on either side, and only a result
 * of the same formula: an earlier run of a case that has since changed is another benchmark.
 *
 * Hosted runners of one fingerprint are not one machine (a case has measured 1.3 ms one night
 * and 3.9 ms the next), so a case is judged against earlier runs on the current fingerprint when
 * there are enough of them, else against all runs. Either way the run's own median slowdown over
 * every case is divided out: if everything is 1.4x slower, that is the runner.
 */
export function detectDrift(current: Report, prior: readonly Report[], options: DriftOptions = DRIFT): Drift[] {
  const key = (r: CaseResult): string => `${r.name}#${r.formula ?? ""}`;
  const fingerprint = current.machine?.fingerprint;
  const same = prior.filter((r) => fingerprint !== undefined && r.machine?.fingerprint === fingerprint);
  const sameRunner = same.length >= options.minSameRunnerRuns;
  const pool = sameRunner ? same : prior;
  const needed = sameRunner ? options.minSameRunnerRuns : options.minRuns;
  const history = new Map<string, number[]>();
  for (const report of pool.slice(-options.window)) {
    for (const r of report.results) {
      if (r.status === "ok" && r.median !== undefined) {
        history.set(key(r), [...(history.get(key(r)) ?? []), r.median]);
      }
    }
  }
  const judged: { r: CaseResult & { median: number }; trailingNs: number; priorRuns: number }[] = [];
  for (const r of current.results as CaseResult[]) {
    const past = history.get(key(r));
    if (r.status !== "ok" || r.median === undefined || past === undefined || past.length < needed) continue;
    judged.push({ r: r as CaseResult & { median: number }, trailingNs: median(past), priorRuns: past.length });
  }
  const runnerFactor =
    judged.length >= options.minCasesForFactor ? Math.max(1, median(judged.map((j) => j.r.median / j.trailingNs))) : 1;
  const drifted: Drift[] = [];
  for (const { r, trailingNs, priorRuns } of judged) {
    const expected = trailingNs * runnerFactor;
    const ratio = r.median / expected;
    if (ratio >= options.ratio && r.median - expected >= options.floorNs) {
      drifted.push({
        name: r.name,
        medianNs: r.median,
        trailingNs,
        ratio,
        priorRuns,
        basis: sameRunner ? "same-runner" : "cross-runner",
        runnerFactor,
      });
    }
  }
  return drifted.toSorted((a, b) => b.ratio - a.ratio);
}
