# @enumeratio/oracle

Cross-check the reference catalogue against external systems: signature-level mappings
(discriminated by arity, not name — `Zeta` means different things at one and two arguments
across systems), emitters, batch runners under a memory watchdog, and comparison by value or
by structural reduction. [`reference`](../reference/README.md)'s `oracle-scan.ts` is the driver; this
package is the plumbing it drives. Depends on [`wolfram`](../wolfram/README.md) for the transpiler its
emitter reuses.

## Entry points

- **`.` (`src/index.ts`)** — `MAPPINGS`/`mappingFor`/`mappedHeads` (the head → system
  mapping table), `emit`/`Emitted`/`unmappedHeads` (MathJSON → source for one system, or a
  specific reason it can't be), `SYSTEMS`/`System`/`wiredSystems` (which systems exist and
  how far each is wired), `runIn`/`preludeFor`/`juliaFlags` (batch evaluation), `compare` and
  friends (text-level agreement, with a structural fallback for Python), `compareTrees`/
  `reduce` (MathJSON-by-value comparison, engine-free so it tests on plain trees),
  `interpretSymbolicAgreement` (does a symbolic difference vanish, for `wolfram`/`sympy`/
  `sage`), `DIVERGENCE_KINDS`/`Divergence` (the classification an unresolved disagreement
  needs before a scan can pass).
- **`runBounded`/`runKernel`** — re-exported from `@enumeratio/utils/bounded`, where the memory watchdog lives so libraries' golden scripts can use it without an edge to oracle.
- **`julia/`, `oscar/`, `lean/`, `python/`, `rust/`** — each wired system's project files
  (`Project.toml`/`Manifest.toml`, `lakefile.toml`, `requirements.txt`, `Cargo.toml`) and, for
  Rust, the batch-runner source. `kernels.json` pins the release (version and build date) a scan
  ran against, for a report's provenance. A pin compares the release only: `kernel-pin.ts`
  splits a kernel's version into that release and the platform, which is printed, not compared.

## Commands

```sh
vp check
vp test
vp pack                                    # build dist (also: vp pack --watch)

node packages/oracle/scripts/setup.ts            # install every kernel (julia, oscar, rust, mathlib4)
node packages/oracle/scripts/setup.ts julia      # just one
```

Installs are the heaviest thing the oracles do (Oscar precompiles dozens of packages,
mathlib's cache unpacks gigabytes) and never run in parallel — see `utils/src/bounded.ts` and
`ORACLE_MEMORY_MB` for the watchdog's ceiling.

Running an actual scan is [`reference`](../reference/README.md)'s `scripts/oracle-scan.ts`, not anything
here.

## Next

AGENTS.md "CI and deployment" covers where the nightly oracle sweeps sit relative to the
required gate — they never block a merge, only file `nightly-fixup` issues.
