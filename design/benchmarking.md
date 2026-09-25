# Design: benchmarking and profiling

Status: **proposed** (2026-09-25), for sign-off before the bulk of §10 runs.

We want to know how fast enumeratio is, whether it is getting slower, and how it compares with
the systems we already check ourselves against. The oracle lanes compare _answers_. This adds
_timings_ for the same questions, asked the same way, with no translation cost in the numbers.

## 1. What exists

**In the repo**

- **`tools/perf` + `perf.yml`** (#167, on the roadmap since #75). Each night it runs every
  package's vitest suite one at a time and records per-test and per-file durations in
  `history.json` on the orphan `perf-data` branch (last 60 runs). It flags drift against the
  trailing median: at least 5 prior runs, and both ≥1.5× and ≥200 ms. It cpu-profiles the
  three slowest files. This measures _test suites_, not math. It stays as it is.
- **`@enumeratio/aestimatio`**. `evaluateDetailed` returns `ms` per call, but that is wall
  time through a worker, including queue wait and messaging. That's fine for deadlines and too
  coarse for timing. `verificationTest` times in process with `performance.now()`, rounded to
  milliseconds.
- **`@enumeratio/oracle`**. `emit(expr, system)` turns MathJSON into native source for
  wolfram (through `@enumeratio/wolfram`), sympy, mpmath, sage, oscar, julia, mathlib4 and
  rust, from `MAPPINGS`, or names the heads it is missing. `runIn` runs one process per batch
  of 40 with a per-item cap, under the `runBounded` RSS watchdog. That is the translator and
  the process discipline we need; neither times anything today.
- **The quickcheck scripts** (`collections/scripts/quickcheck.ts`,
  `reference/scripts/oracle-quickcheck.ts`). Both use a mulberry32 PRNG with a printed seed,
  so a run replays exactly. `oracle-quickcheck` seeds by date so the nightly jobs draw the
  same samples.
- **The CI shape.** `nightly.yml` runs one job per ecosystem, each on its own runner: Python,
  Julia and Rust daily; Oscar, Mathlib, Sage (Docker) and Wolfram (license) weekly on their
  own days. `quickcheck.yml` and `perf.yml` follow at 04:41 and 04:51 UTC.
- #87 was a perf fix to statistics (read cycles and arc pairs once, shard the suites), with no
  tooling.

**Prior art worth taking from**

| Source                                                                                                             | What we take                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| [asv](https://asv.readthedocs.io) / [sympy_benchmarks][sympy-b]                                                    | benchmarks as plain data plus code, results per commit, the `machine.json` fingerprint fields                                      |
| [Nemo/FLINT benchmarks](https://nemocas.org/benchmarks.html)                                                       | same problem, many systems, one table: det, charpoly, resultant, Fateman, Pearce                                                   |
| [Sage symbench](https://wiki.sagemath.org/symbench), `sage_timeit`                                                 | curated real-world problems; best-of-N **wall** time, because a lot of the work happens in subprocesses (PARI, GAP)                |
| Wolfram `RepeatedTiming`                                                                                           | at least 4 runs, then the mean of the middle two quartiles. So Wolfram itself reports a trimmed central statistic, not the minimum |
| [BenchmarkTools.jl][bt]                                                                                            | evals-per-sample calibration; it leads with the minimum, and its `$`-interpolation idiom exists to defeat constant folding         |
| [pyperf](https://pyperf.readthedocs.io), [criterion.rs][crit]                                                      | calibrate the loop to a minimum sample time, drop warmup, report median ± spread, flag Tukey outliers but keep them                |
| [mitata](https://www.npmjs.com/package/mitata), tinybench                                                          | V8 warmup and dead-code elimination traps on the JS side                                                                           |
| [Johansson's torture tests][torture], the Arb paper                                                                | special-function sweeps across magnitudes and precisions; and a warning about comparing across different hardware                  |
| [Hardy–Ramanujan–Rademacher paper](https://arxiv.org/abs/1205.5991)                                                | a published p(n) comparison of Mathematica, Sage and FLINT: a ready-made cross-system case                                         |
| [CodSpeed](https://codspeed.io/blog/benchmarks-in-ci-without-noise), iai-callgrind, [bencher](https://bencher.dev) | how to live with noisy shared runners: instruction counts, or pinned hardware plus statistical thresholds                          |
| SPEC                                                                                                               | the geometric mean of per-benchmark ratios, which doesn't depend on which system is the reference                                  |

[sympy-b]: https://github.com/sympy/sympy_benchmarks
[bt]: https://juliaci.github.io/BenchmarkTools.jl/stable/manual/
[crit]: https://bheisler.github.io/criterion.rs/book/analysis.html
[torture]: http://fredrik-j.blogspot.com/2009/08/torture-testing-special-functions.html

## 2. Goals

1. A **benchmark catalogue as data**, sharing ids with the reference examples.
2. **Cross-system timings with no translation in them.** Ahead of time, we generate one native
   script per system from the catalogue, through `emit`. Each script times only native
   evaluation.
3. **Apples to apples.** A system's result for a benchmark counts only when it supports the
   benchmark, answers correctly and works at the declared precision. Comparisons use only the
   intersection.
4. **Repeatable.** Seeded inputs, a fixed measurement protocol, robust statistics and a machine
   fingerprint on every report.
5. **A JSON report per run and per system**, stored durably, and a **viewer** in the docs site.
6. **Standard profiling** of our own side: a cpu-profile for any benchmark, on demand and in CI.

Not goals: gating merges (this is advisory, like every other sweep), and instruction-count
benchmarking. Wolfram, Sage and Julia can't run under Cachegrind in any comparable way, and
V8's JIT makes counts for our own side hard to read (§6).

## 3. The catalogue

### Where it lives

A reference example is small by design: `Mod(17, 5)` takes microseconds and would measure
only harness overhead. So benchmarks need their own sizes, but they should share the reference
examples' identity scheme and, where it fits, the examples themselves.

**Proposal:** a benchmark is an example with `role: bench`, in the head's own
`<package>/reference/<Head>.yaml`. The page skips it, like `role: test`. The global name is
`<Head>/<id>`, as for any example (`Factorial/factorial-10-to-the-5`). What that buys:

- one id space and one deep-link scheme (`/reference/symbol/<Head>#example/<id>` opens it in
  review mode's "show hidden");
- **correctness for free.** `entries.test.ts` evaluates it against `expected`, and the oracle
  scans compare every system's answer. A fast wrong answer never counts as a win (§5.4);
- the benchmark sits beside the code it measures, and a lane adding a head can add its
  benchmark in the same file.

A demo or test example can also be timed as it stands by listing its id (§3.3). That covers
the cases where the example already is the right size (`Sin(24^40)`, `HurwitzZeta` grid
points).

Until the migration's step 5 lands (M-4 owns `packages/reference/src/**` and the loader), the
first PRs keep the catalogue in `packages/bench/catalogue/*.yaml`, in exactly the example shape
plus the bench fields. A codemod then moves each case into its head's YAML. **This is the
first sign-off question (§11).**

### The benchmark record

```yaml
- id: factorial-10-to-the-5
  role: bench
  expr: [Mod, [Factorial, 100000], 1000000007]
  expected: 457992974
  bench:
    tags: [combinatorics, big-integer]
    source: GMP
    precision: exact
    budget: 2s
```

| Field             | Meaning                                                                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expr`/`expected` | as for any example. A huge answer is wrapped in a cheap reducer (`IntegerLength`, `Mod[…, p]`, `Total`), so it compares, stores and emits as a small value |
| `bench.tags`      | grouping for the viewer: domain, and `published` when a paper or suite times the same problem                                                              |
| `bench.source`    | where the problem comes from (FLINT, symbench R2, Fateman, Wester, arXiv id), or omitted when it's ours                                                    |
| `bench.precision` | `exact`, `machine`, or a digit count (`50`). A system joins only at that precision (§4.4)                                                                  |
| `bench.budget`    | a soft cap for the whole measurement. Past it we record `timeout` and move on                                                                              |
| `bench.sample`    | seeded inputs (§3.2), instead of a fixed `expr`                                                                                                            |
| `bench.systems`   | optional allow/deny list, for a known-unfair pairing (for example Lean's `#eval`)                                                                          |

The reducer is part of the timed region in every system alike, and it should be negligible
next to the work. A guard case checks this. `Mod[…, p]` with a word-sized prime is the default
reducer, because `MAPPINGS` already covers it everywhere. `IntegerLength`, `Total`/`Sum`,
`Numerator` and `Re`/`Im` have no rows yet. Plan step 3 adds them, with the oracle owners'
agreement.

### Sampled inputs

```yaml
- id: powermod-random-2048-bit
  role: bench
  expr: [PowerMod, $a, $e, $m]
  bench:
    sample: { seed: 20260925, count: 16, draw: { a: [bits, 2048], e: [bits, 2048], m: [odd-bits, 2048] } }
```

- The seed is part of the record. Every run draws the same 16 inputs, in every system, so runs
  are comparable across time and across systems. Changing the seed or `draw` means a new id
  (or bumping `bench.version`), because the benchmark has changed.
- One benchmark is timed as a batch: each sample is one inner iteration, cycled round-robin.
  The report stores per-sample timings of the whole batch, not per input.
- The drawing uses mulberry32, the same generator both quickcheck scripts use. It moves into
  `@enumeratio/utils` rather than being copied a third time. Draws happen at **generation
  time**, and the literal inputs are written into every native script, so no PRNG runs in the
  timed region and no two languages' PRNGs have to agree.
- `expected` for a sampled benchmark is computed by us at generation time and pinned in the
  generated plan. The oracle scans can check it like any hidden example.

**The quickcheck link.** A nightly `bench-quickcheck` mode can draw a _fresh_ date-seeded
sample, the way `oracle-quickcheck` does. Its timings are reported but never trended: they
look for performance cliffs (an input where we are 100× slower than usual), not for drift.
Pinned-seed benchmarks are the trend line. Date-seeded ones are exploration.

## 4. Generators: native scripts, ahead of time

`packages/bench` (new, tooling, sitting beside `oracle`) has one generator per system. It
reads the catalogue, emits each case through `@enumeratio/oracle`'s `emit`, and writes one
self-contained script per system into `packages/bench/generated/`: `bench.wl`, `bench.py`
(mpmath/sympy), `bench.sage.py`, `bench.jl`, `src/bin/bench.rs` in the oracle's crate,
`bench.oscar.jl`, and `bench.ts` for our own side.

The generated scripts are **committed**, like the oracle's goldens. A mappings or catalogue
change then shows up as a script diff in its PR. The run needs no Node on the kernel side,
and anyone can rerun a script by hand (`wolframscript -file bench.wl`). A test checks that
regeneration is a no-op.

### 4.1 The plan

The generator's first output is `plan.json`: for each benchmark, per system, either the
emitted source or a reason it's excluded (`unmapped: [NextPrime]`, `precision`, `denied`).
That is the **support matrix**, recorded before any timing, and the viewer shows it. Adding
mappings to `packages/oracle/src/mappings.ts` widens every system's column at once, for the
oracle scans and the benchmarks alike.

### 4.2 The timed region

Each script wraps every case in a zero-argument function, **compiled once**, and times calls
to it:

| System        | Case form                                                                   | Clock                     | Notes                                                                                                                                                 |
| ------------- | --------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wolfram       | `Hold[<src>]`, parsed when the script loads, released in the loop           | `AbsoluteTiming`          | `ClearSystemCache[]` before each sample (§4.3). wolframscript's kernel can't read our stdin, so the harness connects back to the coordinator over TCP |
| mpmath, SymPy | `def b17(): return <src>`                                                   | `time.perf_counter_ns()`  | `mp.dps` set per case from `precision`; `sympy.core.cache.clear_cache()` before each sample                                                           |
| Sage          | as Python, each source `sage_eval`'d into a lambda once at startup          | `time.perf_counter_ns()`  | wall time, per `sage_timeit`, since PARI and GAP run out of process                                                                                   |
| Julia / Oscar | `b17() = <src>` inside a module                                             | `time_ns()`               | literals hoisted into `const` `Ref`s and read as `r[]` in the body, the BenchmarkTools `$` idiom, so constant propagation can't fold the call         |
| Rust          | `fn b17() -> V { <src> }`, with literals through `black_box`                | `Instant`                 | the `V` adapters (`lib.rs`) are part of the timing; they are thin, but they're the reason tiny cases are excluded (§5.1)                              |
| TypeScript    | `ce.box(json)` once, time `boxed.evaluate()` (`.N()` for numeric precision) | `process.hrtime.bigint()` | engine configured once from `engines.ts`'s `configure`; boxing and canonicalisation are outside the timed region, like parsing is for the others      |

Boxing outside the timed region is our equivalent of the others' parse and compile step.
compute-engine doesn't cache the result of a repeated `evaluate()` on one boxed expression. I
checked this: `Factorial(20000)` takes about 30 ms on every repeat. A case where that breaks
(a head that memoises in module state) is a cache question, covered in §4.3.

Constant folding is real, not hypothetical. On a `gcd` case, Julia timed about 117 ns per
call with the literals inline and about 266 ns with them hoisted into `Ref`s: its effect
analysis had lifted the pure call out of the loop.

### 4.3 Caches

Several systems memoise: Wolfram's system cache, SymPy's `cacheit`, Sage's `cached_function`,
and our own tables (Bernoulli, partitions). The protocol clears whatever the system lets us
clear before each **sample** (§5). Inner iterations inside one sample may hit a cache, and the
report records `caches: cleared | uncleared` per system. The benchmarks that matter take more
than 1 ms per call, so they run one call per sample and never hit a warm cache.

Some answers are stored rather than computed: mpmath and Wolfram answer ζ(3) from a stored
constant in microseconds. The catalogue avoids such points (ζ(3.5), not ζ(3)), and the
`too-fast` floor catches the ones that slip through.

### 4.4 Precision

A double-precision answer is not comparable with a 50-digit one. `bench.precision` decides who
takes part:

- `exact`: integer and rational results. The Rust `num-bigint` adapters, Julia's `BigInt` and
  Nemo, Sage, SymPy, Wolfram and us.
- `machine`: doubles. Rust `statrs`, Julia's `Float64`, mpmath at `dps=15`, Wolfram's `N[x]`
  and us.
- digits `d`: mpmath at `dps=d`, Wolfram's `N[x, d]`, Sage `RealField`/`ComplexField`, Julia
  Nemo `ArbField`, and us with `ce.precision = d`.

Which precision each mapping computes at is a new per-system column in the generator's own
table, not in `MAPPINGS`, because that table is shared with the oracle scans and owned there.

Two traps showed up in the first runs. `N[f[3.5], 30]` is machine precision in Wolfram,
because the input is, so the generator marks decimal inputs with the target precision
(``3.5`30``); a 17-digit double literal is marked machine precision (`` x` ``) instead, or
Wolfram computes it as an arbitrary-precision number. And the inputs to a digit-precision case
have to be exact in both binary and decimal (3.5, 1/2): mpmath reads a float's binary value and
Wolfram its decimal digits.

### 4.5 Correctness gate

Every script also prints each case's (reduced) value once, outside the timed region. The
runner compares it with `expected`: exact answers as text, numeric ones in exact decimal
arithmetic to the case's digits (less two). Never through a double, since at 30 digits a
double would pass an answer that is right to only 16. A disagreeing or erroring system is
recorded as `wrong` or `error` for that case, and it is **not** in the intersection for it.

The gate earns its place straight away: compute-engine's `PolyLog(3, 1/2)` at 30 digits returns
a double, and shows up as `wrong` rather than as a suspiciously fast time. The oracle's shared
Python printer also rounds an mpf to a double, so the harness prints digit-precision mpmath
answers with `nstr` instead.

## 5. Measurement protocol

The same protocol runs in every language. Native tools use different estimators (Wolfram's
trimmed mean, the Julia minimum, criterion's bootstrap), and mixing them would make ratios
meaningless. The harness is about 40 lines per language, generated from one template per
system.

1. **Calibrate.** Time one call. If it takes under 1 ms, double the inner iteration count `k`
   until a sample takes at least 10 ms. Cases whose single call is under 10 µs are dropped from
   cross-system comparison (`too-fast`). At that size we'd be timing call and adapter overhead,
   not math.
2. **Warm up** for 3 samples, or 1 s, whichever comes first, and discard them. This covers the
   JITs (V8, Julia's first-call compilation) and page-ins.
3. **Sample** `n = 15` times, or until the budget runs out, with at least 5 samples. Each
   sample clears caches (§4.3), then times `k` calls. We store per-call ns for every sample.
4. **Summarise**: median, Q1, Q3, IQR, min and max, and the count of Tukey outliers (beyond
   1.5×IQR) — kept, flagged, never dropped.
5. **Interleave** when several systems run on one machine: the runner goes benchmark by
   benchmark, round-robin across systems (TS, Python, Julia, Rust, TS, …), rather than system
   by system. Noise that lasts a few seconds then lands on every system alike, instead of all
   landing on one of them. The price is that every kernel stays resident for the whole run:
   Julia and Oscar take several GB between them. So only CI interleaves (its runner is the
   job's alone); a local run goes one system at a time. The first all-systems local run pushed
   the shared dev machine 18 GB into swap.

**The headline statistic is the median.** Min is reported too. Wolfram's own `RepeatedTiming`
and pyperf both lean central rather than toward the minimum, and on a shared runner the median
is what repeats run to run. **A cross-system summary** is the geometric mean of per-benchmark
median ratios over the intersection, with each benchmark's ratio in the table beside it.

## 6. Where and when it runs

The brief suggests the tail of the nightly and weekly oracle runs, while the kernels are
installed and the caches are warm. I checked this against the research, and it only half
holds:

- **Comparing across jobs is not apples to apples.** Each `nightly.yml` lane is its own job on
  its own runner. Python's timings from one VM compared with Julia's from another mix
  hardware and neighbours. GitHub-hosted runners also vary run to run on their own (CodSpeed
  measures a couple of percent CV at best; `tools/perf` works around about 2× on test suites).
  A ratio is only honest when both sides share one machine and one time window.
- **Within one job, a tail step is fine.** Piggybacking is acceptable for a same-job, relative
  comparison. It isn't for absolute trends.

**Recommendation: one dedicated `bench.yml` job, shaped to reuse what the oracle lanes cache.**

- **Nightly (05:10 UTC, after `perf.yml`):** one runner installs the three light ecosystems
  from the same caches the oracle lanes use (pip cache, `julia-actions/cache`, the cargo
  target) and runs TS, mpmath, SymPy, Julia and Rust **interleaved**. So the caches are warm
  without the job being a tail of five different runners, and every ratio comes from a single
  machine.
- **Weekly: a tail step on each heavy lane** — Sage, Wolfram and Oscar. Their installs are too
  expensive to repeat (Sage in Docker, Wolfram's on-demand license, a multi-GB Oscar), so
  their bench runs as the last step of their existing weekly job. The key is that **our TS
  side runs in that same job too**, interleaved. Every report then carries a same-machine TS
  anchor, and Wolfram-vs-us is honest. Wolfram-vs-Julia is only available through their ratios
  to us, which chains two jobs, and the viewer marks it that way.
- **Trends over time** compare TS runs from the nightly job only, with `tools/perf`'s drift
  rule (≥1.5× and a floor, against the trailing median of at least 5 runs), and file a rolling
  `bench drift` issue labelled `nightly-fixup`. That rule already tolerates hosted-runner
  noise. If it proves too loose, the fix is a stable machine (a self-hosted runner, or Dean's
  Mac on a schedule), not more statistics. Reports carry the fingerprint, so the viewer can
  split series by machine.
- **Locally:** `node packages/bench/scripts/bench.ts` runs any subset on the current machine
  and writes the same report under `.scratch/bench/`. The viewer loads a local report too
  (`?data=`). A local run of the full catalogue takes the `HEAVY` lock, runs one system at a
  time, and won't start with more than 8 GB of swap in use. Every harness runs in its own
  process group under the oracle's RSS watchdog (`ORACLE_MEMORY_MB`).

Instruction counts (Cachegrind or CodSpeed) would steady our own trend line, but V8's JIT under
Valgrind is slow and skewed, and nothing else in the comparison can join. So not now.

## 7. Reports

**One JSON file per system per run**, stored on an orphan **`bench-data`** branch. It's
separate from `perf-data`, so neither workflow's history shape constrains the other:

```
bench-data:
  index.json                          # [{ run, date, sha, trigger, systems: [..], machine }]
  runs/2026-09-26T05-10Z-d764ab0/
    plan.json                         # support matrix + generator version
    ts.json  mpmath.json  sympy.json  julia.json  rust.json
```

```jsonc
{
  "schema": 1,
  "run": { "id": "2026-09-26T05-10Z-d764ab0", "sha": "d764ab0…", "date": "…",
           "trigger": "nightly", "job": "bench", "url": "https://github.com/…/runs/…" },
  "system": { "name": "julia", "version": "1.11.2", "packages": { "Nemo": "0.47.1" },
              "caches": "uncleared" },
  "machine": { "fingerprint": "sha256:…", "os": "Linux 6.8", "arch": "x86_64",
               "cpu": "AMD EPYC 7763", "cores": 4, "memoryGB": 16, "virtualised": true,
               "runner": "ubuntu-24.04 (hosted)", "node": "24.21.0" },
  "protocol": { "version": 1, "warmup": 3, "samples": 15, "minSampleMs": 10, "clock": "time_ns" },
  "results": [
    { "id": "Factorial/factorial-10-to-the-5", "status": "ok",
      "k": 1, "samplesNs": [812345, …],
      "median": 810002, "q1": 805000, "q3": 818000, "min": 799100, "max": 902000,
      "outliers": 1, "value": "457992974" },
    { "id": "NextPrime/nextprime-10-to-the-100", "status": "unsupported",
      "reason": "unmapped: NextPrime" }
  ]
}
```

`status` is one of `ok | unsupported | precision | too-fast | wrong | error | timeout`. The
fingerprint hashes the fields that make a timing comparable (CPU model, cores, arch, OS family,
runner image). The report keeps raw samples, which are small (15 numbers per case), so a later
change of statistic can be recomputed from history. `bench-data` keeps everything; at about
100 KB per night it's years before size matters.

## 8. Viewer

`web/bench/index.md`, with a `BenchViewer.vue`. It is listed from the explore section and
reference, and noindexed until the data is meaningful.

- **Data:** fetched at runtime from
  `raw.githubusercontent.com/enumeratio/enumeratio/bench-data/…`. The repo is public, so a new
  nightly shows up without a site deploy, and previews see the same data. `?report=<url>`
  loads a local or artifact report for dev.
- **Over time:** pick a system and a benchmark (or a tag) and get median with the IQR band,
  per run, split by machine fingerprint, with commit links.
- **Across systems:** pick a run and a set of systems. It computes the intersection (every
  selected system `ok` with the right value), shows per-benchmark ratios to a chosen baseline
  (TS by default), and the geometric mean. Everything outside the intersection is listed with
  its reason rather than hidden. Cross-job pairs (Wolfram vs Julia) are marked as chained.
- **Support matrix:** benchmark × system, from `plan.json`, which is also the to-do list for
  `MAPPINGS`.
- Each benchmark id links to `/reference/symbol/<Head>#example/<id>`.

It's plain Vue plus inline SVG charts, following the dataviz conventions the site already
uses. No chart library.

## 9. Profiling our side

- `vp run bench -- --profile <id>` runs one case under `--cpu-prof` (V8's sampling profiler)
  and writes a `.cpuprofile`, which opens in Chrome DevTools or speedscope.
- In CI, the nightly job profiles the five slowest-relative-to-the-field TS cases (the largest
  ratio against the best system) and any drifted case, and uploads them as a 7-day artifact,
  like `perf.yml`. The drift issue links them.
- `tools/perf` keeps profiling test suites. The two meet in the README, and they share
  `history.ts`'s drift function, moved to `@enumeratio/utils` or imported.

## 10. Plan (small PRs)

1. **This design.**
2. **`packages/bench` skeleton:** catalogue loader and schema, seeded draws (mulberry32 moved to
   `@enumeratio/utils`), protocol and statistics in TS, the TS runner and the report writer, a
   starter catalogue of cases whose heads are mapped for at least two other systems, and
   `vp run bench` locally. It includes a golden JSON test of the statistics and of `plan.json`.
3. **Generators and runners** for mpmath/SymPy, Julia and Rust, with the interleaving
   coordinator, the correctness gate and the committed `generated/` scripts plus their no-op
   regeneration test.
4. **`bench.yml` nightly** and the `bench-data` branch with its index, then the drift issue and
   the profiles artifact.
5. **Viewer** at `web/bench/`.
6. **Weekly lanes:** Wolfram, Sage and Oscar generators, each as a tail step in its
   `nightly.yml` job, with the TS anchor.
7. **Catalogue growth:** the rest of Appendix A, plus the `MAPPINGS` rows it needs. That
   belongs to the oracle's owners, so it's a lane of its own.
8. **After the migration's step 5:** move the catalogue into `role: bench` examples in each
   head's YAML (if §11.1 is agreed).

## 11. For sign-off

1. Benchmarks as `role: bench` examples in each head's YAML, sharing the example id space,
   with `packages/bench/catalogue/` as the interim home (§3).
2. One uniform protocol generated into every language, rather than each system's native timing
   tool. The headline statistic is the median with IQR; the summary is the geometric mean of
   ratios over the intersection (§5).
3. A dedicated nightly `bench.yml` for the light ecosystems, run interleaved on one runner,
   and weekly tail steps with a TS anchor for Sage, Wolfram and Oscar, rather than tail steps
   everywhere (§6).
4. Committed generated scripts (§4).
5. `bench-data` as its own orphan branch, and a viewer that fetches it at runtime (§7, §8).
6. Mathlib is excluded: Lean's `#eval` interprets, so its timings say nothing about Mathlib.

## Appendix A: starter catalogue

Coverage is what `emit` supports today. `W` = Wolfram, `S` = SymPy/mpmath, `G` = Sage,
`J` = Julia (Nemo/Combinatorics), `R` = Rust, `O` = Oscar. A dash means the head is unmapped
there and needs a `MAPPINGS` row (plan step 7). The source column names where a problem is
already timed publicly.

| Benchmark                                                            | Precision    | Mapped today     | Source                      |
| -------------------------------------------------------------------- | ------------ | ---------------- | --------------------------- |
| `Factorial(10^5)`, `Factorial(10^6)` (Mod p)                         | exact        | W S G J R O      | GMP / general               |
| `Fibonacci(10^6)` (Mod p)                                            | exact        | W S G J O        | general                     |
| `Binomial(10^6, 3·10^5)` (Mod p)                                     | exact        | W S G J R O      | general                     |
| `CatalanNumber(10^5)` (Mod p)                                        | exact        | W S G J          | general                     |
| `StirlingS1(1000, 500)` (Mod p)                                      | exact        | W G J            | combinatorics staples       |
| `LucasL(10^6)` (Mod p)                                               | exact        | W S G J          | general                     |
| `BernoulliB(1000)`, `BernoulliB(5000)` (needs `Numerator`)           | exact        | W S G            | FLINT; arXiv:0807.1347      |
| `GCD` of two random 10^4-digit integers (seeded)                     | exact        | W S G J R O      | GMP                         |
| `LCM` of 1..10^4 (Mod p)                                             | exact        | W S G J R O      | general                     |
| `PowerMod` with random 2048-bit arguments (seeded)                   | exact        | G R, W via HEADS | crypto-adjacent             |
| `MoebiusMu` summed over 1..10^5 (needs `Sum` row)                    | exact        | W S G J O        | sieve benches               |
| `Totient` summed over 1..10^5 (needs `Sum` row)                      | exact        | W S G J O        | sieve benches               |
| `PrimePi(10^9)`                                                      | exact        | W S G R          | general                     |
| `Prime(10^6)`                                                        | exact        | W S G R          | general                     |
| `FactorInteger` of a 40-digit semiprime (seeded)                     | exact        | G, W via HEADS   | FLINT applications          |
| `ContinuedFraction(π, 1000)`                                         | exact        | W S G            | Wester-adjacent             |
| `Zeta(1/2 + 1000i)` to 50 digits                                     | 50           | W S G            | Arb / mpmath                |
| `Gamma` at a complex point, 100 digits                               | 100          | W S G            | Arb                         |
| `Gamma` at 10^4 random doubles (seeded)                              | machine      | W S G R          | statrs vs everyone          |
| `PolyLog(3, z)` sweep over \|z\| ∈ 10^[−3, 3] (seeded)               | 30           | W S G            | Arb paper, torture tests    |
| `HurwitzZeta(s, a)` grid (reuses the reference's hidden grid points) | machine / 30 | W S G            | ours (analytic)             |
| `PolyGamma(n, z)` near negative integers                             | 30           | W S G            | ours                        |
| `LerchPhi` continuation points                                       | 30           | W S              | ours (#178)                 |
| `Sin(24^40)`, `Cos(10^100)` exact argument reduction                 | machine      | W S G R          | ours (#176)                 |
| `Power` / `Mod` of big integers                                      | exact        | all              | guard cases for the reducer |

Unmapped today, worth the `MAPPINGS` rows: `PartitionsP(10^5, 10^6)` (arXiv:1205.5991's
Mathematica/Sage/FLINT table), `NextPrime(10^100)`, `StirlingS2`, `BellB`, `EulerPhi`,
`HarmonicNumber(10^6)`, `BarnesG`, `DirichletL`, `StieltjesGamma`, `Hypergeometric2F1`,
`BesselJ`, `Determinant` and `CharacteristicPolynomial` of integer matrices (Nemo),
`HermiteDecomposition` (Nemo HNF), `Expand((1+x+y+z)^20)` (Fateman), resultants and
polynomial GCD (Nemo/Pearce), symbench R2 (Hermite recurrence) and S4 (a 1000-term series),
and, as A-34/A-35 land, `Accumulate`/`Array` and `GeneratingFunction`/`FindSequenceFunction`.
