# perf

Advisory perf-drift tooling for `.github/workflows/perf.yml` (design/roadmap.md's "profiler job
in CI"). Runs each `packages/*` suite through vitest's JSON reporter, one package at a time so
they don't contend for the same runner cores, and records per-test/per-file durations plus
package wall time.

## Where the history lives

There's no server: history is a JSON file (`{ runs: RunRecord[] }`) on a dedicated orphan branch,
`perf-data`, at `history.json`. The nightly workflow fetches it, appends the run, trims to the
last 60, and pushes it back — durable, and inspectable with:

```sh
git show origin/perf-data:history.json | jq '.runs[-1]'
```

A data branch beats Actions cache/artifacts here: cache entries evict under storage pressure and
artifacts expire, but a branch is a normal git object nothing sweeps, and `git log perf-data` is
a free audit trail of every run appended.

## Reading the history

Each `RunRecord` is `{ sha, date, packages: { [pkgName]: PackageRun } }`, and each `PackageRun` is
`{ wallMs, files: { [path]: durationMs }, tests: [{ file, name, durationMs }] }` — see
`src/history.ts` for the exact shapes. `wallMs` sums the file durations vitest reports (not a
wall-clock measurement of the whole `pnpm` invocation), so it's a rough package-level trend line,
not a stopwatch reading.

## Drift detection

For each test with at least 5 prior runs in history, `detectDrift` (`src/history.ts`) compares its
current duration to the **trailing median** of its prior durations, and flags it only when
**both**:

- current ≥ 1.5× the median, **and**
- current ≥ median + 200ms

Hosted runners vary roughly 2x run to run, so a ratio or an absolute jump alone is noise — the
same reasoning `quickcheck.yml` uses. Both thresholds are the second and third parameters to
`detectDrift`'s `options` argument if they ever need tuning.

## What the workflow does, end to end

1. `src/collect.ts` — discovers every `packages/*` with a `test` script, runs
   `pnpm --filter <pkg> exec vp test --reporter=json --outputFile=…` for each (sequentially),
   converts the report to a `PackageRun` (`src/vitest-report.ts`), diffs it against history for
   drift, appends+trims the run, and writes `history.json`, `drift-report.json` and
   `slowest-files.json` under `tools/perf/.data/` (gitignored — scratch for the workflow run).
2. `src/cpu-prof.ts` — re-runs the 3 slowest files from `slowest-files.json` under
   `NODE_OPTIONS=--cpu-prof`, uploaded as a 7-day workflow artifact.
3. The workflow pushes the updated `history.json` to `perf-data`, then files/reopens (or closes)
   the rolling **"perf drift"** issue (label `nightly-fixup`), the same pattern
   `quickcheck.yml` uses for its rolling issue.

Never a required check — a drift is a lead to look at the trend in `perf-data`, not a gate.

## Running it locally

```sh
node tools/perf/src/collect.ts --packages boxed,utils --history /tmp/history.json
node tools/perf/src/cpu-prof.ts --slowest tools/perf/.data/slowest-files.json --out-dir /tmp/profiles
```

`--packages` restricts collection to specific package directory names (default: every
`packages/*` with a `test` script). `--dry-run` prints what would be collected without running
any suites.
