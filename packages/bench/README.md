# bench

Cross-system benchmarks; the design is `design/benchmarking.md`.

- `catalogue/*.yaml`: cases in the example shape plus a `bench` block, keyed by head. This is
  their interim home; they move into each head's `reference/<Head>.yaml` as `role: bench`
  examples later.
- `buildPlan` emits every case for every system through `@enumeratio/oracle`'s `emit`, or
  records why a system sits it out: the support matrix.
- Each system runs as one long-lived harness speaking a line protocol (a case index in,
  `<<i>>{json}` out). The coordinator feeds cases round-robin across systems, applies the
  correctness gate, and summarises every system's samples with the same statistics.

```sh
node packages/bench/scripts/bench.ts --only Factorial --systems ts --out .scratch/bench
node packages/bench/scripts/bench.ts --plan   # support matrix only
```

It needs the package dists (`pnpm -r --filter "./packages/**" run build`). A full local run
is a heavy job: take the `lanes/HEAVY` lock.
