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
  packages: Record<string, PackageRun>;
}

export interface History {
  runs: RunRecord[];
}

export const EMPTY_HISTORY: History = { runs: [] };

export function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
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
export function trailingDurations(history: History, packageName: string, file: string, testName: string): number[] {
  const out: number[] = [];
  for (const run of history.runs) {
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
}

const DEFAULT_DRIFT_OPTIONS: Required<DriftOptions> = {
  minPriorRuns: 5,
  ratioThreshold: 1.5,
  absThresholdMs: 200,
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
}

/**
 * Compare `current` (a fresh run, not yet appended to `priorHistory`) against the trailing
 * median for every test it contains. Returns one flag per test that drifted past both
 * thresholds. `priorHistory` is the history *before* this run — call this before appendRun.
 */
export function detectDrift(current: RunRecord, priorHistory: History, options: DriftOptions = {}): DriftFlag[] {
  const opts = { ...DEFAULT_DRIFT_OPTIONS, ...options };
  const flags: DriftFlag[] = [];
  for (const [packageName, pkgRun] of Object.entries(current.packages)) {
    for (const test of pkgRun.tests) {
      const priors = trailingDurations(priorHistory, packageName, test.file, test.name);
      if (priors.length < opts.minPriorRuns) continue;
      const medianMs = median(priors);
      const ratio = medianMs > 0 ? test.durationMs / medianMs : Infinity;
      const absDiffMs = test.durationMs - medianMs;
      if (ratio >= opts.ratioThreshold && absDiffMs >= opts.absThresholdMs) {
        flags.push({
          package: packageName,
          file: test.file,
          test: test.name,
          currentMs: test.durationMs,
          medianMs,
          ratio,
          absDiffMs,
          priorRuns: priors.length,
        });
      }
    }
  }
  // Worst offenders first.
  return flags.sort((a, b) => b.ratio - a.ratio);
}

/** The slowest N files in a run, across all packages, by wall time. For the --cpu-prof step. */
export function slowestFiles(run: RunRecord, n = 3): Array<{ package: string; file: string; durationMs: number }> {
  const all: Array<{ package: string; file: string; durationMs: number }> = [];
  for (const [packageName, pkgRun] of Object.entries(run.packages)) {
    for (const [file, durationMs] of Object.entries(pkgRun.files)) {
      all.push({ package: packageName, file, durationMs });
    }
  }
  return all.sort((a, b) => b.durationMs - a.durationMs).slice(0, n);
}
