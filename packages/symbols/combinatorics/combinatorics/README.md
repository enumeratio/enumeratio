# @enumeratio/combinatorics

Combinatorial collections and carriers for `@cortex-js/compute-engine`: permutations,
partitions, set partitions, compositions, words, trees, tableaux, lattice paths and graphs,
each declared as a lazy indexed collection rather than a generated list. `Count` answers by
arithmetic, `At` by unranking — see
[Ranking and unranking](docs/ranking-and-unranking.md) for what that buys you.

Merged wholesale ahead of per-area carving
([wiki](https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible)):
today every area lives under this one package, subpath exports notwithstanding.

## Entry points

`declareCombinatorics(ce)` (`.`, `src/index.ts`) mints the carrier types and declares every
family typed by them, in that order. It does not call `declareCarrierPlurals`,
`declareCarrierElement` or `declareMaps` — each host declares those itself, at its own
position in its own declare order (see the file comment for why).

- **`./collections`** — `declareCollections`, the family library (`allEntries`) and
  `declareStats`; `./collections/src` and `./collections/sampleable` for the source and the
  sampler used by property tests.
- **`carriers.ts`** — `CARRIERS`, `declareCombinatoricsCarriers`, `LEFTOVER_CARRIERS`.
- **`./notation`** — the carrier constructors' StandardForm, `\permutation([2, 3, 1])` both
  ways, and MathLive macros for those commands; a host loads it before it builds an engine.
- **`maps.ts`** — `MAPS`, `declareMaps`, `evaluateDefinition`; `frontier-maps.ts` tracks the
  ones not yet defined (`UNDEFINED_MAPS`).
- **`laws.ts`** — `checkLaws`: cross-checks a map against the algebraic law it claims to
  satisfy.

## Areas

Each subfolder is a carrier area with its own `src/` and tests, still exported through this
package rather than its own:

- **`permutations`** — `SymmetricGroup`, `Arrangements`, cycle and word representations.
- **`partitions`** — `IntegerPartitions` and its restrictions (`SkewPartitions`,
  `CorePartitions`, …).
- **`set-partitions`** — `SetPartitions`, `Multisets`, `PerfectMatchings`,
  `RestrictedGrowthStrings`.
- **`compositions`** — `IntegerCompositions`, `WeakCompositions`, `OrderedFactorizations`.
- **`words`** — `Words`, `BinaryWords`, ascent sequences, endofunctions.
- **`trees`** — `BinaryTrees`, `FullKAryTrees`, `RootedForests`, `PhylogeneticTrees`.
- **`tableaux`** — `SemistandardTableaux`, `PlanePartitions`, `AlternatingSignMatrices`.
- **`lattice-paths`** — `DyckPaths`, `LatticePaths`, Motzkin and Delannoy paths.
- **`graphs`** — `Graph`, `PathGraph`, `CompleteGraph`, `PetersenGraph`.
- **`findstat`** — the FindStat crosswalk (`FindStatHit`) linking a statistic to its OEIS
  entry there.

A representative few, each with its own reference page:
[SymmetricGroup](https://enumeratio.dev/reference/symbol/SymmetricGroup),
[KSubsets](https://enumeratio.dev/reference/symbol/KSubsets),
[IntegerPartitions](https://enumeratio.dev/reference/symbol/IntegerPartitions),
[SetPartitions](https://enumeratio.dev/reference/symbol/SetPartitions),
[DyckPaths](https://enumeratio.dev/reference/symbol/DyckPaths),
[BinaryTrees](https://enumeratio.dev/reference/symbol/BinaryTrees),
[SemistandardTableaux](https://enumeratio.dev/reference/symbol/SemistandardTableaux),
[Graph](https://enumeratio.dev/reference/symbol/Graph).

## Commands

```sh
vp check
vp test
vp pack   # build dist (also: vp pack --watch)
```

## Next

Statistics over these carriers (`MajorIndex`, `Descents`, distributions, …) live in
[@enumeratio/statistics](../statistics/README.md). Carrier and protocol machinery
(`registerCarrier`, `conform`) lives in
[@enumeratio/structures](../../../structures/README.md).
