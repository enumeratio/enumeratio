# @enumeratio/statistics

Combinatorial statistics, maps and probability distributions, each defined once as an
Epsil expression over its carrier rather than hand-written per signature — `FirstDescent`
on a permutation is one definition, evaluated directly. There is no second implementation
to drift from: what runs fast is compiled from the definition itself
(`applyDefinition`/`compiledStatistic`), and a fast native path elsewhere (permutation
statistics in `@enumeratio/combinatorics/collections`) is held to the same definition by a
differential test instead of trusted on its own.

## Usage

```ts
import { ALL_STATISTICS, declareStatistics } from "@enumeratio/statistics";

declareStatistics(ce, ALL_STATISTICS, { domainTypes: CARRIER_TYPES });
```

`declareStatistics` registers a carrier for each definition's subject (`definition.on`)
and the statistic as an operation over it, collecting name collisions
(`StatisticCollisionError`) rather than letting the last one silently win. Narrower sets —
[`PERMUTATION_STATISTICS`](src/permutation.ts), [`PARTITION_STATISTICS`](src/partition.ts),
[`SET_PARTITION_STATISTICS`](src/setpartition.ts), [`DYCK_STATISTICS`](src/dyck.ts) — declare
just one family. `declareDistributions` through `declareDistributions6` and
`declareProcesses` add the probability side.

```
FirstDescent(Permutation([3, 1, 2]))     // 1
FirstDescent([3, 1, 2])                  // 1, a plain list works too
```

## Heads

**Permutation statistics.** [`Inversions`](https://enumeratio.dev/reference/symbol/Inversions),
[`Descents`](https://enumeratio.dev/reference/symbol/Descents),
[`MajorIndex`](https://enumeratio.dev/reference/symbol/MajorIndex),
[`Excedances`](https://enumeratio.dev/reference/symbol/Excedances),
[`LongestIncreasingSubsequence`](https://enumeratio.dev/reference/symbol/LongestIncreasingSubsequence).

**Partitions and set partitions.** [`Crank`](https://enumeratio.dev/reference/symbol/Crank),
[`DurfeeSquare`](https://enumeratio.dev/reference/symbol/DurfeeSquare),
[`Crossings`](https://enumeratio.dev/reference/symbol/Crossings),
[`Nestings`](https://enumeratio.dev/reference/symbol/Nestings),
[`Blocks`](https://enumeratio.dev/reference/symbol/Blocks).

**Lattice-path and tableau statistics.** [`Area`](https://enumeratio.dev/reference/symbol/Area),
[`Bounce`](https://enumeratio.dev/reference/symbol/Bounce),
[`Dinv`](https://enumeratio.dev/reference/symbol/Dinv),
[`HookProduct`](https://enumeratio.dev/reference/symbol/HookProduct),
[`SumOfHookLengths`](https://enumeratio.dev/reference/symbol/SumOfHookLengths).

**Probability.** [`ProbabilityDistribution`](https://enumeratio.dev/reference/symbol/ProbabilityDistribution),
[`Expectation`](https://enumeratio.dev/reference/symbol/Expectation),
[`Moment`](https://enumeratio.dev/reference/symbol/Moment),
[`RandomVariate`](https://enumeratio.dev/reference/symbol/RandomVariate), the named laws
(`BinomialDistribution`-style: `GammaDistribution`, `PoissonProcess`,
`HypergeometricDistribution`, …), and transforms (`MixtureDistribution`,
`TransformedDistribution`, `MarginalDistribution`).

Each statistic's FindStat identifiers, where known, are looked up through
[`findstat`](src/findstat-data.ts) — the same crosswalk `@enumeratio/combinatorics` uses
for its carriers.

## See also

Statistics and distributions here are defined over the carriers
[`combinatorics`](../combinatorics/README.md) declares — permutations,
partitions, set partitions, lattice paths, tableaux. `@enumeratio/combinatorics` is a
devDependency only, to test statistic definitions against real carrier values; declaring
both together in an engine needs no dependency from this package to that one at runtime.
