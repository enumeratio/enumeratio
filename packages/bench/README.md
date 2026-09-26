# @enumeratio/bench

Cross-system benchmarks; the design is `design/benchmarking.md`.

- `catalogue/*.yaml`: cases in the example shape plus a `bench` block, keyed by head. This is
  their interim home; they move into each head's `reference/<Head>.yaml` as `role: bench`
  examples later.
- `buildPlan` emits every case for every system through `@enumeratio/oracle`'s `emit`, or
  records why a system sits it out: the support matrix.
- Each system runs as one long-lived harness speaking a line protocol (a case name in,
  `<<name>>{json}` out; Wolfram over TCP, since wolframscript's kernel can't read stdin). The
  coordinator feeds cases round-robin across systems, applies the correctness gate, and
  summarises every system's samples with the same statistics.
- `generated/<system>/`: each system's harness, generated from the catalogue and committed
  (`node packages/bench/scripts/generate.ts`; a test fails when it's stale).

```sh
node packages/bench/scripts/bench.ts --only Factorial --systems ts,julia --out .scratch/bench
node packages/bench/scripts/bench.ts --plan   # support matrix only
node packages/bench/scripts/profile.ts Factorial/factorial-10-to-the-5 --out .scratch/profiles
```

Each run writes `plan.json` (every case's MathJSON, its seed and draw, and the concrete inputs
every system ran) and one report per system, with the machine and its load at the start and
end of the run.

Wolfram without an on-demand license runs here and publishes as its own job:

```sh
node packages/bench/scripts/bench.ts --systems ts,wolfram --out .scratch/bench
node packages/bench/scripts/publish-local.ts .scratch/bench/<run> --job wolfram-local
```

CI: `bench.yml` runs the light systems nightly on one runner, and the Sage, Wolfram and Oscar
lanes in `nightly.yml` run their system beside ours weekly. Both publish through
`.github/actions/bench-run` to the `bench-data` branch (`scripts/publish.ts`), which the
site's `/bench/` page reads.

It needs the package dists (`pnpm -r --filter "./packages/**" run build`). A full local run
is a heavy job: take the `lanes/HEAVY` lock.
