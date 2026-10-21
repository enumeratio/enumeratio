// Pure data model + logic for the perf-drift history. No I/O here — collect.ts owns reading
// the history file, running vitest, and writing results back; this module is what's under test.

/** One test's duration within a single file, within a single package, within a single run. */
export interface TestDuration {
  file: string;
  name: string;
  durationMs: number;
}

/** One package's vitest run: per-file wall time, per-test durations, and the package total. */
export interface PackageRun {
  wallMs: number;
  files: Record<string, number>;
  tests: TestDuration[];
}

/** One CI run across every package sampled, keyed by commit. */
export interface RunRecord {
  sha: string;
  date: string; // ISO 8601
  /** Machine fingerprint (CPU model, cores, arch, runner image); absent on runs before it was recorded. */
  machine?: string;
  packages: Record<string, PackageRun>;
}

export interface History {
  runs: RunRecord[];
}

export const EMPTY_HISTORY: History = { runs: [] };

export function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Keep only the most recent `maxRuns` runs, oldest first, newest last. */
export function trimHistory(history: History, maxRuns = 60): History {
  return { runs: history.runs.slice(-maxRuns) };
}

export function appendRun(history: History, run: RunRecord, maxRuns = 60): History {
  return trimHistory({ runs: [...history.runs, run] }, maxRuns);
}

/** Every prior duration recorded for this exact (package, file, test), oldest first. */
export function trailingDurations(
  history: History,
  packageName: string,
  file: string,
  testName: string,
  machine?: string,
): number[] {
  const out: number[] = [];
  for (const run of history.runs) {
    if (machine !== undefined && run.machine !== machine) continue;
    const found = run.packages[packageName]?.tests.find((t) => t.file === file && t.name === testName);
    if (found) out.push(found.durationMs);
  }
  return out;
}

export interface DriftOptions {
  /** A test needs at least this many prior runs before drift is even considered. Default 5. */
  minPriorRuns?: number;
  /** Current must be at least this many times the trailing median. Default 1.5. */
  ratioThreshold?: number;
  /** ...and at least this many ms above the trailing median. Default 200. Both must hold —
   *  hosted runners wobble ~2x run to run, so a ratio alone on a 2ms test is noise. */
  absThresholdMs?: number;
  /** Prior runs on the current machine fingerprint needed for a same-runner baseline. Default 3. */
  minSameRunnerRuns?: number;
  /** Judged tests needed to trust the run-wide slowdown factor. Default 10. */
  minTestsForFactor?: number;
}

const DEFAULT_DRIFT_OPTIONS: Required<DriftOptions> = {
  minPriorRuns: 5,
  ratioThreshold: 1.5,
  absThresholdMs: 200,
  minSameRunnerRuns: 3,
  minTestsForFactor: 10,
};

export interface DriftFlag {
  package: string;
  file: string;
  test: string;
  currentMs: number;
  medianMs: number;
  ratio: number;
  absDiffMs: number;
  priorRuns: number;
  /** Baseline: earlier runs on the same machine fingerprint, or on every runner. */
  basis: "same-runner" | "cross-runner";
  /** This run's own median slowdown over all tests (at least 1): the runner, not the code. */
  runnerFactor: number;
}

/**
 * Compare `current` (a fresh run, not yet appended to `priorHistory`) against the trailing
 * median for every test it contains. Returns one flag per test that drifted past both
 * thresholds. `priorHistory` is the history *before* this run — call this before appendRun.
 *
 * A hosted runner of one fingerprint is not one machine, and different fingerprints differ
 * more, so a test is judged against earlier runs on the current fingerprint when it has enough
 * of them, else against every run. Either way the run's own median slowdown over all tests is
 * divided out: if everything is 1.4x slower, that is the runner, not a regression.
 */
export function detectDrift(current: RunRecord, priorHistory: History, options: DriftOptions = {}): DriftFlag[] {
  const opts = { ...DEFAULT_DRIFT_OPTIONS, ...options };
  const sameRuns = priorHistory.runs.filter((r) => current.machine !== undefined && r.machine === current.machine);
  const sameRunner = sameRuns.length >= opts.minSameRunnerRuns;
  const machine = sameRunner ? current.machine : undefined;
  const needed = sameRunner ? opts.minSameRunnerRuns : opts.minPriorRuns;

  // One pass over the baseline runs; per-test lookups against it were quadratic on a big history.
  const durations = new Map<string, number[]>();
  const keyOf = (pkg: string, file: string, name: string): string => JSON.stringify([pkg, file, name]);
  for (const run of priorHistory.runs) {
    if (machine !== undefined && run.machine !== machine) continue;
    for (const [pkg, pkgRun] of Object.entries(run.packages)) {
      for (const t of pkgRun.tests) {
        const k = keyOf(pkg, t.file, t.name);
        const list = durations.get(k);
        if (list === undefined) durations.set(k, [t.durationMs]);
        else list.push(t.durationMs);
      }
    }
  }

  const judged: Array<{ packageName: string; test: TestDuration; medianMs: number; priors: number }> = [];
  for (const [packageName, pkgRun] of Object.entries(current.packages)) {
    for (const test of pkgRun.tests) {
      const priors = durations.get(keyOf(packageName, test.file, test.name)) ?? [];
      if (priors.length < needed) continue;
      judged.push({ packageName, test, medianMs: median(priors), priors: priors.length });
    }
  }
  const runnerFactor =
    judged.length >= opts.minTestsForFactor
      ? Math.max(1, median(judged.map((j) => (j.medianMs > 0 ? j.test.durationMs / j.medianMs : 1))))
      : 1;

  const flags: DriftFlag[] = [];
  for (const { packageName, test, medianMs, priors } of judged) {
    const expectedMs = medianMs * runnerFactor;
    const ratio = expectedMs > 0 ? test.durationMs / expectedMs : Infinity;
    const absDiffMs = test.durationMs - expectedMs;
    if (ratio >= opts.ratioThreshold && absDiffMs >= opts.absThresholdMs) {
      flags.push({
        package: packageName,
        file: test.file,
        test: test.name,
        currentMs: test.durationMs,
        medianMs,
        ratio,
        absDiffMs,
        priorRuns: priors,
        basis: sameRunner ? "same-runner" : "cross-runner",
        runnerFactor,
      });
    }
  }
  // Worst offenders first.
  return flags.toSorted((a, b) => b.ratio - a.ratio);
}

/** The slowest N files in a run, across all packages, by wall time. For the --cpu-prof step. */
export function slowestFiles(run: RunRecord, n = 3): Array<{ package: string; file: string; durationMs: number }> {
  const all: Array<{ package: string; file: string; durationMs: number }> = [];
  for (const [packageName, pkgRun] of Object.entries(run.packages)) {
    for (const [file, durationMs] of Object.entries(pkgRun.files)) {
      all.push({ package: packageName, file, durationMs });
    }
  }
  return all.toSorted((a, b) => b.durationMs - a.durationMs).slice(0, n);
}
