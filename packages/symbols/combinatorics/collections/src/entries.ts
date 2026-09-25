// GENERATED from YAML by packages/reference/scripts/migrate/shims.ts -- do not edit.
// Edit the YAML named in `sources`, then run `node packages/reference/scripts/migrate/shims.ts`.

import type { ReferenceEntry } from "@enumeratio/entry";

/** The YAML each entry below was generated from, in the same order. */
export const sources: readonly string[] = [
  "packages/symbols/combinatorics/collections/reference/Subsets.yaml",
  "packages/symbols/combinatorics/collections/reference/KSubsets.yaml",
  "packages/symbols/combinatorics/collections/reference/Multisets.yaml",
  "packages/symbols/combinatorics/collections/reference/Tuples.yaml",
  "packages/symbols/combinatorics/collections/reference/SymmetricGroup.yaml",
  "packages/symbols/combinatorics/collections/reference/Derangements.yaml",
  "packages/symbols/combinatorics/collections/reference/Involutions.yaml",
  "packages/symbols/combinatorics/collections/reference/IntegerPartitions.yaml",
  "packages/symbols/combinatorics/collections/reference/IntegerCompositions.yaml",
  "packages/symbols/combinatorics/collections/reference/SetPartitions.yaml",
  "packages/symbols/combinatorics/collections/reference/DyckPaths.yaml",
  "packages/symbols/combinatorics/collections/reference/BinaryTrees.yaml",
  "packages/symbols/combinatorics/collections/reference/Inversions.yaml",
  "packages/symbols/combinatorics/collections/reference/Descents.yaml",
  "packages/symbols/combinatorics/collections/reference/Ascents.yaml",
  "packages/symbols/combinatorics/collections/reference/MajorIndex.yaml",
  "packages/symbols/combinatorics/collections/reference/FixedPoints.yaml",
  "packages/symbols/combinatorics/collections/reference/CycleCount.yaml",
  "packages/symbols/combinatorics/collections/reference/Excedances.yaml",
  "packages/symbols/combinatorics/collections/reference/Antiexcedances.yaml",
  "packages/symbols/combinatorics/collections/reference/Records.yaml",
  "packages/symbols/combinatorics/collections/reference/Peaks.yaml",
  "packages/symbols/combinatorics/collections/reference/Valleys.yaml",
  "packages/symbols/combinatorics/collections/reference/MinorIndex.yaml",
  "packages/symbols/combinatorics/collections/reference/Array.yaml",
  "packages/symbols/combinatorics/collections/reference/Accumulate.yaml",
  "packages/symbols/combinatorics/collections/reference/FoldList.yaml",
  "packages/symbols/combinatorics/collections/reference/Cases.yaml",
  "packages/symbols/combinatorics/collections/reference/SparseArray.yaml",
  "packages/symbols/combinatorics/collections/reference/RandomInteger.yaml",
  "packages/symbols/combinatorics/collections/reference/SeedRandom.yaml",
  "packages/symbols/combinatorics/collections/reference/IsNumeric.yaml",
  "packages/symbols/combinatorics/collections/reference/IsMachineNumber.yaml",
  "packages/symbols/combinatorics/collections/reference/Precision.yaml",
  "packages/symbols/combinatorics/collections/reference/Thread.yaml",
  "packages/symbols/combinatorics/collections/reference/MapAt.yaml",
  "packages/symbols/combinatorics/collections/reference/Normalize.yaml",
  "packages/symbols/combinatorics/collections/reference/Surd.yaml",
  "packages/symbols/combinatorics/collections/reference/LetterNumber.yaml",
  "packages/symbols/combinatorics/collections/reference/FactorialPower.yaml",
  "packages/symbols/combinatorics/collections/reference/DifferenceDelta.yaml",
  "packages/symbols/combinatorics/collections/reference/HankelMatrix.yaml",
  "packages/symbols/combinatorics/collections/reference/MovingMap.yaml",
  "packages/symbols/combinatorics/collections/reference/PascalBinomial.yaml",
  "packages/symbols/combinatorics/collections/reference/CellularAutomaton.yaml",
];

export const entries: readonly ReferenceEntry[] = [
  {
    name: "Subsets",
    domain: "Combinatorial collections",
    signature: "Subsets(n)",
    summary:
      "The lazy power set of $\\{1, \\dots, n\\}$: all $2^n$ subsets as ascending index lists.",
    signatures: [
      {
        call: "Subsets(n)",
        description: "all subsets of $\\{1, \\dots, n\\}$",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "There are $2^n$ subsets, so $\\mathrm{Count}$ is $2^n$",
      "Subsets are ordered by the binary value of their membership mask, so the empty set comes first",
      "For a fixed size use [[KSubsets]]",
    ],
    examples: [
      {
        id: "2-4-subsets",
        expr: ["Count", ["Subsets", 4]],
        expected: 16,
        caption: "$2^4$ subsets",
      },
      {
        id: "the-empty-subset",
        expr: ["At", ["Subsets", 3], 1],
        expected: ["List"],
        caption: "the empty subset",
      },
    ],
    seeAlso: ["KSubsets", "Multisets", "Tuples"],
  },
  {
    name: "KSubsets",
    domain: "Combinatorial collections",
    signature: "KSubsets(n, k)",
    summary:
      "The k-element subsets of $\\{1, \\dots, n\\}$ in COLEXICOGRAPHIC order (the combinations) — the order the combinatorial number system ranks them in.",
    signatures: [
      {
        call: "KSubsets(n, k)",
        description: "the $\\binom{n}{k}$ subsets of size $k$",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Count is the binomial coefficient $\\binom{n}{k}$",
      "Elements are the k-combinations in COLEXICOGRAPHIC order: compare the largest element first, so $\\{2,3\\}$ precedes $\\{1,4\\}$",
      "That is the order [[IntegerDigits]] with `CombinatorialNumerals(k)` unranks in — the two are the same map",
      "$k = 0$ gives the single empty subset; $k > n$ gives an empty family",
    ],
    examples: [
      {
        id: "binom-5-2",
        expr: ["Count", ["KSubsets", 5, 2]],
        expected: 10,
        caption: "$\\binom{5}{2}$",
      },
      { id: "ksubsets-5-2-list-1", expr: ["At", ["KSubsets", 5, 2], 1], expected: ["List", 1, 2] },
      {
        id: "colex-not-lex-lexicographic-order-would-give-1-4",
        expr: ["At", ["KSubsets", 5, 2], 3],
        expected: ["List", 2, 3],
        caption: "colex, not lex — lexicographic order would give $\\{1,4\\}$",
        category: "Properties",
      },
    ],
    seeAlso: ["Subsets", "Multisets", "Binomial"],
  },
  {
    name: "Multisets",
    domain: "Combinatorial collections",
    signature: "Multisets(n, k)",
    summary: "The size-k multisets drawn from $\\{1, \\dots, n\\}$ (combinations with repetition).",
    signatures: [
      {
        call: "Multisets(n, k)",
        description: "size-$k$ multisets over $n$ symbols",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Count is $\\binom{n + k - 1}{k}$, the number of combinations with repetition",
      "Each element is a non-decreasing length-$k$ list",
    ],
    examples: [
      {
        id: "binom-4-2",
        expr: ["Count", ["Multisets", 3, 2]],
        expected: 6,
        caption: "$\\binom{4}{2}$",
      },
    ],
    seeAlso: ["KSubsets", "Tuples"],
  },
  {
    name: "Tuples",
    domain: "Combinatorial collections",
    signature: "Tuples(n, k)",
    summary:
      "The k-tuples over $\\{1, \\dots, n\\}$: all $n^k$ ordered selections with repetition.",
    signatures: [
      {
        call: "Tuples(n, k)",
        description: "the $n^k$ length-$k$ tuples",
        library: "enumeratio-collections",
      },
    ],
    details: ["Count is $n^k$", "Elements are ordered as mixed-radix (base $n$) counting"],
    examples: [
      { id: "2-3", expr: ["Count", ["Tuples", 2, 3]], expected: 8, caption: "$2^3$" },
      { id: "tuples-2-3-list-1", expr: ["At", ["Tuples", 2, 3], 1], expected: ["List", 1, 1, 1] },
    ],
    seeAlso: ["Subsets", "Multisets"],
  },
  {
    name: "SymmetricGroup",
    domain: "Combinatorial collections",
    signature: "SymmetricGroup(n)",
    summary: "The permutations of $\\{1, \\dots, n\\}$ as one-line words, all $n!$ of them.",
    signatures: [
      {
        call: "SymmetricGroup(n)",
        description: "the $n!$ permutations of $n$ elements",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Count is $n!$ (see [[Factorial]])",
      "Elements are one-line words in lexicographic order; the identity comes first",
      "Fixed-point-free permutations are [[Derangements]]; self-inverse ones are [[Involutions]]",
    ],
    examples: [
      { id: "4", expr: ["Count", ["SymmetricGroup", 4]], expected: 24, caption: "$4!$" },
      {
        id: "the-identity",
        expr: ["At", ["SymmetricGroup", 3], 1],
        expected: ["List", 1, 2, 3],
        caption: "the identity",
      },
    ],
    seeAlso: ["Derangements", "Involutions", "Factorial"],
  },
  {
    name: "Derangements",
    domain: "Combinatorial collections",
    signature: "Derangements(n)",
    summary: "The permutations of $\\{1, \\dots, n\\}$ with no fixed point.",
    signatures: [
      {
        call: "Derangements(n)",
        description: "the fixed-point-free permutations of $n$ elements",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Count is the subfactorial $!n$ (see [[Subfactorial]])",
      "A sub-family of [[SymmetricGroup]]",
    ],
    examples: [{ id: "4", expr: ["Count", ["Derangements", 4]], expected: 9, caption: "$!4$" }],
    seeAlso: ["SymmetricGroup", "Involutions", "Subfactorial"],
  },
  {
    name: "Involutions",
    domain: "Combinatorial collections",
    signature: "Involutions(n)",
    summary:
      "The self-inverse permutations of $\\{1, \\dots, n\\}$ (only fixed points and 2-cycles).",
    signatures: [
      {
        call: "Involutions(n)",
        description: "the self-inverse permutations of $n$ elements",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Count satisfies $a(n) = a(n-1) + (n-1)\\,a(n-2)$",
      "A sub-family of [[SymmetricGroup]]",
    ],
    examples: [{ id: "count-involutions-4", expr: ["Count", ["Involutions", 4]], expected: 10 }],
    seeAlso: ["SymmetricGroup", "Derangements"],
  },
  {
    name: "IntegerPartitions",
    domain: "Combinatorial collections",
    signature: "IntegerPartitions(n)",
    summary: "The partitions of the integer $n$ into unordered positive parts.",
    signatures: [
      {
        call: "IntegerPartitions(n)",
        description: "the partitions of $n$ into positive parts",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Count is the partition function $p(n)$",
      "Each element is a weakly decreasing list of parts summing to $n$",
      "When order matters, use [[IntegerCompositions]]",
    ],
    examples: [
      { id: "p-6", expr: ["Count", ["IntegerPartitions", 6]], expected: 11, caption: "$p(6)$" },
      {
        id: "the-single-part-6",
        expr: ["At", ["IntegerPartitions", 6], 1],
        expected: ["List", 6],
        caption: "the single part $6$",
      },
    ],
    seeAlso: ["IntegerCompositions", "SetPartitions"],
  },
  {
    name: "IntegerCompositions",
    domain: "Combinatorial collections",
    signature: "IntegerCompositions(n)",
    summary: "The compositions of $n$: ordered sequences of positive parts summing to $n$.",
    signatures: [
      {
        call: "IntegerCompositions(n)",
        description: "the ordered compositions of $n$",
        library: "enumeratio-collections",
      },
    ],
    details: ["Count is $2^{n-1}$ for $n \\ge 1$", "Unlike [[IntegerPartitions]], order matters"],
    examples: [
      { id: "2-4", expr: ["Count", ["IntegerCompositions", 5]], expected: 16, caption: "$2^{4}$" },
    ],
    seeAlso: ["IntegerPartitions"],
  },
  {
    name: "SetPartitions",
    domain: "Combinatorial collections",
    signature: "SetPartitions(n)",
    summary: "The partitions of the set $\\{1, \\dots, n\\}$ into unordered non-empty blocks.",
    signatures: [
      {
        call: "SetPartitions(n)",
        description: "the partitions of an $n$-set into blocks",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Count is the Bell number $B_n$ (see [[BellNumber]])",
      "Each element is a list of blocks (a list of index lists)",
    ],
    examples: [
      { id: "b-4", expr: ["Count", ["SetPartitions", 4]], expected: 15, caption: "$B_4$" },
    ],
    seeAlso: ["IntegerPartitions", "BellNumber"],
  },
  {
    name: "DyckPaths",
    domain: "Combinatorial collections",
    signature: "DyckPaths(n)",
    summary:
      "The Dyck paths of semilength $n$: balanced up/down step sequences that stay non-negative.",
    signatures: [
      {
        call: "DyckPaths(n)",
        description: "the Dyck paths of semilength $n$",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Count is the Catalan number $C_n$ (see [[CatalanNumber]])",
      "Each element is a 0/1 step sequence with every prefix having at least as many 1s as 0s",
    ],
    examples: [
      { id: "c-3", expr: ["Count", ["DyckPaths", 3]], expected: 5, caption: "$C_3$" },
      {
        id: "three-ups-then-three-downs",
        expr: ["At", ["DyckPaths", 3], 1],
        expected: ["List", 1, 1, 1, 0, 0, 0],
        caption: "three ups then three downs",
      },
    ],
    seeAlso: ["BinaryTrees", "CatalanNumber"],
  },
  {
    name: "BinaryTrees",
    domain: "Combinatorial collections",
    signature: "BinaryTrees(n)",
    summary: "The binary trees with $n$ internal nodes, as nested lists.",
    signatures: [
      {
        call: "BinaryTrees(n)",
        description: "the binary trees with $n$ internal nodes",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Count is the Catalan number $C_n$ (see [[CatalanNumber]])",
      "In bijection with [[DyckPaths]] of the same semilength",
    ],
    examples: [{ id: "c-4", expr: ["Count", ["BinaryTrees", 4]], expected: 14, caption: "$C_4$" }],
    seeAlso: ["DyckPaths", "CatalanNumber"],
  },
  {
    name: "Inversions",
    domain: "Permutation statistics",
    signature: "Inversions(p)",
    summary:
      "The number of inversions of a permutation $p$: pairs $i < j$ with $p_i > p_j$ (its Kendall-tau distance from the identity).",
    signatures: [
      {
        call: "Inversions(p)",
        description: "the inversion count of a one-line permutation $p$",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Ranges from $0$ (the identity) to $\\binom{n}{2}$ (the reversal $n, n-1, \\dots, 1$)",
      "Generating function over $S_n$ is the q-factorial $[n]_q! = \\prod_{i=1}^{n} \\frac{1 - q^i}{1 - q}$",
      "Equidistributed with [[MajorIndex]] on $S_n$ (MacMahon), so both are Mahonian statistics",
      "Aggregates over a whole collection compose from built-ins: $\\mathrm{Sum}(\\mathrm{Map}(\\mathrm{Inversions}, \\mathrm{SymmetricGroup}(n)))$ folds the stat over the lazy family",
    ],
    examples: [
      {
        id: "3-1-and-3-2",
        expr: ["Inversions", ["List", 3, 1, 2]],
        expected: 2,
        caption: "$(3,1)$ and $(3,2)$",
      },
      {
        id: "the-identity-has-none",
        expr: ["Inversions", ["List", 1, 2, 3]],
        expected: 0,
        caption: "the identity has none",
      },
      {
        id: "the-reversal-attains-the-maximum-binom-4-2",
        expr: ["Inversions", ["List", 4, 3, 2, 1]],
        expected: 6,
        category: "Properties",
        caption: "the reversal attains the maximum $\\binom{4}{2}$",
      },
      {
        id: "the-inversion-distribution-over-s-3-mapped",
        expr: ["ListFrom", ["Map", ["Function", ["Inversions", "p"], "p"], ["SymmetricGroup", 3]]],
        expected: ["List", 0, 1, 1, 2, 2, 3],
        category: "Applications",
        caption: "the inversion distribution over $S_3$, mapped across the lazy [[SymmetricGroup]]",
      },
      {
        id: "total-inversions-over-all-of-s-4-folded-with-sum",
        expr: ["Sum", ["Map", ["Function", ["Inversions", "p"], "p"], ["SymmetricGroup", 4]]],
        expected: 72,
        category: "Applications",
        caption:
          "total inversions over all of $S_4$, folded with $\\mathrm{Sum}$: $\\frac{n!}{2}\\binom{n}{2} = 72$",
      },
    ],
    seeAlso: ["MajorIndex", "Descents", "SymmetricGroup"],
  },
  {
    name: "Descents",
    domain: "Permutation statistics",
    signature: "Descents(p)",
    summary: "The number of descents of $p$: positions $i$ with $p_i > p_{i+1}$.",
    signatures: [
      {
        call: "Descents(p)",
        description: "the descent count of a one-line permutation $p$",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "The permutations of $\\{1, \\dots, n\\}$ with $k$ descents are counted by the Eulerian number $\\left\\langle{n\\atop k}\\right\\rangle$",
      "Complementary to [[Ascents]]: every adjacent pair is one or the other, so $\\mathrm{Descents} + \\mathrm{Ascents} = n - 1$",
    ],
    examples: [
      {
        id: "only-3-1",
        expr: ["Descents", ["List", 3, 1, 2]],
        expected: 1,
        caption: "only $3 > 1$",
      },
      {
        id: "every-step-falls",
        expr: ["Descents", ["List", 3, 2, 1]],
        expected: 2,
        caption: "every step falls",
      },
      {
        id: "descents-and-ascents-partition-the-n-1-steps",
        expr: [
          "Equal",
          ["Add", ["Descents", ["List", 3, 1, 2]], ["Ascents", ["List", 3, 1, 2]]],
          2,
        ],
        expected: "True",
        category: "Properties",
        caption: "descents and ascents partition the $n - 1$ steps",
      },
    ],
    seeAlso: ["Ascents", "MajorIndex", "SymmetricGroup"],
  },
  {
    name: "Ascents",
    domain: "Permutation statistics",
    signature: "Ascents(p)",
    summary: "The number of ascents of $p$: positions $i$ with $p_i < p_{i+1}$.",
    signatures: [
      {
        call: "Ascents(p)",
        description: "the ascent count of a one-line permutation $p$",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Complementary to [[Descents]]: $\\mathrm{Ascents} + \\mathrm{Descents} = n - 1$",
      "The identity is all-ascent, the reversal all-descent",
    ],
    examples: [
      {
        id: "only-1-2",
        expr: ["Ascents", ["List", 3, 1, 2]],
        expected: 1,
        caption: "only $1 < 2$",
      },
      {
        id: "the-identity-ascends-throughout",
        expr: ["Ascents", ["List", 1, 2, 3]],
        expected: 2,
        caption: "the identity ascends throughout",
      },
    ],
    seeAlso: ["Descents", "SymmetricGroup"],
  },
  {
    name: "MajorIndex",
    domain: "Permutation statistics",
    signature: "MajorIndex(p)",
    implementations: [
      {
        origin: "reference",
        form: "notatio",
        environment: "engine",
        expr: [
          "If",
          ["Less", ["Length", "_p"], 2],
          0,
          [
            "Sum",
            [
              "Filter",
              ["Range", 1, ["Subtract", ["Length", "_p"], 1]],
              ["Function", ["Greater", ["At", "_p", "i"], ["At", "_p", ["Add", "i", 1]]], "i"],
            ],
          ],
        ],
        note: "Checked against the implementation over every permutation of 1..6.",
      },
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/symbols/combinatorics/collections/src/stats.ts:majorIndex",
      },
    ],
    summary: "The major index of $p$: the sum of the descent positions $\\sum_{p_i > p_{i+1}} i$.",
    signatures: [
      {
        call: "MajorIndex(p)",
        description: "the major index of a one-line permutation $p$",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Introduced by MacMahon, who proved it equidistributed with [[Inversions]] over $S_n$",
      "Both are Mahonian, so their common generating function is the q-factorial $[n]_q!$",
    ],
    examples: [
      {
        id: "one-descent-at-position-1",
        expr: ["MajorIndex", ["List", 3, 1, 2]],
        expected: 1,
        caption: "one descent, at position 1",
      },
      {
        id: "descents-at-positions-1-and-2",
        expr: ["MajorIndex", ["List", 3, 2, 1]],
        expected: 3,
        caption: "descents at positions 1 and 2",
      },
      {
        id: "no-descents",
        expr: ["MajorIndex", ["List", 1, 2, 3]],
        expected: 0,
        caption: "no descents",
      },
    ],
    seeAlso: ["Inversions", "Descents", "SymmetricGroup"],
  },
  {
    name: "FixedPoints",
    domain: "Permutation statistics",
    signature: "FixedPoints(p)",
    summary: "The number of fixed points of $p$: positions $i$ with $p_i = i$.",
    signatures: [
      {
        call: "FixedPoints(p)",
        description: "the fixed-point count of a one-line permutation $p$",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "A permutation with no fixed points is a derangement (see [[Derangements]])",
      "Averaged over $S_n$ the count is exactly $1$, independent of $n$",
    ],
    examples: [
      {
        id: "only-1-is-fixed",
        expr: ["FixedPoints", ["List", 1, 3, 2]],
        expected: 1,
        caption: "only $1$ is fixed",
      },
      {
        id: "the-identity-fixes-all",
        expr: ["FixedPoints", ["List", 1, 2, 3]],
        expected: 3,
        caption: "the identity fixes all",
      },
      {
        id: "a-derangement-fixes-nothing",
        expr: ["FixedPoints", ["List", 2, 3, 1]],
        expected: 0,
        category: "Properties",
        caption: "a derangement fixes nothing",
      },
    ],
    seeAlso: ["Derangements", "CycleCount", "SymmetricGroup"],
  },
  {
    name: "CycleCount",
    domain: "Permutation statistics",
    signature: "CycleCount(p)",
    primitive: "kernel",
    implementations: [
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/symbols/combinatorics/collections/src/stats.ts:cycleCount",
        note: "Orbit traversal with a visited set — the one statistic here that does not reduce to an expression.",
      },
    ],
    summary: "The number of cycles in the disjoint-cycle decomposition of $p$.",
    signatures: [
      {
        call: "CycleCount(p)",
        description: "the cycle count of a one-line permutation $p$",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Permutations of $\\{1, \\dots, n\\}$ with $k$ cycles are counted by the unsigned Stirling number of the first kind $\\left[{n\\atop k}\\right]$ (see [[StirlingS1]])",
      "The identity is all fixed points, so it splits into $n$ singleton cycles; an $n$-cycle is a single cycle",
    ],
    examples: [
      {
        id: "the-3-cycle-1-2-3",
        expr: ["CycleCount", ["List", 2, 3, 1]],
        expected: 1,
        caption: "the 3-cycle $(1\\,2\\,3)$",
      },
      {
        id: "three-singleton-cycles",
        expr: ["CycleCount", ["List", 1, 2, 3]],
        expected: 3,
        caption: "three singleton cycles",
      },
      {
        id: "1-2-3",
        expr: ["CycleCount", ["List", 2, 1, 3]],
        expected: 2,
        caption: "$(1\\,2)(3)$",
      },
    ],
    seeAlso: ["FixedPoints", "StirlingS1", "SymmetricGroup"],
  },
  {
    name: "Excedances",
    domain: "Permutation statistics",
    signature: "Excedances(p)",
    summary: "The number of excedances of $p$: positions $i$ with $p_i > i$.",
    signatures: [
      {
        call: "Excedances(p)",
        description: "the excedance count of a one-line permutation $p$",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Equidistributed with [[Descents]] over $S_n$: both are Eulerian statistics",
      "A fixed point is neither an excedance nor an antiexcedance, so $\\mathrm{Excedances} + \\mathrm{Antiexcedances} + \\mathrm{FixedPoints} = n$",
    ],
    examples: [
      {
        id: "only-position-1-3-1",
        expr: ["Excedances", ["List", 3, 1, 2]],
        expected: 1,
        caption: "only position 1: $3 > 1$",
      },
      {
        id: "the-identity-has-none",
        expr: ["Excedances", ["List", 1, 2, 3]],
        expected: 0,
        caption: "the identity has none",
      },
      {
        id: "excedances-antiexcedances-and-fixed-points",
        expr: [
          "Equal",
          [
            "Add",
            ["Excedances", ["List", 2, 3, 1]],
            ["Antiexcedances", ["List", 2, 3, 1]],
            ["FixedPoints", ["List", 2, 3, 1]],
          ],
          3,
        ],
        expected: "True",
        category: "Properties",
        caption: "excedances, antiexcedances and fixed points partition the $n$ positions",
      },
    ],
    seeAlso: ["Antiexcedances", "Descents", "SymmetricGroup"],
  },
  {
    name: "Antiexcedances",
    domain: "Permutation statistics",
    signature: "Antiexcedances(p)",
    summary: "The number of antiexcedances of $p$: positions $i$ with $p_i < i$.",
    signatures: [
      {
        call: "Antiexcedances(p)",
        description: "the antiexcedance count of a one-line permutation $p$",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Equidistributed with [[Excedances]] over $S_n$: inverting a permutation swaps its excedance and antiexcedance counts",
      "Never counts a fixed point, same as [[Excedances]]",
    ],
    examples: [
      {
        id: "positions-2-and-3-1-2-and-2-3",
        expr: ["Antiexcedances", ["List", 3, 1, 2]],
        expected: 2,
        caption: "positions 2 and 3: $1 < 2$ and $2 < 3$",
      },
      {
        id: "the-identity-has-none",
        expr: ["Antiexcedances", ["List", 1, 2, 3]],
        expected: 0,
        caption: "the identity has none",
      },
      {
        id: "positions-3-and-4-2-3-and-1-4",
        expr: ["Antiexcedances", ["List", 4, 3, 2, 1]],
        expected: 2,
        category: "Properties",
        caption: "positions 3 and 4: $2 < 3$ and $1 < 4$",
      },
    ],
    seeAlso: ["Excedances", "Descents", "SymmetricGroup"],
  },
  {
    name: "Records",
    domain: "Permutation statistics",
    signature: "Records(p)",
    summary:
      "The number of records (left-to-right maxima) of $p$: positions $i$ with $p_i > p_j$ for all $j < i$.",
    signatures: [
      {
        call: "Records(p)",
        description: "the record count of a one-line permutation $p$",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "The first position is always a record vacuously, so $\\mathrm{Records}(p) \\geq 1$ for $n \\geq 1$",
      "Equidistributed with [[CycleCount]] over $S_n$ (Foata's bijection), so both follow the unsigned Stirling numbers of the first kind $\\left[{n\\atop k}\\right]$",
    ],
    examples: [
      {
        id: "3-alone-nothing-after-tops-it",
        expr: ["Records", ["List", 3, 1, 2]],
        expected: 1,
        caption: "$3$ alone; nothing after tops it",
      },
      {
        id: "the-identity-sets-a-new-record-everywhere",
        expr: ["Records", ["List", 1, 2, 3]],
        expected: 3,
        caption: "the identity sets a new record everywhere",
      },
      {
        id: "2-then-3",
        expr: ["Records", ["List", 2, 3, 1]],
        expected: 2,
        caption: "$2$, then $3$",
      },
      {
        id: "the-reversal-attains-the-minimum-1",
        expr: ["Records", ["List", 4, 3, 2, 1]],
        expected: 1,
        category: "Properties",
        caption: "the reversal attains the minimum, $1$",
      },
    ],
    seeAlso: ["CycleCount", "StirlingS1", "SymmetricGroup"],
  },
  {
    name: "Peaks",
    domain: "Permutation statistics",
    signature: "Peaks(p)",
    summary: "The number of peaks of $p$: interior positions $i$ with $p_{i-1} < p_i > p_{i+1}$.",
    signatures: [
      {
        call: "Peaks(p)",
        description: "the peak count of a one-line permutation $p$",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Only interior positions count ($1 < i < n$), so $\\mathrm{Peaks}(p) = 0$ whenever $n \\leq 2$",
      "Peaks and [[Valleys]] alternate along the sequence, so they differ by at most $1$",
    ],
    examples: [
      {
        id: "3-at-position-2-tops-both-neighbors",
        expr: ["Peaks", ["List", 2, 3, 1]],
        expected: 1,
        caption: "$3$ at position 2 tops both neighbors",
      },
      {
        id: "monotone-increasing-has-no-interior-peak",
        expr: ["Peaks", ["List", 1, 2, 3]],
        expected: 0,
        caption: "monotone increasing has no interior peak",
      },
      {
        id: "the-lone-peak-at-position-2",
        expr: ["Peaks", ["List", 1, 3, 2, 4]],
        expected: 1,
        caption: "the lone peak at position 2",
      },
    ],
    seeAlso: ["Valleys", "Descents", "SymmetricGroup"],
  },
  {
    name: "Valleys",
    domain: "Permutation statistics",
    signature: "Valleys(p)",
    summary: "The number of valleys of $p$: interior positions $i$ with $p_{i-1} > p_i < p_{i+1}$.",
    signatures: [
      {
        call: "Valleys(p)",
        description: "the valley count of a one-line permutation $p$",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Only interior positions count ($1 < i < n$), so $\\mathrm{Valleys}(p) = 0$ whenever $n \\leq 2$",
      "The local minima, complementary in shape to the local maxima counted by [[Peaks]]",
    ],
    examples: [
      {
        id: "1-dips-below-both-neighbors",
        expr: ["Valleys", ["List", 3, 1, 2]],
        expected: 1,
        caption: "$1$ dips below both neighbors",
      },
      {
        id: "monotone-increasing-has-no-interior-valley",
        expr: ["Valleys", ["List", 1, 2, 3]],
        expected: 0,
        caption: "monotone increasing has no interior valley",
      },
      {
        id: "the-lone-valley-at-position-3",
        expr: ["Valleys", ["List", 1, 3, 2, 4]],
        expected: 1,
        caption: "the lone valley at position 3",
      },
    ],
    seeAlso: ["Peaks", "Ascents", "SymmetricGroup"],
  },
  {
    name: "MinorIndex",
    domain: "Permutation statistics",
    signature: "MinorIndex(p)",
    summary:
      "The minor index of $p$: the sum of the ascent positions $\\sum_{p_i < p_{i+1}} i$ (the comajor index).",
    signatures: [
      {
        call: "MinorIndex(p)",
        description: "the minor index of a one-line permutation $p$",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Complementary to [[MajorIndex]]: every position is a descent or an ascent, so $\\mathrm{MajorIndex}(p) + \\mathrm{MinorIndex}(p) = \\binom{n}{2}$",
    ],
    examples: [
      {
        id: "the-lone-ascent-at-position-2",
        expr: ["MinorIndex", ["List", 3, 1, 2]],
        expected: 2,
        caption: "the lone ascent, at position 2",
      },
      {
        id: "ascents-at-both-positions-1-2",
        expr: ["MinorIndex", ["List", 1, 2, 3]],
        expected: 3,
        caption: "ascents at both positions: $1 + 2$",
      },
      {
        id: "no-ascents",
        expr: ["MinorIndex", ["List", 3, 2, 1]],
        expected: 0,
        caption: "no ascents",
      },
      {
        id: "major-and-minor-index-split-binom-n-2",
        expr: [
          "Equal",
          ["Add", ["MajorIndex", ["List", 3, 1, 2]], ["MinorIndex", ["List", 3, 1, 2]]],
          ["Binomial", 3, 2],
        ],
        expected: "True",
        category: "Properties",
        caption: "major and minor index split $\\binom{n}{2}$",
      },
    ],
    seeAlso: ["MajorIndex", "Descents", "SymmetricGroup"],
  },
  {
    name: "Array",
    domain: "Collections",
    signature: "Array(f, n)",
    summary: "f applied over every point of an n-dimensional index range.",
    signatures: [
      {
        call: "Array(f, n)",
        description: "$\\{f(1), \\ldots, f(n)\\}$.",
        library: "enumeratio-collections",
      },
      {
        call: "Array(f, {n1, …, nk})",
        description:
          "the $n_1 \\times \\cdots \\times n_k$ array with $f$ applied to every index tuple.",
        library: "enumeratio-collections",
      },
      {
        call: "Array(f, n, r)",
        description: "like $Array(f, n)$, but the index range starts at $r$ instead of 1.",
        library: "enumeratio-collections",
      },
      {
        call: "Array(f, {n1, …, nk}, {r1, …, rk})",
        description:
          "like the multi-dimensional form, with each dimension's index range starting at its own origin.",
        library: "enumeratio-collections",
      },
      {
        call: "Array(f, n, r, h)",
        description: "like $Array(f, n, r)$, wrapped in $h$ at every level instead of $List$.",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "The scalar forms of $n$ and $r$ are shorthand for $\\{n\\}$ and every dimension sharing origin $r$.",
      "See [[Tabulate]] for a lazy array read without materialising it.",
    ],
    examples: [
      {
        id: "array-f-5",
        expr: ["Array", "f", 5],
        expected: ["List", ["f", 1], ["f", 2], ["f", 3], ["f", 4], ["f", 5]],
      },
      {
        id: "array-f-2-2",
        expr: ["Array", "f", ["List", 2, 2]],
        expected: ["List", ["List", ["f", 1, 1], ["f", 1, 2]], ["List", ["f", 2, 1], ["f", 2, 2]]],
        category: "Scope",
        caption: "A list of dimensions builds a multi-dimensional array",
      },
      {
        id: "array-f-3-0",
        expr: ["Array", "f", 3, 0],
        expected: ["List", ["f", 0], ["f", 1], ["f", 2]],
        category: "Scope",
        caption: "A third argument pins where the index range starts",
      },
      {
        id: "array-f-3-1-g",
        expr: ["Array", "f", 3, 1, "g"],
        expected: ["g", ["f", 1], ["f", 2], ["f", 3]],
        category: "Scope",
        caption: "A fourth argument wraps the result in that head instead of List",
      },
      {
        id: "array-squares",
        expr: ["Array", ["Function", ["Power", "_1", 2]], 5],
        expected: ["List", 1, 4, 9, 16, 25],
      },
    ],
    seeAlso: ["Tabulate"],
  },
  {
    name: "Accumulate",
    domain: "Collections",
    signature: "Accumulate(list)",
    summary: "The running sums of a list.",
    signatures: [
      {
        call: "Accumulate(list)",
        description: "$\\{a_1, a_1+a_2, a_1+a_2+a_3, \\ldots\\}$.",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "The first element is kept as-is; each later element is the sum of everything up to and including it.",
      "Equivalent to $FoldList(Add, list)$ — see [[FoldList]].",
    ],
    examples: [
      {
        id: "accumulate-1-2-3-4",
        expr: ["Accumulate", ["List", 1, 2, 3, 4]],
        expected: ["List", 1, 3, 6, 10],
      },
      {
        id: "accumulate-empty",
        expr: ["Accumulate", ["List"]],
        expected: ["List"],
        category: "Scope",
        caption: "The running sum of the empty list is empty",
      },
      {
        id: "accumulate-last-is-total",
        expr: ["Equal", ["Last", ["Accumulate", ["List", 1, 2, 3, 4, 5]]], ["Add", 1, 2, 3, 4, 5]],
        expected: "True",
        category: "Properties",
        caption: "The last element is the sum of the whole list",
      },
    ],
    seeAlso: ["FoldList"],
  },
  {
    name: "FoldList",
    domain: "Collections",
    signature: "FoldList(f, x0, list)",
    summary: "Every intermediate result of folding f over a list.",
    signatures: [
      {
        call: "FoldList(f, x0, list)",
        description:
          "$\\{x_0, f(x_0,a_1), f(f(x_0,a_1),a_2), \\ldots\\}$ — one longer than $list$.",
        library: "enumeratio-collections",
      },
      {
        call: "FoldList(f, list)",
        description:
          "like the 3-argument form, using the first element of $list$ as $x_0$ and folding over the rest.",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "The last element equals [[Fold]]($f$, $x_0$, $list$).",
      "See [[Accumulate]] for the common case $f = Add$.",
    ],
    examples: [
      {
        id: "foldlist-add-0-1-2-3",
        expr: ["FoldList", "Add", 0, ["List", 1, 2, 3]],
        expected: ["List", 0, 1, 3, 6],
      },
      {
        id: "foldlist-add-1-2-3",
        expr: ["FoldList", "Add", ["List", 1, 2, 3]],
        expected: ["List", 1, 3, 6],
        category: "Scope",
        caption: "With no seed, the first element of the list is the seed",
      },
      {
        id: "foldlist-multiply-1-1-2-3-4",
        expr: ["FoldList", "Multiply", 1, ["List", 1, 2, 3, 4]],
        expected: ["List", 1, 1, 2, 6, 24],
        category: "Scope",
        caption: "Running products, via Multiply instead of Add",
      },
      {
        id: "foldlist-length-is-one-more",
        expr: [
          "Equal",
          ["Length", ["FoldList", "Add", 0, ["List", 1, 2, 3, 4, 5]]],
          ["Add", ["Length", ["List", 1, 2, 3, 4, 5]], 1],
        ],
        expected: "True",
        category: "Properties",
        caption: "One longer than the input list",
      },
      {
        id: "foldlist-last-is-fold",
        expr: [
          "Equal",
          ["Last", ["FoldList", "Add", 0, ["List", 1, 2, 3]]],
          ["Fold", "Add", 0, ["List", 1, 2, 3]],
        ],
        expected: "True",
        category: "Properties",
        caption: "The last element is what Fold alone would give",
      },
    ],
    seeAlso: ["Fold", "Accumulate"],
  },
  {
    name: "Cases",
    domain: "Collections",
    signature: "Cases(collection, pattern)",
    summary: "The elements of a collection matching a pattern.",
    signatures: [
      {
        call: "Cases(collection, pattern)",
        description: "every element of $collection$ that matches $pattern$, in order.",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Matches compute-engine's own wildcards: a bare `_` (or named, `_a`) matches any single element, `__`/`___` match one-or-more/zero-or-more within a structural pattern, and a pattern built from a head applied to wildcards (e.g. $List(\\_a)$) matches that structure.",
      "A plain value (no wildcard) matches by exact equality, same as [[Count]].",
      "Only the top level of the collection is searched.",
    ],
    examples: [
      {
        id: "cases-wildcard-keeps-everything",
        expr: ["Cases", ["List", 1, "a", 2, "b"], "_"],
        expected: ["List", 1, "a", 2, "b"],
      },
      {
        id: "cases-literal-value",
        expr: ["Cases", ["List", 1, 2, 1, 3, 1], 1],
        expected: ["List", 1, 1, 1],
        category: "Scope",
        caption: "A plain value keeps only the elements equal to it",
      },
      {
        id: "cases-structural-pattern",
        expr: ["Cases", ["List", ["List", 1], 2, ["List", 3]], ["List", "_a"]],
        expected: ["List", ["List", 1], ["List", 3]],
        category: "Scope",
        caption: "A structural pattern keeps elements shaped like it",
      },
      {
        id: "cases-count-agree-on-length",
        expr: [
          "Equal",
          ["Length", ["Cases", ["List", 1, 2, 1, 3, 1], 1]],
          ["Count", ["List", 1, 2, 1, 3, 1], 1],
        ],
        expected: "True",
        category: "Properties",
        caption: "For a plain value, Cases and Count agree on how many",
      },
      {
        id: "cases-typed-pattern-not-typed-here",
        expr: ["Length", ["Cases", ["List", 1, "a", 2, "b"], "_Integer"]],
        expected: 4,
        category: "Possible issues",
        caption:
          "compute-engine's wildcards carry no type: `_Integer` is just a named wildcard, so it matches every element",
        divergence: {
          wolfram: "Wolfram's `_Integer` pattern only matches integers, here 2 (1 and 2).",
        },
      },
    ],
    seeAlso: ["Count", "Select"],
  },
  {
    name: "SparseArray",
    domain: "Collections",
    signature: "SparseArray(rules, dims, default)",
    summary: "A dense array built from position → value rules.",
    signatures: [
      {
        call: "SparseArray(rules)",
        description:
          "a dense array whose dimensions are the largest index seen on each axis, elsewhere 0.",
        library: "enumeratio-collections",
      },
      {
        call: "SparseArray(rules, dims)",
        description: "like the 1-argument form, with the dimensions given explicitly.",
        library: "enumeratio-collections",
      },
      {
        call: "SparseArray(rules, dims, default)",
        description:
          "like the 2-argument form, with positions not covered by `rules` filled with `default` instead of 0.",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Each rule is $pos \\to value$: $pos$ is a plain integer for a vector, or a list of integers for a matrix or higher-rank array.",
      "No distinct sparse storage type is kept — the result densifies immediately into an ordinary nested list, so `Normal` of it is unchanged, and it is not practical for arrays too large to materialise.",
    ],
    examples: [
      {
        id: "sparsearray-vector",
        expr: ["SparseArray", ["List", ["Rule", 1, "x"], ["Rule", 3, "y"]], 4],
        expected: ["List", "x", 0, "y", 0],
      },
      {
        id: "sparsearray-infers-dims",
        expr: ["SparseArray", ["List", ["Rule", ["List", 1, 1], 5], ["Rule", ["List", 2, 2], 7]]],
        expected: ["List", ["List", 5, 0], ["List", 0, 7]],
        category: "Scope",
        caption: "With no dims given, they're the largest index seen per axis",
      },
      {
        id: "sparsearray-custom-default",
        expr: ["SparseArray", ["List", ["Rule", 2, 9]], 3, -1],
        expected: ["List", -1, 9, -1],
        category: "Scope",
        caption: "A third argument fills the gaps instead of 0",
      },
      {
        id: "sparsearray-normal-is-identity",
        expr: ["Normal", ["SparseArray", ["List", ["Rule", 1, "a"]], 2]],
        expected: ["List", "a", 0],
        category: "Possible issues",
        caption: "Normal is a no-op here — SparseArray already returns a plain dense list",
        divergence: {
          wolfram:
            "Wolfram's SparseArray keeps a distinct sparse representation until Normal densifies it.",
        },
      },
    ],
  },
  {
    name: "RandomInteger",
    domain: "Collections",
    signature: "RandomInteger(range, n)",
    summary: "A uniform random integer, or a list (or array) of them.",
    signatures: [
      {
        call: "RandomInteger()",
        description: "$0$ or $1$, each with probability $1/2$.",
        library: "enumeratio-collections",
      },
      {
        call: "RandomInteger(max)",
        description: "uniform in $\\{0, \\ldots, max\\}$.",
        library: "enumeratio-collections",
      },
      {
        call: "RandomInteger({min, max})",
        description: "uniform in $\\{min, \\ldots, max\\}$.",
        library: "enumeratio-collections",
      },
      {
        call: "RandomInteger(range, n)",
        description: "a list of $n$ draws from `range` (either form above).",
        library: "enumeratio-collections",
      },
      {
        call: "RandomInteger(range, {n1, …, nk})",
        description: "an $n_1 \\times \\cdots \\times n_k$ array of draws.",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Seeded, not free-running: call [[SeedRandom]](seed) first for a reproducible sequence. Without it, a fixed default seed is used, so even a bare `RandomInteger` call is reproducible run to run — two fresh evaluations draw the same value.",
      "The generator is our own (a small deterministic PRNG), not Wolfram's — the same seed draws a different sequence from Wolfram's. Only the shape and range of the answer are guaranteed to match.",
      "A worked example that both seeds and draws needs the two calls in one expression; `Last(List(SeedRandom(n), RandomInteger(…)))` runs `SeedRandom` for its effect and keeps the draw.",
    ],
    examples: [
      {
        id: "randominteger-default-seed-is-reproducible",
        expr: ["RandomInteger", 100],
        expected: 60,
        caption: "With no SeedRandom call, a fixed default seed still makes this reproducible",
      },
      {
        id: "randominteger-range-scope",
        expr: ["Last", ["List", ["SeedRandom", 1], ["RandomInteger", ["List", 10, 20]]]],
        expected: 16,
        category: "Scope",
        caption: "A {min, max} range, after seeding",
      },
      {
        id: "randominteger-list-of-draws",
        expr: ["Length", ["Last", ["List", ["SeedRandom", 2], ["RandomInteger", 6, 10]]]],
        expected: 10,
        category: "Scope",
        caption: "A count argument draws that many values",
      },
      {
        id: "randominteger-array-shape",
        expr: [
          "Shape",
          ["Last", ["List", ["SeedRandom", 3], ["RandomInteger", 1, ["List", 2, 3]]]],
        ],
        expected: ["Tuple", 2, 3],
        category: "Scope",
        caption: "A dimension list draws a nested array of that shape",
      },
    ],
    seeAlso: ["SeedRandom"],
  },
  {
    name: "SeedRandom",
    domain: "Collections",
    signature: "SeedRandom(seed)",
    summary: "Reseeds the random generator RandomInteger draws from.",
    signatures: [
      {
        call: "SeedRandom(seed)",
        description: "reseeds the generator; returns `Nothing`.",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "One generator per engine instance: [[RandomInteger]] draws from it, and the same seed always starts the same sequence.",
      "Our generator is our own (a small deterministic PRNG), not Wolfram's Mersenne-twister-based one — a shared seed value does not draw the same numbers as Wolfram would.",
    ],
    examples: [
      { id: "seedrandom-returns-nothing", expr: ["SeedRandom", 7], expected: "Nothing" },
      {
        id: "seedrandom-pins-the-next-draw",
        expr: ["Last", ["List", ["SeedRandom", 7], ["RandomInteger", 100]]],
        expected: 1,
        category: "Scope",
        caption: "Seeding pins the next RandomInteger draw",
      },
    ],
    seeAlso: ["RandomInteger"],
  },
  {
    name: "IsNumeric",
    domain: "Collections",
    signature: "IsNumeric(expr)",
    summary: "Whether expr denotes a definite numeric quantity, without evaluating it.",
    signatures: [
      {
        call: "IsNumeric(expr)",
        description:
          "$True$ for a number literal or an expression built from numeric literals and constants like $\\pi$, $False$ otherwise.",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Wolfram spells this `NumericQ`; renamed to the `Is…` convention used across compute-engine predicates.",
      "A plain symbol with no numeric value (like `x`) is not numeric, even though it could later be assigned one.",
    ],
    examples: [
      { id: "isnumeric-pi", expr: ["IsNumeric", "Pi"], expected: "True" },
      {
        id: "isnumeric-plain-symbol",
        expr: ["IsNumeric", "x"],
        expected: "False",
        category: "Scope",
        caption: "A plain symbol carries no definite numeric value",
      },
      {
        id: "isnumeric-sqrt-2",
        expr: ["IsNumeric", ["Sqrt", 2]],
        expected: "True",
        category: "Scope",
        caption: "Built from numeric literals and a known numeric function",
      },
      { id: "isnumeric-literal", expr: ["IsNumeric", 5], expected: "True" },
    ],
    seeAlso: ["IsMachineNumber", "Precision"],
  },
  {
    name: "IsMachineNumber",
    domain: "Collections",
    signature: "IsMachineNumber(expr)",
    summary: "Whether expr is an ordinary (not extended-precision) inexact number.",
    signatures: [
      {
        call: "IsMachineNumber(expr)",
        description:
          "$True$ for an inexact number carrying at most 15 significant decimal digits, $False$ otherwise (including every exact number).",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Wolfram spells this `MachineNumberQ`; renamed to the `Is…` convention used across compute-engine predicates.",
      'Compute engine keeps no separate "machine" number representation — every inexact value is a decimal carrying as many digits as it was given — so this is approximated by digit count against Wolfram\'s ~15.95-digit `MachinePrecision`, documented as a divergence.',
    ],
    examples: [
      { id: "ismachinenumber-ordinary-float", expr: ["IsMachineNumber", 2.5], expected: "True" },
      {
        id: "ismachinenumber-exact-integer",
        expr: ["IsMachineNumber", 2],
        expected: "False",
        category: "Scope",
        caption: "Exact numbers are never machine numbers",
      },
      {
        id: "ismachinenumber-extended-precision",
        expr: ["IsMachineNumber", 3.141592653589793],
        expected: "False",
        category: "Possible issues",
        caption:
          "A literal with more digits than a double can hold rounds to about 16 — over the machine-precision cutoff",
        divergence: {
          wolfram:
            "Wolfram's MachineNumberQ agrees here, but tracks precision as a tag rather than counting written digits.",
        },
      },
    ],
    seeAlso: ["IsNumeric", "Precision"],
  },
  {
    name: "Precision",
    domain: "Collections",
    signature: "Precision(expr)",
    summary: "How many significant decimal digits a number carries.",
    signatures: [
      {
        call: "Precision(expr)",
        description:
          "$PositiveInfinity$ for an exact number, otherwise its significant decimal digit count.",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Exact numbers (integers, rationals, radicals, symbolic constants like $\\pi$) carry infinite precision, Wolfram's own convention.",
      "For an inexact number, this counts the digits actually written — `2.5` has 2, and a literal with more digits than a double can represent is rounded to about 16.",
    ],
    examples: [
      { id: "precision-exact-integer", expr: ["Precision", 2], expected: "PositiveInfinity" },
      {
        id: "precision-rational",
        expr: ["Precision", ["Rational", 1, 3]],
        expected: "PositiveInfinity",
        category: "Scope",
        caption: "An exact rational also carries infinite precision",
      },
      {
        id: "precision-inexact-literal",
        expr: ["Precision", 2.5],
        expected: 2,
        category: "Scope",
        caption: "An inexact literal's precision is its written digit count",
      },
      {
        id: "precision-extended",
        expr: ["Precision", 3.141592653589793],
        expected: 16,
        category: "Scope",
        caption: "A literal with more digits than a double can hold rounds to about 16 of them",
      },
    ],
    seeAlso: ["IsMachineNumber", "IsNumeric"],
  },
  {
    name: "Thread",
    domain: "Collections",
    signature: "Thread(f(a1, …, an))",
    summary: "f applied elementwise across every list-headed argument, other arguments broadcast.",
    signatures: [
      {
        call: "Thread(f(a1, …, an))",
        description: "f threaded over every List-headed operand",
        library: "enumeratio-collections",
      },
      {
        call: "Thread(f(a1, …, an), h)",
        description:
          "like Thread(f(...)), threading only over operands headed by h instead of List",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Operands not headed by h are broadcast unchanged to every threaded call.",
      "Left unevaluated when the h-headed operands don't all share one length.",
      "Many arithmetic heads already thread over lists automatically; Thread's value is threading a head that doesn't, such as [[Equal]] or a plain function.",
    ],
    examples: [
      {
        id: "equal-over-lists",
        expr: ["Thread", ["Equal", ["List", 1, 2, 3], ["List", 1, 5, 3]]],
        expected: ["List", ["Equal", 1, 1], ["Equal", 2, 5], ["Equal", 3, 3]],
      },
      {
        id: "scalar-broadcast",
        expr: ["Thread", ["Equal", ["List", 1, 2, 3], 1]],
        expected: ["List", ["Equal", 1, 1], ["Equal", 2, 1], ["Equal", 3, 1]],
        category: "Scope",
        caption: "A non-list operand is broadcast to every threaded call",
      },
      {
        id: "custom-head",
        expr: ["Thread", ["f", ["g", 1, 2], ["g", 3, 4]], "g"],
        expected: ["g", ["f", 1, 3], ["f", 2, 4]],
        category: "Scope",
        caption: "A second argument threads over a head other than List",
      },
    ],
    seeAlso: ["MovingMap", "Array"],
  },
  {
    name: "MapAt",
    domain: "Collections",
    signature: "MapAt(f, expr, n)",
    summary: "f applied to the part of expr at position n, leaving the rest of expr unchanged.",
    signatures: [
      {
        call: "MapAt(f, expr, n)",
        description: "f applied at the (1-based, negative counts from the end) position n",
        library: "enumeratio-collections",
      },
      {
        call: "MapAt(f, expr, {{n1}, {n2}, …})",
        description: "f applied independently at each of several top-level positions",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Only top-level positions are answered here -- a nested path (into a sub-list) is left unevaluated.",
    ],
    examples: [
      {
        id: "single-position",
        expr: ["MapAt", "f", ["List", "a", "b", "c"], 2],
        expected: ["List", "a", ["f", "b"], "c"],
      },
      {
        id: "negative-position",
        expr: ["MapAt", "f", ["List", "a", "b", "c"], -1],
        expected: ["List", "a", "b", ["f", "c"]],
        category: "Scope",
        caption: "A negative position counts from the end",
      },
      {
        id: "several-positions",
        expr: ["MapAt", "f", ["List", "a", "b", "c"], ["List", ["List", 1], ["List", 3]]],
        expected: ["List", ["f", "a"], "b", ["f", "c"]],
        category: "Scope",
        caption: "A list of positions applies f at each independently",
      },
    ],
  },
  {
    name: "Normalize",
    domain: "Collections",
    signature: "Normalize(v)",
    summary: "v divided by its Euclidean norm -- a unit vector in v's direction.",
    signatures: [
      {
        call: "Normalize(v)",
        description: "v / Sqrt(Total(Abs(v)^2))",
        library: "enumeratio-collections",
      },
      {
        call: "Normalize(v, f)",
        description: "v / f(v), a custom norm function",
        library: "enumeratio-collections",
      },
    ],
    details: ["The zero vector is returned unchanged -- there is no direction to normalize it to."],
    examples: [
      {
        id: "3-4-5",
        expr: ["Normalize", ["List", 3, 4]],
        expected: ["List", ["Rational", 3, 5], ["Rational", 4, 5]],
        caption: "The 3-4-5 triangle's direction vector, normalized to unit length",
      },
      {
        id: "zero-vector",
        expr: ["Normalize", ["List", 0, 0]],
        expected: ["List", 0, 0],
        category: "Scope",
        caption: "The zero vector has no direction, so it is left unchanged",
      },
    ],
  },
  {
    name: "Surd",
    domain: "Collections",
    signature: "Surd(x, n)",
    summary: "The real nth root of a real x, staying real for a negative x when n is odd.",
    signatures: [
      {
        call: "Surd(x, n)",
        description: "the real nth root of x",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Differs from x^(1/n): that gives a complex principal root for a negative x, where Surd stays on the real line whenever a real root exists.",
      "An even n with a negative x has no real root and is left unevaluated.",
    ],
    examples: [
      {
        id: "negative-cube-root",
        expr: ["Surd", -8, 3],
        expected: -2,
        caption: "The real cube root of -8 is -2, not a complex principal root",
      },
      {
        id: "nonnegative-base",
        expr: ["Surd", 8, 3],
        expected: 2,
        category: "Scope",
        caption: "For a nonnegative base, Surd agrees with Power(x, 1/n)",
      },
    ],
  },
  {
    name: "LetterNumber",
    domain: "Collections",
    signature: "LetterNumber(c)",
    summary: "A letter's 1-based position in the English alphabet -- a → 1, …, z → 26.",
    signatures: [
      {
        call: "LetterNumber(c)",
        description: "the 1-based alphabet position of a single character c (0 if not a letter)",
        library: "enumeratio-collections",
      },
      {
        call: "LetterNumber(s)",
        description: "a list, one position per character of string s",
        library: "enumeratio-collections",
      },
    ],
    details: [
      'Case-insensitive -- LetterNumber("D") and LetterNumber("d") agree.',
      'The LetterNumber(c, alphabet) form is only answered for alphabet = "English"; any other named alphabet is left unevaluated.',
    ],
    examples: [
      { id: "single-letter", expr: ["LetterNumber", "'d'"], expected: 4 },
      {
        id: "string",
        expr: ["LetterNumber", "'cab'"],
        expected: ["List", 3, 1, 2],
        category: "Scope",
        caption: "A string gives one position per character",
      },
    ],
  },
  {
    name: "FactorialPower",
    domain: "Collections",
    signature: "FactorialPower(x, n)",
    summary: "The falling factorial x(x-1)…(x-n+1), n factors.",
    signatures: [
      {
        call: "FactorialPower(x, n)",
        description: "x(x-1)(x-2)…(x-n+1)",
        library: "enumeratio-collections",
      },
      {
        call: "FactorialPower(x, n, h)",
        description: "x(x-h)(x-2h)…(x-(n-1)h), stepping by h instead of 1",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "A negative integer n inverts the product -- FactorialPower(x, -m, h) = 1 / ((x+h)(x+2h)…(x+mh)).",
      "A non-integer n (step h = 1 only) generalizes via Gamma(x+1)/Gamma(x-n+1).",
    ],
    examples: [
      {
        id: "symbolic-falling",
        expr: ["FactorialPower", "x", 3],
        expected: ["Multiply", "x", ["Add", "x", -2], ["Add", "x", -1]],
        caption: "x(x-1)(x-2), CE's own canonical operand order",
      },
      { id: "numeric", expr: ["FactorialPower", 5, 3], expected: 60, caption: "5 × 4 × 3 = 60" },
      {
        id: "step",
        expr: ["FactorialPower", "x", 2, "h"],
        expected: ["Multiply", "x", ["Add", ["Negate", "h"], "x"]],
        category: "Scope",
        caption: "A third argument steps by h instead of 1 -- x(x-h)",
      },
    ],
  },
  {
    name: "DifferenceDelta",
    domain: "Collections",
    signature: "DifferenceDelta(f, n)",
    summary: "f(n+1) - f(n), simplified -- the forward difference of a sequence.",
    signatures: [
      {
        call: "DifferenceDelta(f, n)",
        description: "f(n+1) - f(n), simplified",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Substitutes n -> n+1 into f and simplifies the difference; stays symbolic when it does not collapse further.",
    ],
    examples: [
      {
        id: "quadratic",
        expr: ["DifferenceDelta", ["Power", "n", 2], "n"],
        expected: ["Add", ["Multiply", 2, "n"], 1],
        caption: "$(n+1)^2 - n^2 = 2n + 1$",
      },
      {
        id: "linear",
        expr: ["DifferenceDelta", ["Add", ["Multiply", 3, "n"], 5], "n"],
        expected: 3,
        caption: "The forward difference of a linear function is its slope, everywhere",
      },
    ],
    seeAlso: ["DiscreteRatio"],
  },
  {
    name: "HankelMatrix",
    domain: "Collections",
    signature: "HankelMatrix(c)",
    summary: "The square matrix, constant along every anti-diagonal, built from c.",
    signatures: [
      {
        call: "HankelMatrix(c)",
        description:
          "the n×n Hankel matrix with first column and first row c, zero-padded past c's reach",
        library: "enumeratio-collections",
      },
      {
        call: "HankelMatrix(c, r)",
        description:
          "the n×m Hankel matrix (n = Length(c), m = Length(r)) filled past c's reach from r",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "A Hankel matrix is constant along each anti-diagonal: M(i, j) depends only on i + j.",
    ],
    examples: [
      {
        id: "single-arg",
        expr: ["HankelMatrix", ["List", 1, 2, 3]],
        expected: ["List", ["List", 1, 2, 3], ["List", 2, 3, 0], ["List", 3, 0, 0]],
        caption: "Past c's reach, the matrix is zero-padded",
      },
      {
        id: "with-last-row",
        expr: ["HankelMatrix", ["List", 1, 2, 3], ["List", 3, 4, 5]],
        expected: ["List", ["List", 1, 2, 3], ["List", 2, 3, 3], ["List", 3, 3, 4]],
        category: "Scope",
        caption: "A second argument fills the region past c's reach from r instead of zero",
      },
    ],
  },
  {
    name: "MovingMap",
    domain: "Collections",
    signature: "MovingMap(f, list, r)",
    summary: "f applied to the radius-r neighborhood around each element of list.",
    signatures: [
      {
        call: "MovingMap(f, list, r)",
        description: "f applied to each window {list[i-r], …, list[i+r]}, clipped at the boundary",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Unlike [[MovingAverage]]-style windows, the output is the same length as list: a boundary window is clipped rather than dropped.",
    ],
    examples: [
      {
        id: "length-of-window",
        expr: ["MovingMap", "Length", ["List", 1, 2, 3, 4], 1],
        expected: ["List", 2, 3, 3, 2],
        caption:
          "Boundary windows are shorter -- only the interior gets the full radius-1 neighborhood",
      },
    ],
  },
  {
    name: "PascalBinomial",
    domain: "Collections",
    signature: "PascalBinomial(n, m)",
    summary: "The binomial coefficient, extended to a negative n so Pascal's identity still holds.",
    signatures: [
      {
        call: "PascalBinomial(n, m)",
        description: "n(n-1)…(n-m+1) / m!, for m >= 0 and any integer n",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Agrees with [[Binomial]] where n >= m >= 0; for a negative n it is the standard generalized binomial coefficient, which still satisfies Pascal's recurrence P(n, m) = P(n-1, m-1) + P(n-1, m).",
      "A negative m is left unevaluated -- Wolfram's extension there is a documented gap, not yet cross-checked against a kernel.",
    ],
    examples: [
      {
        id: "standard-range",
        expr: ["PascalBinomial", 5, 2],
        expected: 10,
        caption: "Agrees with Binomial(5, 2) in the standard range",
      },
      {
        id: "negative-n",
        expr: ["PascalBinomial", -1, 3],
        expected: -1,
        category: "Scope",
        caption: "C(-1, k) = (-1)^k, the standard identity for a negative upper index",
      },
    ],
  },
  {
    name: "CellularAutomaton",
    domain: "Collections",
    signature: "CellularAutomaton(rule, init, t)",
    summary: "t+1 generations of an elementary 1-D cellular automaton starting from init.",
    signatures: [
      {
        call: "CellularAutomaton(rule, init, t)",
        description:
          "t+1 generations of Wolfram's elementary (k = 2 colors, radius 1) rule number rule, from initial condition init",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "init is either 1 (Wolfram's shorthand for a single black cell on an all-0 background) or an explicit {list} / {list, background}.",
      "Each generation is one cell wider on each side than the last -- the region t steps could possibly reach.",
      "Only the elementary (k = 2, radius 1) rule form is answered; totalistic and multi-color rule specs are left unevaluated.",
    ],
    examples: [
      {
        id: "rule-30-single-seed",
        expr: ["CellularAutomaton", 30, 1, 2],
        expected: ["List", ["List", 1], ["List", 1, 1, 1], ["List", 1, 1, 0, 0, 1]],
        caption: "The classic Rule 30 triangle, grown for 2 steps from a single seed cell",
      },
      {
        id: "rule-90-explicit-init",
        expr: ["CellularAutomaton", 90, ["List", ["List", 1, 0, 0], 0], 2],
        expected: [
          "List",
          ["List", 1, 0, 0],
          ["List", 1, 0, 1, 0, 0],
          ["List", 1, 0, 0, 0, 1, 0, 0],
        ],
        category: "Scope",
        caption:
          "An explicit {list, background} initial condition, instead of the single-seed shorthand",
      },
    ],
  },
];
