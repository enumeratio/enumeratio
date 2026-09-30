# @enumeratio/statistics

Probability distributions and random processes, each defined once as an Epsil expression:
the named laws, the functions over them (`PDF`, `CDF`, `Expectation`, `Moment`, …) and
sampling (`RandomVariate`).

## Usage

```ts
import { declareDistributions, declareProcesses } from "@enumeratio/statistics";

declareDistributions(ce);
declareProcesses(ce);
```

`declareDistributions` through `declareDistributions6` add the laws in batches;
`declareProcesses` adds the random processes.

```
Mean(BinomialDistribution(10, 1/2))      // 5
CDF(ExponentialDistribution(2), 1)       // 1 - e^-2
```

## Heads

**Distributions.** [`ProbabilityDistribution`](https://enumeratio.dev/reference/symbol/ProbabilityDistribution),
the named laws (`BinomialDistribution`, `GammaDistribution`, `HypergeometricDistribution`,
`WeibullDistribution`, …), and transforms (`MixtureDistribution`, `TransformedDistribution`,
`MarginalDistribution`).

**Functions of a distribution.** [`Expectation`](https://enumeratio.dev/reference/symbol/Expectation),
[`Probability`](https://enumeratio.dev/reference/symbol/Probability),
[`Moment`](https://enumeratio.dev/reference/symbol/Moment), `Cumulant`,
`CharacteristicFunction`, `MomentGeneratingFunction`,
[`RandomVariate`](https://enumeratio.dev/reference/symbol/RandomVariate).

**Processes.** `PoissonProcess`, `WienerProcess`, …

## See also

The combinatorial statistics (`Inversions`, `MajorIndex`, `Area`, …) and the maps between
carriers are [`combinatorics`](../combinatorics/README.md)'.
