// GENERATED from YAML by packages/reference/scripts/migrate/shims.ts -- do not edit.
// Edit the YAML named in `sources`, then run `node packages/reference/scripts/migrate/shims.ts`.

import type { ReferenceEntry } from "@enumeratio/entry";

/** The YAML each entry below was generated from, in the same order. */
export const sources: readonly string[] = [
  "packages/symbols/combinatorics/statistics/reference/Descents.yaml",
  "packages/symbols/combinatorics/statistics/reference/Ascents.yaml",
  "packages/symbols/combinatorics/statistics/reference/MajorIndex.yaml",
  "packages/symbols/combinatorics/statistics/reference/MinorIndex.yaml",
  "packages/symbols/combinatorics/statistics/reference/Inversions.yaml",
  "packages/symbols/combinatorics/statistics/reference/FixedPoints.yaml",
  "packages/symbols/combinatorics/statistics/reference/Excedances.yaml",
  "packages/symbols/combinatorics/statistics/reference/WeakExceedances.yaml",
  "packages/symbols/combinatorics/statistics/reference/Antiexcedances.yaml",
  "packages/symbols/combinatorics/statistics/reference/Denert.yaml",
  "packages/symbols/combinatorics/statistics/reference/Peaks.yaml",
  "packages/symbols/combinatorics/statistics/reference/Valleys.yaml",
  "packages/symbols/combinatorics/statistics/reference/LeftToRightMaxima.yaml",
  "packages/symbols/combinatorics/statistics/reference/LeftToRightMinima.yaml",
  "packages/symbols/combinatorics/statistics/reference/RightToLeftMaxima.yaml",
  "packages/symbols/combinatorics/statistics/reference/RightToLeftMinima.yaml",
  "packages/symbols/combinatorics/statistics/reference/FirstDescent.yaml",
  "packages/symbols/combinatorics/statistics/reference/LastDescent.yaml",
  "packages/symbols/combinatorics/statistics/reference/Runs.yaml",
  "packages/symbols/combinatorics/statistics/reference/Depth.yaml",
  "packages/symbols/combinatorics/statistics/reference/CyclicDescents.yaml",
  "packages/symbols/combinatorics/statistics/reference/OccurrencesOf123.yaml",
  "packages/symbols/combinatorics/statistics/reference/OccurrencesOf132.yaml",
  "packages/symbols/combinatorics/statistics/reference/OccurrencesOf213.yaml",
  "packages/symbols/combinatorics/statistics/reference/StackSortable.yaml",
  "packages/symbols/combinatorics/statistics/reference/LongestRun.yaml",
  "packages/symbols/combinatorics/statistics/reference/LargestRunLength.yaml",
  "packages/symbols/combinatorics/statistics/reference/CycleCount.yaml",
  "packages/symbols/combinatorics/statistics/reference/ReflectionLength.yaml",
  "packages/symbols/combinatorics/statistics/reference/LargestCycleLength.yaml",
  "packages/symbols/combinatorics/statistics/reference/LongestCycleLength.yaml",
  "packages/symbols/combinatorics/statistics/reference/DistinctCycleLengths.yaml",
  "packages/symbols/combinatorics/statistics/reference/TwoCycleCount.yaml",
  "packages/symbols/combinatorics/statistics/reference/ThreeCycleCount.yaml",
  "packages/symbols/combinatorics/statistics/reference/Order.yaml",
  "packages/symbols/combinatorics/statistics/reference/LongestIncreasingSubsequence.yaml",
  "packages/symbols/combinatorics/statistics/reference/LongestDecreasingSubsequence.yaml",
  "packages/symbols/combinatorics/statistics/reference/LargestPart.yaml",
  "packages/symbols/combinatorics/statistics/reference/MultiplicityOfLargestPart.yaml",
  "packages/symbols/combinatorics/statistics/reference/DistinctParts.yaml",
  "packages/symbols/combinatorics/statistics/reference/EvenParts.yaml",
  "packages/symbols/combinatorics/statistics/reference/OddParts.yaml",
  "packages/symbols/combinatorics/statistics/reference/PartsEqualOne.yaml",
  "packages/symbols/combinatorics/statistics/reference/PartsAtLeastTwo.yaml",
  "packages/symbols/combinatorics/statistics/reference/ConjugateOddParts.yaml",
  "packages/symbols/combinatorics/statistics/reference/ConjugateDistinctParts.yaml",
  "packages/symbols/combinatorics/statistics/reference/DurfeeSquare.yaml",
  "packages/symbols/combinatorics/statistics/reference/ArmOfFirstCell.yaml",
  "packages/symbols/combinatorics/statistics/reference/LegOfFirstCell.yaml",
  "packages/symbols/combinatorics/statistics/reference/Corners.yaml",
  "packages/symbols/combinatorics/statistics/reference/Perimeter.yaml",
  "packages/symbols/combinatorics/statistics/reference/IsSelfConjugate.yaml",
  "packages/symbols/combinatorics/statistics/reference/SumOfHookLengths.yaml",
  "packages/symbols/combinatorics/statistics/reference/HookProduct.yaml",
  "packages/symbols/combinatorics/statistics/reference/DysonRank.yaml",
  "packages/symbols/combinatorics/statistics/reference/Crank.yaml",
  "packages/symbols/combinatorics/statistics/reference/Height.yaml",
  "packages/symbols/combinatorics/statistics/reference/DoubleRises.yaml",
  "packages/symbols/combinatorics/statistics/reference/Returns.yaml",
  "packages/symbols/combinatorics/statistics/reference/TouchPointCount.yaml",
  "packages/symbols/combinatorics/statistics/reference/InteriorReturns.yaml",
  "packages/symbols/combinatorics/statistics/reference/Hills.yaml",
  "packages/symbols/combinatorics/statistics/reference/InitialRise.yaml",
  "packages/symbols/combinatorics/statistics/reference/Area.yaml",
  "packages/symbols/combinatorics/statistics/reference/Coarea.yaml",
  "packages/symbols/combinatorics/statistics/reference/LongestAscent.yaml",
  "packages/symbols/combinatorics/statistics/reference/LongestDescent.yaml",
  "packages/symbols/combinatorics/statistics/reference/Dinv.yaml",
  "packages/symbols/combinatorics/statistics/reference/Bounce.yaml",
  "packages/symbols/combinatorics/statistics/reference/Blocks.yaml",
  "packages/symbols/combinatorics/statistics/reference/LargestBlock.yaml",
  "packages/symbols/combinatorics/statistics/reference/SmallestBlock.yaml",
  "packages/symbols/combinatorics/statistics/reference/BlockSizeSpan.yaml",
  "packages/symbols/combinatorics/statistics/reference/SingletonBlocks.yaml",
  "packages/symbols/combinatorics/statistics/reference/BlocksAtLeastTwo.yaml",
  "packages/symbols/combinatorics/statistics/reference/BlocksSizeTwo.yaml",
  "packages/symbols/combinatorics/statistics/reference/LastBlockSize.yaml",
  "packages/symbols/combinatorics/statistics/reference/Crossings.yaml",
  "packages/symbols/combinatorics/statistics/reference/Nestings.yaml",
  "packages/symbols/combinatorics/statistics/reference/CrossingNestingTotal.yaml",
  "packages/symbols/combinatorics/statistics/reference/Distributed.yaml",
  "packages/symbols/combinatorics/statistics/reference/BetaDistribution.yaml",
  "packages/symbols/combinatorics/statistics/reference/GammaDistribution.yaml",
  "packages/symbols/combinatorics/statistics/reference/BinormalDistribution.yaml",
  "packages/symbols/combinatorics/statistics/reference/EmpiricalDistribution.yaml",
  "packages/symbols/combinatorics/statistics/reference/RandomVariate.yaml",
  "packages/symbols/combinatorics/statistics/reference/Expectation.yaml",
  "packages/symbols/combinatorics/statistics/reference/Probability.yaml",
];

export const entries: readonly ReferenceEntry[] = [
  {
    name: "Descents",
    domain: "Permutation statistics",
    signature: "Descents(p)",
    summary: "Positions i with p(i) > p(i+1).",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["Descents", ["Permutation", ["List", 3, 1, 2]]],
        expected: 1,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-312-as-a-plain-list",
        expr: ["Descents", ["List", 3, 1, 2]],
        expected: 1,
        caption: "the one-line word $312$, as a plain list",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["Descents", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 1,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "Ascents",
    domain: "Permutation statistics",
    signature: "Ascents(p)",
    summary: "Positions i with p(i) < p(i+1).",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["Ascents", ["Permutation", ["List", 3, 1, 2]]],
        expected: 1,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-312-as-a-plain-list",
        expr: ["Ascents", ["List", 3, 1, 2]],
        expected: 1,
        caption: "the one-line word $312$, as a plain list",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["Ascents", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 2,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "MajorIndex",
    domain: "Permutation statistics",
    signature: "MajorIndex(p)",
    summary: "The SUM of the descent positions — not their count.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.",
      "The distinction from Descents is the entire content of the statistic.",
      "A separate definition exists for `DyckPath` (The sum of the descent positions of the step word — where an up step is followed by a down step.) but is not the one declared: one head, one owner.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["MajorIndex", ["Permutation", ["List", 3, 1, 2]]],
        expected: 1,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-312-as-a-plain-list",
        expr: ["MajorIndex", ["List", 3, 1, 2]],
        expected: 1,
        caption: "the one-line word $312$, as a plain list",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["MajorIndex", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 2,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "MinorIndex",
    domain: "Permutation statistics",
    signature: "MinorIndex(p)",
    summary: "The sum of the ascent positions (the comajor index).",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["MinorIndex", ["Permutation", ["List", 3, 1, 2]]],
        expected: 2,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-312-as-a-plain-list",
        expr: ["MinorIndex", ["List", 3, 1, 2]],
        expected: 2,
        caption: "the one-line word $312$, as a plain list",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["MinorIndex", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 4,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "Inversions",
    domain: "Permutation statistics",
    signature: "Inversions(p)",
    summary: "Pairs i < j with p(i) > p(j).",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["Inversions", ["Permutation", ["List", 3, 1, 2]]],
        expected: 2,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-312-as-a-plain-list",
        expr: ["Inversions", ["List", 3, 1, 2]],
        expected: 2,
        caption: "the one-line word $312$, as a plain list",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["Inversions", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 3,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "FixedPoints",
    domain: "Permutation statistics",
    signature: "FixedPoints(p)",
    summary: "Positions with p(i) = i.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["FixedPoints", ["Permutation", ["List", 3, 1, 2]]],
        expected: 0,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["FixedPoints", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 0,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "Excedances",
    domain: "Permutation statistics",
    signature: "Excedances(p)",
    summary: "Positions with p(i) > i.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["Excedances", ["Permutation", ["List", 3, 1, 2]]],
        expected: 1,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["Excedances", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 2,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "WeakExceedances",
    domain: "Permutation statistics",
    signature: "WeakExceedances(p)",
    summary: "Positions with p(i) >= i.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["WeakExceedances", ["Permutation", ["List", 3, 1, 2]]],
        expected: 1,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["WeakExceedances", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 2,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "Antiexcedances",
    domain: "Permutation statistics",
    signature: "Antiexcedances(p)",
    summary: "Positions with p(i) < i.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["Antiexcedances", ["Permutation", ["List", 3, 1, 2]]],
        expected: 2,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["Antiexcedances", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 2,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "Denert",
    domain: "Permutation statistics",
    signature: "Denert(p)",
    summary:
      "Sum of the excedance positions, plus the inversions within each of the excedance and non-excedance subwords.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
      "Foata–Zeilberger's den (FindStat St000156). Mahonian, and (Excedances, Denert) is equidistributed with (Descents, MajorIndex) — checked in tests/permutation.test.ts. Moved off the frontier: it needs no fold, just same-block inversion counting.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["Denert", ["Permutation", ["List", 3, 1, 2]]],
        expected: 1,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["Denert", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 3,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "Peaks",
    domain: "Permutation statistics",
    signature: "Peaks(p)",
    summary: "Interior positions with p(i-1) < p(i) > p(i+1).",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.",
      "A separate definition exists for `DyckPath` (Occurrences of an up step immediately followed by a down step.) but is not the one declared: one head, one owner.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["Peaks", ["Permutation", ["List", 3, 1, 2]]],
        expected: 0,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-312-as-a-plain-list",
        expr: ["Peaks", ["List", 3, 1, 2]],
        expected: 0,
        caption: "the one-line word $312$, as a plain list",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["Peaks", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 1,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "Valleys",
    domain: "Permutation statistics",
    signature: "Valleys(p)",
    summary: "Interior positions with p(i-1) > p(i) < p(i+1).",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.",
      "A separate definition exists for `DyckPath` (Occurrences of a down step immediately followed by an up step.) but is not the one declared: one head, one owner.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["Valleys", ["Permutation", ["List", 3, 1, 2]]],
        expected: 1,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-312-as-a-plain-list",
        expr: ["Valleys", ["List", 3, 1, 2]],
        expected: 1,
        caption: "the one-line word $312$, as a plain list",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["Valleys", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 1,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "LeftToRightMaxima",
    domain: "Permutation statistics",
    signature: "LeftToRightMaxima(p)",
    summary: "Positions larger than everything before them.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.",
      "Also called records.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["LeftToRightMaxima", ["Permutation", ["List", 3, 1, 2]]],
        expected: 1,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-312-as-a-plain-list",
        expr: ["LeftToRightMaxima", ["List", 3, 1, 2]],
        expected: 1,
        caption: "the one-line word $312$, as a plain list",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["LeftToRightMaxima", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 2,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "LeftToRightMinima",
    domain: "Permutation statistics",
    signature: "LeftToRightMinima(p)",
    summary: "Positions smaller than everything before them.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["LeftToRightMinima", ["Permutation", ["List", 3, 1, 2]]],
        expected: 2,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-312-as-a-plain-list",
        expr: ["LeftToRightMinima", ["List", 3, 1, 2]],
        expected: 2,
        caption: "the one-line word $312$, as a plain list",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["LeftToRightMinima", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 2,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "RightToLeftMaxima",
    domain: "Permutation statistics",
    signature: "RightToLeftMaxima(p)",
    summary: "Positions larger than everything after them.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["RightToLeftMaxima", ["Permutation", ["List", 3, 1, 2]]],
        expected: 2,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-312-as-a-plain-list",
        expr: ["RightToLeftMaxima", ["List", 3, 1, 2]],
        expected: 2,
        caption: "the one-line word $312$, as a plain list",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["RightToLeftMaxima", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 2,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "RightToLeftMinima",
    domain: "Permutation statistics",
    signature: "RightToLeftMinima(p)",
    summary: "Positions smaller than everything after them.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["RightToLeftMinima", ["Permutation", ["List", 3, 1, 2]]],
        expected: 2,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-312-as-a-plain-list",
        expr: ["RightToLeftMinima", ["List", 3, 1, 2]],
        expected: 2,
        caption: "the one-line word $312$, as a plain list",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["RightToLeftMinima", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 2,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "FirstDescent",
    domain: "Permutation statistics",
    signature: "FirstDescent(p)",
    summary: "The smallest descent position, or 0 when p is increasing.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["FirstDescent", ["Permutation", ["List", 3, 1, 2]]],
        expected: 1,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-312-as-a-plain-list",
        expr: ["FirstDescent", ["List", 3, 1, 2]],
        expected: 1,
        caption: "the one-line word $312$, as a plain list",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["FirstDescent", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 2,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "LastDescent",
    domain: "Permutation statistics",
    signature: "LastDescent(p)",
    summary: "The largest descent position, or 0 when p is increasing.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["LastDescent", ["Permutation", ["List", 3, 1, 2]]],
        expected: 1,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-312-as-a-plain-list",
        expr: ["LastDescent", ["List", 3, 1, 2]],
        expected: 1,
        caption: "the one-line word $312$, as a plain list",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["LastDescent", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 2,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "Runs",
    domain: "Permutation statistics",
    signature: "Runs(p)",
    summary: "Maximal increasing runs — one more than the number of descents.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["Runs", ["Permutation", ["List", 3, 1, 2]]],
        expected: 2,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-312-as-a-plain-list",
        expr: ["Runs", ["List", 3, 1, 2]],
        expected: 2,
        caption: "the one-line word $312$, as a plain list",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["Runs", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 2,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "Depth",
    domain: "Permutation statistics",
    signature: "Depth(p)",
    summary: "Half the total displacement, (1/2) * sum |p(i) - i|.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["Depth", ["Permutation", ["List", 3, 1, 2]]],
        expected: 2,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["Depth", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 3,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "CyclicDescents",
    domain: "Permutation statistics",
    signature: "CyclicDescents(p)",
    summary: "Descents of p read cyclically, counting position n when p(n) > p(1).",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["CyclicDescents", ["Permutation", ["List", 3, 1, 2]]],
        expected: 1,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-312-as-a-plain-list",
        expr: ["CyclicDescents", ["List", 3, 1, 2]],
        expected: 1,
        caption: "the one-line word $312$, as a plain list",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["CyclicDescents", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 2,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "OccurrencesOf123",
    domain: "Permutation statistics",
    signature: "OccurrencesOf123(p)",
    summary: "Triples i < j < k with p(i) < p(j) < p(k).",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["OccurrencesOf123", ["Permutation", ["List", 3, 1, 2]]],
        expected: 0,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-312-as-a-plain-list",
        expr: ["OccurrencesOf123", ["List", 3, 1, 2]],
        expected: 0,
        caption: "the one-line word $312$, as a plain list",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["OccurrencesOf123", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 0,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "OccurrencesOf132",
    domain: "Permutation statistics",
    signature: "OccurrencesOf132(p)",
    summary: "Triples i < j < k with p(i) < p(k) < p(j).",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["OccurrencesOf132", ["Permutation", ["List", 3, 1, 2]]],
        expected: 0,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-312-as-a-plain-list",
        expr: ["OccurrencesOf132", ["List", 3, 1, 2]],
        expected: 0,
        caption: "the one-line word $312$, as a plain list",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["OccurrencesOf132", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 1,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "OccurrencesOf213",
    domain: "Permutation statistics",
    signature: "OccurrencesOf213(p)",
    summary: "Triples i < j < k with p(j) < p(i) < p(k).",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["OccurrencesOf213", ["Permutation", ["List", 3, 1, 2]]],
        expected: 0,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-312-as-a-plain-list",
        expr: ["OccurrencesOf213", ["List", 3, 1, 2]],
        expected: 0,
        caption: "the one-line word $312$, as a plain list",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["OccurrencesOf213", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 1,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "StackSortable",
    domain: "Permutation statistics",
    signature: "StackSortable(p)",
    summary:
      "1 when p avoids the pattern 231, 0 otherwise — exactly the stack-sortable permutations.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["StackSortable", ["Permutation", ["List", 3, 1, 2]]],
        expected: 1,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-312-as-a-plain-list",
        expr: ["StackSortable", ["List", 3, 1, 2]],
        expected: 1,
        caption: "the one-line word $312$, as a plain list",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["StackSortable", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 0,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "LongestRun",
    domain: "Permutation statistics",
    signature: "LongestRun(p)",
    summary: "The length of the longest run of consecutive increases.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.",
      "Expressed with Fold — which compute-engine does have, contrary to what an earlier version of this package claimed when it put this statistic on the frontier.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["LongestRun", ["Permutation", ["List", 3, 1, 2]]],
        expected: 2,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-312-as-a-plain-list",
        expr: ["LongestRun", ["List", 3, 1, 2]],
        expected: 2,
        caption: "the one-line word $312$, as a plain list",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["LongestRun", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 2,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "LargestRunLength",
    domain: "Permutation statistics",
    signature: "LargestRunLength(p)",
    summary:
      "The length of the longest increasing run (the catalog's second spelling of LongestRun).",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["LargestRunLength", ["Permutation", ["List", 3, 1, 2]]],
        expected: 2,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-312-as-a-plain-list",
        expr: ["LargestRunLength", ["List", 3, 1, 2]],
        expected: 2,
        caption: "the one-line word $312$, as a plain list",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["LargestRunLength", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 2,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "CycleCount",
    domain: "Permutation statistics",
    signature: "CycleCount(p)",
    summary: "The number of cycles in the disjoint-cycle decomposition.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["CycleCount", ["Permutation", ["List", 3, 1, 2]]],
        expected: 1,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["CycleCount", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 1,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "ReflectionLength",
    domain: "Permutation statistics",
    signature: "ReflectionLength(p)",
    summary: "n minus the number of cycles — the minimum number of transpositions.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["ReflectionLength", ["Permutation", ["List", 3, 1, 2]]],
        expected: 2,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["ReflectionLength", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 3,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "LargestCycleLength",
    domain: "Permutation statistics",
    signature: "LargestCycleLength(p)",
    summary: "The size of the largest cycle.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["LargestCycleLength", ["Permutation", ["List", 3, 1, 2]]],
        expected: 3,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["LargestCycleLength", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 4,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "LongestCycleLength",
    domain: "Permutation statistics",
    signature: "LongestCycleLength(p)",
    summary: "The size of the largest cycle (the catalog's second spelling).",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["LongestCycleLength", ["Permutation", ["List", 3, 1, 2]]],
        expected: 3,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["LongestCycleLength", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 4,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "DistinctCycleLengths",
    domain: "Permutation statistics",
    signature: "DistinctCycleLengths(p)",
    summary: "How many distinct cycle sizes occur.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["DistinctCycleLengths", ["Permutation", ["List", 3, 1, 2]]],
        expected: 1,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["DistinctCycleLengths", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 1,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "TwoCycleCount",
    domain: "Permutation statistics",
    signature: "TwoCycleCount(p)",
    summary: "Cycles of size exactly two.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["TwoCycleCount", ["Permutation", ["List", 3, 1, 2]]],
        expected: 0,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["TwoCycleCount", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 0,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "ThreeCycleCount",
    domain: "Permutation statistics",
    signature: "ThreeCycleCount(p)",
    summary: "Cycles of size exactly three.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["ThreeCycleCount", ["Permutation", ["List", 3, 1, 2]]],
        expected: 1,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["ThreeCycleCount", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 0,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "Order",
    domain: "Permutation statistics",
    signature: "Order(p)",
    summary: "The order of p in the symmetric group — the lcm of its cycle lengths.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["Order", ["Permutation", ["List", 3, 1, 2]]],
        expected: 3,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["Order", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 4,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "LongestIncreasingSubsequence",
    domain: "Permutation statistics",
    signature: "LongestIncreasingSubsequence(p)",
    summary: "The length of a longest increasing subsequence.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.",
      "By patience sorting: the number of piles. Checked against the piles algorithm over every permutation of 1..6.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["LongestIncreasingSubsequence", ["Permutation", ["List", 3, 1, 2]]],
        expected: 2,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-312-as-a-plain-list",
        expr: ["LongestIncreasingSubsequence", ["List", 3, 1, 2]],
        expected: 2,
        caption: "the one-line word $312$, as a plain list",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["LongestIncreasingSubsequence", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 2,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "LongestDecreasingSubsequence",
    domain: "Permutation statistics",
    signature: "LongestDecreasingSubsequence(p)",
    summary: "The length of a longest decreasing subsequence.",
    details: [
      "Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.",
      "The same fold with the comparison reversed — by Dilworth, the number of piles when the tops are kept decreasing.",
    ],
    examples: [
      {
        id: "the-one-line-word-312",
        expr: ["LongestDecreasingSubsequence", ["Permutation", ["List", 3, 1, 2]]],
        expected: 2,
        caption: "the one-line word $312$",
      },
      {
        id: "the-one-line-word-312-as-a-plain-list",
        expr: ["LongestDecreasingSubsequence", ["List", 3, 1, 2]],
        expected: 2,
        caption: "the one-line word $312$, as a plain list",
      },
      {
        id: "the-one-line-word-2413",
        expr: ["LongestDecreasingSubsequence", ["Permutation", ["List", 2, 4, 1, 3]]],
        expected: 2,
        caption: "the one-line word $2413$",
      },
    ],
  },
  {
    name: "LargestPart",
    domain: "Partition statistics",
    signature: "LargestPart(partition)",
    summary: "The largest part.",
    details: [
      "Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-partition-4-2-1-of-7",
        expr: ["LargestPart", ["IntegerPartition", ["List", 4, 2, 1]]],
        expected: 4,
        caption: "the partition $4 + 2 + 1$ of $7$",
      },
      {
        id: "the-partition-3-3-1-of-7",
        expr: ["LargestPart", ["IntegerPartition", ["List", 3, 3, 1]]],
        expected: 3,
        caption: "the partition $3 + 3 + 1$ of $7$",
      },
    ],
  },
  {
    name: "MultiplicityOfLargestPart",
    domain: "Partition statistics",
    signature: "MultiplicityOfLargestPart(partition)",
    summary: "How many parts equal the largest.",
    details: [
      "Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-partition-4-2-1-of-7",
        expr: ["MultiplicityOfLargestPart", ["IntegerPartition", ["List", 4, 2, 1]]],
        expected: 1,
        caption: "the partition $4 + 2 + 1$ of $7$",
      },
      {
        id: "the-partition-3-3-1-of-7",
        expr: ["MultiplicityOfLargestPart", ["IntegerPartition", ["List", 3, 3, 1]]],
        expected: 2,
        caption: "the partition $3 + 3 + 1$ of $7$",
      },
    ],
  },
  {
    name: "DistinctParts",
    domain: "Partition statistics",
    signature: "DistinctParts(partition)",
    summary: "How many distinct part sizes occur.",
    details: [
      "Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-partition-4-2-1-of-7",
        expr: ["DistinctParts", ["IntegerPartition", ["List", 4, 2, 1]]],
        expected: 3,
        caption: "the partition $4 + 2 + 1$ of $7$",
      },
      {
        id: "the-partition-3-3-1-of-7",
        expr: ["DistinctParts", ["IntegerPartition", ["List", 3, 3, 1]]],
        expected: 2,
        caption: "the partition $3 + 3 + 1$ of $7$",
      },
    ],
  },
  {
    name: "EvenParts",
    domain: "Partition statistics",
    signature: "EvenParts(partition)",
    summary: "Parts that are even.",
    details: [
      "Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-partition-4-2-1-of-7",
        expr: ["EvenParts", ["IntegerPartition", ["List", 4, 2, 1]]],
        expected: 2,
        caption: "the partition $4 + 2 + 1$ of $7$",
      },
      {
        id: "the-partition-3-3-1-of-7",
        expr: ["EvenParts", ["IntegerPartition", ["List", 3, 3, 1]]],
        expected: 0,
        caption: "the partition $3 + 3 + 1$ of $7$",
      },
    ],
  },
  {
    name: "OddParts",
    domain: "Partition statistics",
    signature: "OddParts(partition)",
    summary: "Parts that are odd.",
    details: [
      "Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-partition-4-2-1-of-7",
        expr: ["OddParts", ["IntegerPartition", ["List", 4, 2, 1]]],
        expected: 1,
        caption: "the partition $4 + 2 + 1$ of $7$",
      },
      {
        id: "the-partition-3-3-1-of-7",
        expr: ["OddParts", ["IntegerPartition", ["List", 3, 3, 1]]],
        expected: 3,
        caption: "the partition $3 + 3 + 1$ of $7$",
      },
    ],
  },
  {
    name: "PartsEqualOne",
    domain: "Partition statistics",
    signature: "PartsEqualOne(partition)",
    summary: "Parts equal to 1.",
    details: [
      "Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-partition-4-2-1-of-7",
        expr: ["PartsEqualOne", ["IntegerPartition", ["List", 4, 2, 1]]],
        expected: 1,
        caption: "the partition $4 + 2 + 1$ of $7$",
      },
      {
        id: "the-partition-3-3-1-of-7",
        expr: ["PartsEqualOne", ["IntegerPartition", ["List", 3, 3, 1]]],
        expected: 1,
        caption: "the partition $3 + 3 + 1$ of $7$",
      },
    ],
  },
  {
    name: "PartsAtLeastTwo",
    domain: "Partition statistics",
    signature: "PartsAtLeastTwo(partition)",
    summary: "Parts of size at least 2.",
    details: [
      "Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-partition-4-2-1-of-7",
        expr: ["PartsAtLeastTwo", ["IntegerPartition", ["List", 4, 2, 1]]],
        expected: 2,
        caption: "the partition $4 + 2 + 1$ of $7$",
      },
      {
        id: "the-partition-3-3-1-of-7",
        expr: ["PartsAtLeastTwo", ["IntegerPartition", ["List", 3, 3, 1]]],
        expected: 2,
        caption: "the partition $3 + 3 + 1$ of $7$",
      },
    ],
  },
  {
    name: "ConjugateOddParts",
    domain: "Partition statistics",
    signature: "ConjugateOddParts(partition)",
    summary: "Odd parts of the conjugate — equivalently, the distinct part sizes of λ.",
    details: [
      "Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-partition-4-2-1-of-7",
        expr: ["ConjugateOddParts", ["IntegerPartition", ["List", 4, 2, 1]]],
        expected: 3,
        caption: "the partition $4 + 2 + 1$ of $7$",
      },
      {
        id: "the-partition-3-3-1-of-7",
        expr: ["ConjugateOddParts", ["IntegerPartition", ["List", 3, 3, 1]]],
        expected: 1,
        caption: "the partition $3 + 3 + 1$ of $7$",
      },
    ],
  },
  {
    name: "ConjugateDistinctParts",
    domain: "Partition statistics",
    signature: "ConjugateDistinctParts(partition)",
    summary: "Distinct part sizes of the conjugate.",
    details: [
      "Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-partition-4-2-1-of-7",
        expr: ["ConjugateDistinctParts", ["IntegerPartition", ["List", 4, 2, 1]]],
        expected: 3,
        caption: "the partition $4 + 2 + 1$ of $7$",
      },
      {
        id: "the-partition-3-3-1-of-7",
        expr: ["ConjugateDistinctParts", ["IntegerPartition", ["List", 3, 3, 1]]],
        expected: 2,
        caption: "the partition $3 + 3 + 1$ of $7$",
      },
    ],
  },
  {
    name: "DurfeeSquare",
    domain: "Partition statistics",
    signature: "DurfeeSquare(partition)",
    summary:
      "The side of the Durfee square: the largest d with at least d parts of size at least d.",
    details: [
      "Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-partition-4-2-1-of-7",
        expr: ["DurfeeSquare", ["IntegerPartition", ["List", 4, 2, 1]]],
        expected: 2,
        caption: "the partition $4 + 2 + 1$ of $7$",
      },
      {
        id: "the-partition-3-3-1-of-7",
        expr: ["DurfeeSquare", ["IntegerPartition", ["List", 3, 3, 1]]],
        expected: 2,
        caption: "the partition $3 + 3 + 1$ of $7$",
      },
    ],
  },
  {
    name: "ArmOfFirstCell",
    domain: "Partition statistics",
    signature: "ArmOfFirstCell(partition)",
    summary: "The arm of cell (1,1): the first part minus one.",
    details: [
      "Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-partition-4-2-1-of-7",
        expr: ["ArmOfFirstCell", ["IntegerPartition", ["List", 4, 2, 1]]],
        expected: 3,
        caption: "the partition $4 + 2 + 1$ of $7$",
      },
      {
        id: "the-partition-3-3-1-of-7",
        expr: ["ArmOfFirstCell", ["IntegerPartition", ["List", 3, 3, 1]]],
        expected: 2,
        caption: "the partition $3 + 3 + 1$ of $7$",
      },
    ],
  },
  {
    name: "LegOfFirstCell",
    domain: "Partition statistics",
    signature: "LegOfFirstCell(partition)",
    summary: "The leg of cell (1,1): the number of parts minus one.",
    details: [
      "Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-partition-4-2-1-of-7",
        expr: ["LegOfFirstCell", ["IntegerPartition", ["List", 4, 2, 1]]],
        expected: 2,
        caption: "the partition $4 + 2 + 1$ of $7$",
      },
      {
        id: "the-partition-3-3-1-of-7",
        expr: ["LegOfFirstCell", ["IntegerPartition", ["List", 3, 3, 1]]],
        expected: 2,
        caption: "the partition $3 + 3 + 1$ of $7$",
      },
    ],
  },
  {
    name: "Corners",
    domain: "Partition statistics",
    signature: "Corners(partition)",
    summary:
      "Corner cells — parts strictly larger than the next part (the last part always counts).",
    details: [
      "Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-partition-4-2-1-of-7",
        expr: ["Corners", ["IntegerPartition", ["List", 4, 2, 1]]],
        expected: 3,
        caption: "the partition $4 + 2 + 1$ of $7$",
      },
      {
        id: "the-partition-3-3-1-of-7",
        expr: ["Corners", ["IntegerPartition", ["List", 3, 3, 1]]],
        expected: 2,
        caption: "the partition $3 + 3 + 1$ of $7$",
      },
    ],
  },
  {
    name: "Perimeter",
    domain: "Partition statistics",
    signature: "Perimeter(partition)",
    summary: "The perimeter of the Young diagram: largest part plus number of parts.",
    details: [
      "Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-partition-4-2-1-of-7",
        expr: ["Perimeter", ["IntegerPartition", ["List", 4, 2, 1]]],
        expected: 7,
        caption: "the partition $4 + 2 + 1$ of $7$",
      },
      {
        id: "the-partition-3-3-1-of-7",
        expr: ["Perimeter", ["IntegerPartition", ["List", 3, 3, 1]]],
        expected: 6,
        caption: "the partition $3 + 3 + 1$ of $7$",
      },
    ],
  },
  {
    name: "IsSelfConjugate",
    domain: "Partition statistics",
    signature: "IsSelfConjugate(partition)",
    summary: "1 when λ equals its conjugate, 0 otherwise.",
    details: [
      "Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-partition-4-2-1-of-7",
        expr: ["IsSelfConjugate", ["IntegerPartition", ["List", 4, 2, 1]]],
        expected: 0,
        caption: "the partition $4 + 2 + 1$ of $7$",
      },
      {
        id: "the-partition-3-3-1-of-7",
        expr: ["IsSelfConjugate", ["IntegerPartition", ["List", 3, 3, 1]]],
        expected: 0,
        caption: "the partition $3 + 3 + 1$ of $7$",
      },
    ],
  },
  {
    name: "SumOfHookLengths",
    domain: "Partition statistics",
    signature: "SumOfHookLengths(partition)",
    summary: "The total of all hook lengths.",
    details: [
      "Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
      "Hook of cell (i, j) is arm + leg + 1 = (λ_i - j) + (λ'_j - i) + 1.",
    ],
    examples: [
      {
        id: "the-partition-4-2-1-of-7",
        expr: ["SumOfHookLengths", ["IntegerPartition", ["List", 4, 2, 1]]],
        expected: 18,
        caption: "the partition $4 + 2 + 1$ of $7$",
      },
      {
        id: "the-partition-3-3-1-of-7",
        expr: ["SumOfHookLengths", ["IntegerPartition", ["List", 3, 3, 1]]],
        expected: 18,
        caption: "the partition $3 + 3 + 1$ of $7$",
      },
    ],
  },
  {
    name: "HookProduct",
    domain: "Partition statistics",
    signature: "HookProduct(partition)",
    summary: "The product of all hook lengths — the denominator in the hook-length formula.",
    details: [
      "Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-partition-4-2-1-of-7",
        expr: ["HookProduct", ["IntegerPartition", ["List", 4, 2, 1]]],
        expected: 144,
        caption: "the partition $4 + 2 + 1$ of $7$",
      },
      {
        id: "the-partition-3-3-1-of-7",
        expr: ["HookProduct", ["IntegerPartition", ["List", 3, 3, 1]]],
        expected: 240,
        caption: "the partition $3 + 3 + 1$ of $7$",
      },
    ],
  },
  {
    name: "DysonRank",
    domain: "Partition statistics",
    signature: "DysonRank(partition)",
    summary: "Largest part minus number of parts.",
    details: [
      "Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-partition-4-2-1-of-7",
        expr: ["DysonRank", ["IntegerPartition", ["List", 4, 2, 1]]],
        expected: 1,
        caption: "the partition $4 + 2 + 1$ of $7$",
      },
      {
        id: "the-partition-3-3-1-of-7",
        expr: ["DysonRank", ["IntegerPartition", ["List", 3, 3, 1]]],
        expected: 0,
        caption: "the partition $3 + 3 + 1$ of $7$",
      },
    ],
  },
  {
    name: "Crank",
    domain: "Partition statistics",
    signature: "Crank(partition)",
    summary:
      "The Andrews-Garvan crank: the largest part when λ has no 1s, else (parts larger than the number of 1s) minus (the number of 1s).",
    details: [
      "Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-partition-4-2-1-of-7",
        expr: ["Crank", ["IntegerPartition", ["List", 4, 2, 1]]],
        expected: 1,
        caption: "the partition $4 + 2 + 1$ of $7$",
      },
      {
        id: "the-partition-3-3-1-of-7",
        expr: ["Crank", ["IntegerPartition", ["List", 3, 3, 1]]],
        expected: 1,
        caption: "the partition $3 + 3 + 1$ of $7$",
      },
    ],
  },
  {
    name: "Height",
    domain: "Dyck path statistics",
    signature: "Height(path)",
    summary: "The greatest height the path reaches.",
    details: [
      "Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-step-word-uuddud",
        expr: ["Height", ["DyckPath", ["List", 1, 1, 0, 0, 1, 0]]],
        expected: 2,
        caption: "the step word $UUDDUD$",
      },
      {
        id: "the-step-word-uduudd",
        expr: ["Height", ["DyckPath", ["List", 1, 0, 1, 1, 0, 0]]],
        expected: 2,
        caption: "the step word $UDUUDD$",
      },
    ],
  },
  {
    name: "DoubleRises",
    domain: "Dyck path statistics",
    signature: "DoubleRises(path)",
    summary: "Occurrences of two consecutive up steps.",
    details: [
      "Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-step-word-uuddud",
        expr: ["DoubleRises", ["DyckPath", ["List", 1, 1, 0, 0, 1, 0]]],
        expected: 1,
        caption: "the step word $UUDDUD$",
      },
      {
        id: "the-step-word-uduudd",
        expr: ["DoubleRises", ["DyckPath", ["List", 1, 0, 1, 1, 0, 0]]],
        expected: 1,
        caption: "the step word $UDUUDD$",
      },
    ],
  },
  {
    name: "Returns",
    domain: "Dyck path statistics",
    signature: "Returns(path)",
    summary: "Points where the path comes back to height 0.",
    details: [
      "Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-step-word-uuddud",
        expr: ["Returns", ["DyckPath", ["List", 1, 1, 0, 0, 1, 0]]],
        expected: 2,
        caption: "the step word $UUDDUD$",
      },
      {
        id: "the-step-word-uduudd",
        expr: ["Returns", ["DyckPath", ["List", 1, 0, 1, 1, 0, 0]]],
        expected: 2,
        caption: "the step word $UDUUDD$",
      },
    ],
  },
  {
    name: "TouchPointCount",
    domain: "Dyck path statistics",
    signature: "TouchPointCount(path)",
    summary: "Points where the path touches the axis — the returns.",
    details: [
      "Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
      "The catalog carries both spellings; they are the same statistic, which is why both are defined rather than one aliased to the other.",
    ],
    examples: [
      {
        id: "the-step-word-uuddud",
        expr: ["TouchPointCount", ["DyckPath", ["List", 1, 1, 0, 0, 1, 0]]],
        expected: 2,
        caption: "the step word $UUDDUD$",
      },
      {
        id: "the-step-word-uduudd",
        expr: ["TouchPointCount", ["DyckPath", ["List", 1, 0, 1, 1, 0, 0]]],
        expected: 2,
        caption: "the step word $UDUUDD$",
      },
    ],
  },
  {
    name: "InteriorReturns",
    domain: "Dyck path statistics",
    signature: "InteriorReturns(path)",
    summary: "Returns to height 0 strictly before the end.",
    details: [
      "Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-step-word-uuddud",
        expr: ["InteriorReturns", ["DyckPath", ["List", 1, 1, 0, 0, 1, 0]]],
        expected: 1,
        caption: "the step word $UUDDUD$",
      },
      {
        id: "the-step-word-uduudd",
        expr: ["InteriorReturns", ["DyckPath", ["List", 1, 0, 1, 1, 0, 0]]],
        expected: 1,
        caption: "the step word $UDUUDD$",
      },
    ],
  },
  {
    name: "Hills",
    domain: "Dyck path statistics",
    signature: "Hills(path)",
    summary: "Peaks at height 1 — an up step from the axis immediately followed by a down step.",
    details: [
      "Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-step-word-uuddud",
        expr: ["Hills", ["DyckPath", ["List", 1, 1, 0, 0, 1, 0]]],
        expected: 1,
        caption: "the step word $UUDDUD$",
      },
      {
        id: "the-step-word-uduudd",
        expr: ["Hills", ["DyckPath", ["List", 1, 0, 1, 1, 0, 0]]],
        expected: 1,
        caption: "the step word $UDUUDD$",
      },
    ],
  },
  {
    name: "InitialRise",
    domain: "Dyck path statistics",
    signature: "InitialRise(path)",
    summary: "The length of the opening run of up steps.",
    details: [
      "Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
      "Height equals the index exactly while every step so far has been an up step.",
    ],
    examples: [
      {
        id: "the-step-word-uuddud",
        expr: ["InitialRise", ["DyckPath", ["List", 1, 1, 0, 0, 1, 0]]],
        expected: 2,
        caption: "the step word $UUDDUD$",
      },
      {
        id: "the-step-word-uduudd",
        expr: ["InitialRise", ["DyckPath", ["List", 1, 0, 1, 1, 0, 0]]],
        expected: 1,
        caption: "the step word $UDUUDD$",
      },
    ],
  },
  {
    name: "Area",
    domain: "Dyck path statistics",
    signature: "Area(path)",
    summary: "The area between the path and the axis: the total of the heights after each step.",
    details: [
      "Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-step-word-uuddud",
        expr: ["Area", ["DyckPath", ["List", 1, 1, 0, 0, 1, 0]]],
        expected: 5,
        caption: "the step word $UUDDUD$",
      },
      {
        id: "the-step-word-uduudd",
        expr: ["Area", ["DyckPath", ["List", 1, 0, 1, 1, 0, 0]]],
        expected: 5,
        caption: "the step word $UDUUDD$",
      },
    ],
  },
  {
    name: "Coarea",
    domain: "Dyck path statistics",
    signature: "Coarea(path)",
    summary: "The complement of the area within the enclosing triangle.",
    details: [
      "Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
      "Defined against the n(n+1)/2 triangle for a path of 2n steps.",
    ],
    examples: [
      {
        id: "the-step-word-uuddud",
        expr: ["Coarea", ["DyckPath", ["List", 1, 1, 0, 0, 1, 0]]],
        expected: 1,
        caption: "the step word $UUDDUD$",
      },
      {
        id: "the-step-word-uduudd",
        expr: ["Coarea", ["DyckPath", ["List", 1, 0, 1, 1, 0, 0]]],
        expected: 1,
        caption: "the step word $UDUUDD$",
      },
    ],
  },
  {
    name: "LongestAscent",
    domain: "Dyck path statistics",
    signature: "LongestAscent(path)",
    summary: "The longest run of consecutive up steps.",
    details: [
      "Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-step-word-uuddud",
        expr: ["LongestAscent", ["DyckPath", ["List", 1, 1, 0, 0, 1, 0]]],
        expected: 2,
        caption: "the step word $UUDDUD$",
      },
      {
        id: "the-step-word-uduudd",
        expr: ["LongestAscent", ["DyckPath", ["List", 1, 0, 1, 1, 0, 0]]],
        expected: 2,
        caption: "the step word $UDUUDD$",
      },
    ],
  },
  {
    name: "LongestDescent",
    domain: "Dyck path statistics",
    signature: "LongestDescent(path)",
    summary: "The longest run of consecutive down steps.",
    details: [
      "Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
    ],
    examples: [
      {
        id: "the-step-word-uuddud",
        expr: ["LongestDescent", ["DyckPath", ["List", 1, 1, 0, 0, 1, 0]]],
        expected: 2,
        caption: "the step word $UUDDUD$",
      },
      {
        id: "the-step-word-uduudd",
        expr: ["LongestDescent", ["DyckPath", ["List", 1, 0, 1, 1, 0, 0]]],
        expected: 2,
        caption: "the step word $UDUUDD$",
      },
    ],
  },
  {
    name: "Dinv",
    domain: "Dyck path statistics",
    signature: "Dinv(path)",
    summary: "The dinv statistic, read from the area sequence.",
    details: [
      "Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
      "dinv = #{i<j : a_i=a_j} + #{i<j : a_i=a_j+1}; the two counts never overlap (a_i=a_j and a_i=a_j+1 can't both hold), so this is one pass over the pairs.",
    ],
    examples: [
      {
        id: "the-step-word-uuddud",
        expr: ["Dinv", ["DyckPath", ["List", 1, 1, 0, 0, 1, 0]]],
        expected: 2,
        caption: "the step word $UUDDUD$",
      },
      {
        id: "the-step-word-uduudd",
        expr: ["Dinv", ["DyckPath", ["List", 1, 0, 1, 1, 0, 0]]],
        expected: 1,
        caption: "the step word $UDUUDD$",
      },
    ],
  },
  {
    name: "Bounce",
    domain: "Dyck path statistics",
    signature: "Bounce(path)",
    summary: "The bounce statistic, which walks the path bouncing off its own peaks.",
    details: [
      "Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.",
      "Equidistributed with Area: (Bounce, Area) and (Area, Dinv) share the same bivariate distribution (see dyck.test.ts).",
    ],
    examples: [
      {
        id: "the-step-word-uuddud",
        expr: ["Bounce", ["DyckPath", ["List", 1, 1, 0, 0, 1, 0]]],
        expected: 1,
        caption: "the step word $UUDDUD$",
      },
      {
        id: "the-step-word-uduudd",
        expr: ["Bounce", ["DyckPath", ["List", 1, 0, 1, 1, 0, 0]]],
        expected: 2,
        caption: "the step word $UDUUDD$",
      },
    ],
  },
  {
    name: "Blocks",
    domain: "Set partition statistics",
    signature: "Blocks(partition)",
    summary: "The number of blocks.",
    details: [
      "Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Not yet typed over its carrier: `SetPartition` is a restricted growth string in @enumeratio/domains but a list of BLOCKS here, so the head still takes the bare blocks until the two representations are reconciled.",
    ],
    examples: [
      {
        id: "the-partition-1-3-mid-2-as-a-plain-list",
        expr: ["Blocks", ["List", ["List", 1, 3], ["List", 2]]],
        expected: 2,
        caption: "the partition $\\{1,3\\} \\mid \\{2\\}$, as a plain list",
      },
    ],
  },
  {
    name: "LargestBlock",
    domain: "Set partition statistics",
    signature: "LargestBlock(partition)",
    summary: "The size of the largest block.",
    details: [
      "Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Not yet typed over its carrier: `SetPartition` is a restricted growth string in @enumeratio/domains but a list of BLOCKS here, so the head still takes the bare blocks until the two representations are reconciled.",
    ],
    examples: [
      {
        id: "the-partition-1-3-mid-2-as-a-plain-list",
        expr: ["LargestBlock", ["List", ["List", 1, 3], ["List", 2]]],
        expected: 2,
        caption: "the partition $\\{1,3\\} \\mid \\{2\\}$, as a plain list",
      },
    ],
  },
  {
    name: "SmallestBlock",
    domain: "Set partition statistics",
    signature: "SmallestBlock(partition)",
    summary: "The size of the smallest block.",
    details: [
      "Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Not yet typed over its carrier: `SetPartition` is a restricted growth string in @enumeratio/domains but a list of BLOCKS here, so the head still takes the bare blocks until the two representations are reconciled.",
    ],
    examples: [
      {
        id: "the-partition-1-3-mid-2-as-a-plain-list",
        expr: ["SmallestBlock", ["List", ["List", 1, 3], ["List", 2]]],
        expected: 1,
        caption: "the partition $\\{1,3\\} \\mid \\{2\\}$, as a plain list",
      },
    ],
  },
  {
    name: "BlockSizeSpan",
    domain: "Set partition statistics",
    signature: "BlockSizeSpan(partition)",
    summary: "Largest block size minus smallest.",
    details: [
      "Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Not yet typed over its carrier: `SetPartition` is a restricted growth string in @enumeratio/domains but a list of BLOCKS here, so the head still takes the bare blocks until the two representations are reconciled.",
    ],
    examples: [
      {
        id: "the-partition-1-3-mid-2-as-a-plain-list",
        expr: ["BlockSizeSpan", ["List", ["List", 1, 3], ["List", 2]]],
        expected: 1,
        caption: "the partition $\\{1,3\\} \\mid \\{2\\}$, as a plain list",
      },
    ],
  },
  {
    name: "SingletonBlocks",
    domain: "Set partition statistics",
    signature: "SingletonBlocks(partition)",
    summary: "Blocks containing exactly one element.",
    details: [
      "Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Not yet typed over its carrier: `SetPartition` is a restricted growth string in @enumeratio/domains but a list of BLOCKS here, so the head still takes the bare blocks until the two representations are reconciled.",
    ],
    examples: [
      {
        id: "the-partition-1-3-mid-2-as-a-plain-list",
        expr: ["SingletonBlocks", ["List", ["List", 1, 3], ["List", 2]]],
        expected: 1,
        caption: "the partition $\\{1,3\\} \\mid \\{2\\}$, as a plain list",
      },
    ],
  },
  {
    name: "BlocksAtLeastTwo",
    domain: "Set partition statistics",
    signature: "BlocksAtLeastTwo(partition)",
    summary: "Blocks containing at least two elements.",
    details: [
      "Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Not yet typed over its carrier: `SetPartition` is a restricted growth string in @enumeratio/domains but a list of BLOCKS here, so the head still takes the bare blocks until the two representations are reconciled.",
    ],
    examples: [
      {
        id: "the-partition-1-3-mid-2-as-a-plain-list",
        expr: ["BlocksAtLeastTwo", ["List", ["List", 1, 3], ["List", 2]]],
        expected: 1,
        caption: "the partition $\\{1,3\\} \\mid \\{2\\}$, as a plain list",
      },
    ],
  },
  {
    name: "BlocksSizeTwo",
    domain: "Set partition statistics",
    signature: "BlocksSizeTwo(partition)",
    summary: "Blocks containing exactly two elements.",
    details: [
      "Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Not yet typed over its carrier: `SetPartition` is a restricted growth string in @enumeratio/domains but a list of BLOCKS here, so the head still takes the bare blocks until the two representations are reconciled.",
    ],
    examples: [
      {
        id: "the-partition-1-3-mid-2-as-a-plain-list",
        expr: ["BlocksSizeTwo", ["List", ["List", 1, 3], ["List", 2]]],
        expected: 1,
        caption: "the partition $\\{1,3\\} \\mid \\{2\\}$, as a plain list",
      },
    ],
  },
  {
    name: "LastBlockSize",
    domain: "Set partition statistics",
    signature: "LastBlockSize(partition)",
    summary: "The size of the final block.",
    details: [
      "Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Not yet typed over its carrier: `SetPartition` is a restricted growth string in @enumeratio/domains but a list of BLOCKS here, so the head still takes the bare blocks until the two representations are reconciled.",
    ],
    examples: [
      {
        id: "the-partition-1-3-mid-2-as-a-plain-list",
        expr: ["LastBlockSize", ["List", ["List", 1, 3], ["List", 2]]],
        expected: 1,
        caption: "the partition $\\{1,3\\} \\mid \\{2\\}$, as a plain list",
      },
    ],
  },
  {
    name: "Crossings",
    domain: "Set partition statistics",
    signature: "Crossings(partition)",
    summary: "Pairs of arcs a < b < c < d with a~c and b~d.",
    details: [
      "Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Not yet typed over its carrier: `SetPartition` is a restricted growth string in @enumeratio/domains but a list of BLOCKS here, so the head still takes the bare blocks until the two representations are reconciled.",
      "Read off the standard arc representation: within each block, consecutive elements are linked, and a crossing is two arcs whose spans interleave rather than nest or sit apart.",
    ],
    examples: [
      {
        id: "the-partition-1-3-mid-2-as-a-plain-list",
        expr: ["Crossings", ["List", ["List", 1, 3], ["List", 2]]],
        expected: 0,
        caption: "the partition $\\{1,3\\} \\mid \\{2\\}$, as a plain list",
      },
    ],
  },
  {
    name: "Nestings",
    domain: "Set partition statistics",
    signature: "Nestings(partition)",
    summary: "Pairs of arcs a < b < c < d with a~d and b~c.",
    details: [
      "Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Not yet typed over its carrier: `SetPartition` is a restricted growth string in @enumeratio/domains but a list of BLOCKS here, so the head still takes the bare blocks until the two representations are reconciled.",
      "The complementary case to Crossings: one arc's span strictly contains the other's. Equidistributed with Crossings over set partitions of [n] (Kasraoui–Zeng), and the noncrossing and nonnesting partitions are each counted by the Catalan numbers.",
    ],
    examples: [
      {
        id: "the-partition-1-3-mid-2-as-a-plain-list",
        expr: ["Nestings", ["List", ["List", 1, 3], ["List", 2]]],
        expected: 0,
        caption: "the partition $\\{1,3\\} \\mid \\{2\\}$, as a plain list",
      },
    ],
  },
  {
    name: "CrossingNestingTotal",
    domain: "Set partition statistics",
    signature: "CrossingNestingTotal(partition)",
    summary: "Crossings plus nestings.",
    details: [
      "Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.",
      "Not yet typed over its carrier: `SetPartition` is a restricted growth string in @enumeratio/domains but a list of BLOCKS here, so the head still takes the bare blocks until the two representations are reconciled.",
    ],
    examples: [
      {
        id: "the-partition-1-3-mid-2-as-a-plain-list",
        expr: ["CrossingNestingTotal", ["List", ["List", 1, 3], ["List", 2]]],
        expected: 0,
        caption: "the partition $\\{1,3\\} \\mid \\{2\\}$, as a plain list",
      },
    ],
  },
  {
    name: "Distributed",
    domain: "Statistics",
    signature: "Distributed(x, dist)",
    summary: "Binds a variable to a distribution, for [[Expectation]] and [[Probability]].",
    signatures: [
      {
        call: "Distributed(x, dist)",
        description:
          "an inert binding — `x` follows `dist`. Stays itself under evaluation; only [[Expectation]]/[[Probability]] read it.",
        library: "enumeratio-statistics",
      },
    ],
    details: [
      "Wolfram's own infix `x \\[Distributed] dist` parses to exactly this call. Only the second argument of [[Expectation]]/[[Probability]] is read as a `Distributed` binding — elsewhere it is just an inert expression.",
      "The first argument is read structurally (it must be a symbol) rather than type-checked — compute-engine PINS a parameter typed literally `symbol` onto that symbol's inferred type globally, breaking later unrelated uses of the same name (confirmed empirically); typing it `any` here avoids that.",
    ],
    examples: [
      {
        id: "distributed-stays-itself",
        expr: ["Distributed", "x", ["NormalDistribution", 0, 1]],
        expected: ["Distributed", "x", ["NormalDistribution", 0, 1]],
      },
      {
        id: "distributed-reached-through-expectation",
        expr: ["Expectation", "x", ["Distributed", "x", ["NormalDistribution", 2, 3]]],
        expected: 2,
        category: "Scope",
        caption: "Read by [[Expectation]] — see there for the general behavior",
      },
    ],
    seeAlso: ["Expectation", "Probability"],
  },
  {
    name: "BetaDistribution",
    domain: "Statistics",
    signature: "BetaDistribution(alpha, beta)",
    summary: "The Beta distribution on $[0, 1]$ with shape parameters $\\alpha, \\beta$.",
    signatures: [
      {
        call: "BetaDistribution(alpha, beta)",
        description:
          "an inert distribution object — carries its parameters, unevaluated. [[PDF]], [[CDF]], [[Mean]], [[Variance]] and [[RandomVariate]] all read it.",
        library: "enumeratio-statistics",
      },
    ],
    details: [
      "$PDF(x) = \\dfrac{x^{\\alpha-1}(1-x)^{\\beta-1}}{B(\\alpha,\\beta)}$, via [[Beta]]. No domain clamp outside $[0,1]$ — the formula is evaluated as written there too.",
      "$CDF(x) = I_x(\\alpha,\\beta)$ via [[BetaRegularized]], clamped to $0$ below $x=0$ and $1$ above $x=1$.",
      "$Mean = \\dfrac{\\alpha}{\\alpha+\\beta}$, $Variance = \\dfrac{\\alpha\\beta}{(\\alpha+\\beta)^2(\\alpha+\\beta+1)}$, both exact.",
      "[[RandomVariate]] samples via two [[GammaDistribution]] draws (Marsaglia–Tsang), $X/(X+Y)$ — see [[RandomVariate]] for the seeded-PRNG divergence from Wolfram.",
    ],
    examples: [
      {
        id: "beta-pdf-exact",
        expr: ["PDF", ["BetaDistribution", 2, 3], ["Rational", 1, 2]],
        expected: ["Rational", 3, 2],
      },
      {
        id: "beta-cdf-exact",
        expr: ["CDF", ["BetaDistribution", 2, 3], ["Rational", 1, 2]],
        expected: ["BetaRegularized", ["Rational", 1, 2], 2, 3],
        caption:
          "$= 0.6875$, cross-checked against wolframscript's `N[CDF[BetaDistribution[2,3],1/2]]`",
      },
      {
        id: "beta-mean-exact",
        expr: ["Mean", ["BetaDistribution", 2, 3]],
        expected: ["Rational", 2, 5],
      },
      {
        id: "beta-variance-exact",
        expr: ["Variance", ["BetaDistribution", 2, 3]],
        expected: ["Rational", 1, 25],
        caption:
          "Cross-checked against wolframscript's `N[Variance[BetaDistribution[2,3]]] = 0.04`",
      },
      {
        id: "beta-cdf-clamps-below-support",
        expr: ["N", ["CDF", ["BetaDistribution", 2, 3], -1]],
        expected: 0,
        category: "Possible issues",
      },
    ],
    seeAlso: ["GammaDistribution", "PDF", "CDF", "RandomVariate"],
  },
  {
    name: "GammaDistribution",
    domain: "Statistics",
    signature: "GammaDistribution(k, theta)",
    summary: "The Gamma distribution with shape $k$ and scale $\\theta$.",
    signatures: [
      {
        call: "GammaDistribution(k, theta)",
        description: "an inert distribution object with shape $k$ and scale $\\theta$.",
        library: "enumeratio-statistics",
      },
      {
        call: "GammaDistribution(k)",
        description:
          "scale defaults to $1$. NOT a Wolfram call form — `GammaDistribution[alpha]` alone errors there (`GammaDistribution::argbu`, confirmed against wolframscript); this is our own convenience.",
        library: "enumeratio-statistics",
      },
    ],
    details: [
      "$PDF(x) = \\dfrac{x^{k-1}e^{-x/\\theta}}{\\theta^k\\,\\Gamma(k)}$, via [[Gamma]]. No domain clamp outside $x \\ge 0$.",
      "$CDF(x) = 1 - Q(k, x/\\theta)$ via the native two-argument [[GammaRegularized]] (not the three-argument generalized form `@enumeratio/analytic` adds — this has no dependency on that package), clamped to $0$ below $x=0$.",
      "$Mean = k\\theta$, $Variance = k\\theta^2$, both exact.",
      "[[RandomVariate]] samples via Marsaglia–Tsang (shape $\\ge 1$; boosted via a $Gamma(k+1)$ draw scaled by $U^{1/k}$ below $1$) — see [[RandomVariate]] for the seeded-PRNG divergence from Wolfram.",
    ],
    examples: [
      {
        id: "gamma-distribution-one-argument-defaults-scale",
        expr: ["GammaDistribution", 2],
        expected: ["GammaDistribution", 2, 1],
        category: "Scope",
      },
      {
        id: "gamma-pdf-exact",
        expr: ["PDF", ["GammaDistribution", 2, 2], 3],
        expected: [
          "Divide",
          3,
          ["Multiply", 4, ["Gamma", 2], ["Power", "ExponentialE", ["Rational", 3, 2]]],
        ],
        caption:
          "$\\approx 0.16734762011132237$, cross-checked against wolframscript's `N[PDF[GammaDistribution[2,2],3]]`",
      },
      {
        id: "gamma-cdf-exact",
        expr: ["CDF", ["GammaDistribution", 2, 2], 3],
        expected: [
          "Add",
          1,
          ["Divide", -5, ["Multiply", 2, ["Power", "ExponentialE", ["Rational", 3, 2]]]],
        ],
        caption:
          "$\\approx 0.44217459962892543$, cross-checked against wolframscript's `N[CDF[GammaDistribution[2,2],3]] = 0.4421745996289253`",
      },
      { id: "gamma-mean-exact", expr: ["Mean", ["GammaDistribution", 2, 2]], expected: 4 },
      { id: "gamma-variance-exact", expr: ["Variance", ["GammaDistribution", 2, 2]], expected: 8 },
      {
        id: "gamma-cdf-clamps-below-support",
        expr: ["N", ["CDF", ["GammaDistribution", 2, 2], -1]],
        expected: 0,
        category: "Possible issues",
      },
    ],
    seeAlso: ["BetaDistribution", "PDF", "CDF", "RandomVariate"],
  },
  {
    name: "BinormalDistribution",
    domain: "Statistics",
    signature: "BinormalDistribution(rho)",
    summary: "The bivariate normal distribution over pairs $(x_1, x_2)$.",
    signatures: [
      {
        call: "BinormalDistribution(rho)",
        description: "correlation $\\rho$ only — mean $(0,0)$, unit variances.",
        library: "enumeratio-statistics",
      },
      {
        call: "BinormalDistribution({sigma1, sigma2}, rho)",
        description: "standard deviations and correlation — mean $(0,0)$.",
        library: "enumeratio-statistics",
      },
      {
        call: "BinormalDistribution({mu1, mu2}, {sigma1, sigma2}, rho)",
        description: "the general form — mean, standard deviations, correlation.",
        library: "enumeratio-statistics",
      },
    ],
    details: [
      "[[PDF]] at a point $\\{x_1, x_2\\}$ is the usual bivariate normal density, exact.",
      "[[CDF]] has no elementary closed form here (Owen's T / a two-dimensional integral) — [[CDF]] stays unevaluated for `BinormalDistribution`, a documented gap rather than an approximation.",
      "[[Mean]] is the mean vector $\\{\\mu_1, \\mu_2\\}$; [[Variance]] is the covariance matrix $\\{\\{\\sigma_1^2, \\rho\\sigma_1\\sigma_2\\}, \\{\\rho\\sigma_1\\sigma_2, \\sigma_2^2\\}\\}$, both exact.",
      "[[RandomVariate]] draws two independent standard normals and combines them ($x_1=\\mu_1+\\sigma_1 z_1$, $x_2=\\mu_2+\\sigma_2(\\rho z_1+\\sqrt{1-\\rho^2}z_2)$) — see [[RandomVariate]] for the seeded-PRNG divergence from Wolfram.",
    ],
    examples: [
      {
        id: "binormal-pdf-rho-only-form",
        expr: ["PDF", ["BinormalDistribution", ["Rational", 1, 2]], ["List", 0, 0]],
        expected: ["Divide", ["Sqrt", 3], ["Multiply", 3, "Pi"]],
        caption:
          "$\\approx 0.18377629847393068$, cross-checked against wolframscript's `N[PDF[BinormalDistribution[1/2],{0,0}]]`",
      },
      {
        id: "binormal-mean-is-the-mean-vector",
        expr: [
          "Mean",
          ["BinormalDistribution", ["List", 1, 2], ["List", 1, 1], ["Rational", 1, 2]],
        ],
        expected: ["List", 1, 2],
      },
      {
        id: "binormal-variance-is-the-covariance-matrix",
        expr: ["Variance", ["BinormalDistribution", ["Rational", 1, 2]]],
        expected: ["List", ["List", 1, ["Rational", 1, 2]], ["List", ["Rational", 1, 2], 1]],
      },
      {
        id: "binormal-cdf-has-no-closed-form",
        expr: ["CDF", ["BinormalDistribution", ["Rational", 1, 2]], ["List", 0, 0]],
        expected: ["CDF", ["BinormalDistribution", ["Rational", 1, 2]], ["List", 0, 0]],
        category: "Possible issues",
        caption: "Stays unevaluated — no closed form is implemented",
      },
    ],
    seeAlso: ["NormalDistribution", "PDF", "Mean", "Variance"],
  },
  {
    name: "EmpiricalDistribution",
    domain: "Statistics",
    signature: "EmpiricalDistribution(data)",
    summary: "The distribution of the values actually observed in `data`.",
    signatures: [
      {
        call: "EmpiricalDistribution(data)",
        description: "an inert distribution object wrapping `data` (a list).",
        library: "enumeratio-statistics",
      },
    ],
    details: [
      "[[PDF]]/[[CDF]] at $x$ are the observed PROPORTIONS — the count of `data` equal to (resp. at most) $x$, divided by its length. Wolfram's own `PDF` is a continuous, kernel-smoothed density; this is a discrete empirical measure instead, a documented divergence.",
      "[[Mean]]/[[Variance]] delegate to [[Mean]]/[[Variance]] of `data` itself (sample variance, $n-1$) — the same convention Wolfram's `Variance[EmpiricalDistribution[data]] = Variance[data]` uses.",
      "[[RandomVariate]] resamples uniformly from `data`, with replacement.",
    ],
    examples: [
      {
        id: "empirical-pdf-is-the-observed-proportion",
        expr: ["PDF", ["EmpiricalDistribution", ["List", 1, 2, 2, 3]], 2],
        expected: ["Rational", 1, 2],
        caption: "2 of the 4 elements are 2",
      },
      {
        id: "empirical-cdf-is-the-observed-proportion-at-most",
        expr: ["CDF", ["EmpiricalDistribution", ["List", 1, 2, 2, 3]], 2],
        expected: ["Rational", 3, 4],
      },
      {
        id: "empirical-mean-matches-mean-of-the-data",
        expr: ["Mean", ["EmpiricalDistribution", ["List", 1, 2, 2, 3]]],
        expected: 2,
      },
      {
        id: "empirical-variance-matches-variance-of-the-data",
        expr: ["Variance", ["EmpiricalDistribution", ["List", 1, 2, 2, 3]]],
        expected: ["Rational", 2, 3],
      },
    ],
    seeAlso: ["Mean", "Variance", "RandomVariate"],
  },
  {
    name: "RandomVariate",
    domain: "Statistics",
    signature: "RandomVariate(dist, n)",
    summary: "A random draw from a distribution, or a list of them.",
    signatures: [
      { call: "RandomVariate(dist)", description: "one draw.", library: "enumeratio-statistics" },
      {
        call: "RandomVariate(dist, n)",
        description: "a list of $n$ draws.",
        library: "enumeratio-statistics",
      },
    ],
    details: [
      "Seeded, not free-running — same convention as [[SeedRandom]]/`RandomInteger` in `@enumeratio/collections`: call [[SeedRandom]](seed) first for a reproducible sequence; without it, a fixed default seed makes even a bare call reproducible run to run. This file's draws are their OWN stream, independent of `RandomInteger`'s, even after the same [[SeedRandom]] call — a follow-up once collections' own seeded `RandomInteger` lands is to unify both under one engine-level generator.",
      "The generator is our own (mulberry32, the same algorithm `RandomInteger` uses), not Wolfram's — the same seed draws a different sequence. Only the shape and (for `NormalDistribution`/`UniformDistribution`/…) approximate range of the answer are guaranteed to match.",
      "Sampling method by distribution — [[NormalDistribution]]/[[BinormalDistribution]]: Box–Muller; [[UniformDistribution]]: inverse CDF; [[PoissonDistribution]]: Knuth's algorithm; [[BinomialDistribution]]: a sum of Bernoulli draws; [[GammaDistribution]]/[[BetaDistribution]]: Marsaglia–Tsang; [[EmpiricalDistribution]]: uniform resampling with replacement.",
    ],
    examples: [
      {
        id: "randomvariate-default-seed-is-reproducible",
        expr: ["RandomVariate", ["NormalDistribution", 0, 1]],
        expected: -0.956162229384149,
        caption: "With no [[SeedRandom]] call, a fixed default seed still makes this reproducible",
      },
      {
        id: "randomvariate-n-draws",
        expr: [
          "Last",
          [
            "List",
            ["SeedRandom", 1],
            ["RandomVariate", ["UniformDistribution", ["List", 0, 1]], 3],
          ],
        ],
        expected: ["List", 0.6270739405881613, 0.002735721180215478, 0.5274470399599522],
        category: "Scope",
      },
      {
        id: "randomvariate-discrete-draw",
        expr: ["Last", ["List", ["SeedRandom", 1], ["RandomVariate", ["PoissonDistribution", 4]]]],
        expected: 1,
        category: "Scope",
      },
      {
        id: "randomvariate-empirical-resamples-the-data",
        expr: [
          "Last",
          [
            "List",
            ["SeedRandom", 2],
            ["RandomVariate", ["EmpiricalDistribution", ["List", "a", "b", "c"]]],
          ],
        ],
        expected: "c",
        category: "Scope",
      },
    ],
    seeAlso: ["SeedRandom", "Distributed"],
  },
  {
    name: "Expectation",
    domain: "Statistics",
    signature: "Expectation(f, x \\[Distributed] dist)",
    summary: "$E[f(x)]$ — the expected value of `f` under `x`'s distribution.",
    signatures: [
      {
        call: "Expectation(f, Distributed(x, dist))",
        description:
          "exact for `f` constant, linear or quadratic in `x`; otherwise stays unevaluated.",
        library: "enumeratio-statistics",
      },
    ],
    details: [
      "Closed forms: $E[c] = c$; $E[x] = Mean(dist)$; $E[x^2] = Variance(dist) + Mean(dist)^2$; extended over `Add` and `Multiply`-by-constant by linearity — $E[2x+1] = 2\\,E[x]+1$, and so on, recursively.",
      "Never approximated on its own — apply `N` to the result for a numeric value.",
      "Anything past a linear/quadratic polynomial in `x` (e.g. $E[\\sin x]$) has no closed form here and stays unevaluated, rather than falling back to numeric integration.",
    ],
    examples: [
      {
        id: "expectation-of-the-bound-variable-is-the-mean",
        expr: ["Expectation", "x", ["Distributed", "x", ["NormalDistribution", 2, 3]]],
        expected: 2,
      },
      {
        id: "expectation-of-x-squared",
        expr: [
          "Expectation",
          ["Power", "x", 2],
          ["Distributed", "x", ["NormalDistribution", 2, 3]],
        ],
        expected: 13,
        caption: "$Var + Mean^2 = 9 + 4$",
      },
      {
        id: "expectation-is-linear",
        expr: [
          "Expectation",
          ["Add", ["Multiply", 2, "x"], 1],
          ["Distributed", "x", ["NormalDistribution", 2, 3]],
        ],
        expected: 5,
      },
      {
        id: "a-shape-with-no-closed-form-stays-unevaluated",
        expr: ["Expectation", ["Sin", "x"], ["Distributed", "x", ["NormalDistribution", 2, 3]]],
        expected: ["Expectation", ["Sin", "x"], ["Distributed", "x", ["NormalDistribution", 2, 3]]],
        category: "Possible issues",
      },
    ],
    seeAlso: ["Distributed", "Probability", "Mean"],
  },
  {
    name: "Probability",
    domain: "Statistics",
    signature: "Probability(cond, x \\[Distributed] dist)",
    summary: "$P(cond)$ under `x`'s distribution.",
    signatures: [
      {
        call: "Probability(cond, Distributed(x, dist))",
        description:
          "exact for `Equal`/`Less`/`LessEqual` conditions on `x` (a chained range too); otherwise stays unevaluated.",
        library: "enumeratio-statistics",
      },
    ],
    details: [
      "`Equal(x, k)`: [[PDF]]$(k)$ for a discrete distribution, $0$ for a continuous one.",
      "`LessEqual(x, k)`: [[CDF]]$(k)$. `Less(x, k)`: $CDF(k) - PDF(k)$ for discrete (subtracting $P(X{=}k)$), just $CDF(k)$ for continuous (where a point has probability $0$). A constant on the LEFT (`k \\[LessEqual] x`) is the complement of the opposite strict relation.",
      "A chained range, `a \\[LessEqual] x \\[LessEqual] b` (and the `Less`/mixed forms), and `And` of two simple relations on `x`: composed from the primitives above by inclusion–exclusion.",
      "`Greater`/`GreaterEqual` need no separate handling — compute-engine's own canonicalization rewrites `x > k` to `Less(k, x)` before this ever sees it.",
    ],
    examples: [
      {
        id: "probability-equal-is-pdf-for-discrete",
        expr: ["Probability", ["Equal", "x", 2], ["Distributed", "x", ["PoissonDistribution", 3]]],
        expected: ["Divide", 9, ["Multiply", 2, ["Power", "ExponentialE", 3]]],
      },
      {
        id: "probability-equal-is-zero-for-continuous",
        expr: [
          "Probability",
          ["Equal", "x", 2],
          ["Distributed", "x", ["NormalDistribution", 0, 1]],
        ],
        expected: 0,
      },
      {
        id: "probability-lessequal-is-cdf",
        expr: [
          "Probability",
          ["LessEqual", "x", 5],
          ["Distributed", "x", ["PoissonDistribution", 3]],
        ],
        expected: ["Divide", 92, ["Multiply", 5, ["Power", "ExponentialE", 3]]],
        caption:
          "$\\approx 0.9160820579686966$, cross-checked against wolframscript's `N[CDF[PoissonDistribution[3],5]]`",
      },
      {
        id: "probability-of-a-chained-range",
        expr: [
          "Probability",
          ["And", ["LessEqual", 1, "x"], ["LessEqual", "x", 5]],
          ["Distributed", "x", ["PoissonDistribution", 3]],
        ],
        expected: ["Divide", 87, ["Multiply", 5, ["Power", "ExponentialE", 3]]],
        category: "Scope",
        caption:
          "$\\approx 0.8662949896008326$, cross-checked against wolframscript's `N[Probability[1<=x<=5, x \\[Distributed] PoissonDistribution[3]]]`",
      },
      {
        id: "probability-greater-is-canonicalized-first",
        expr: [
          "N",
          ["Probability", ["Greater", "x", 0], ["Distributed", "x", ["NormalDistribution", 0, 1]]],
        ],
        expected: 0.5,
        category: "Scope",
        caption: "compute-engine rewrites `x > 0` to `Less(0, x)` before this evaluator sees it",
      },
    ],
    seeAlso: ["Distributed", "Expectation", "CDF"],
  },
];
