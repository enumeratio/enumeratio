import type { ReferenceEntry } from "@enumeratio/entry";
import { DEFINITIONS } from "./definitions.ts";

// Reference entries for the enumeratio collection heads. Every head is an
// n-indexed lazy family over {1, …, n}; `Count`/`At` are answered by unranking,
// so they evaluate without materialising the family. `expected` values are
// grounded against the registered library by this package's tests.
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
      { expr: ["Count", ["Subsets", 4]], expected: 16, caption: "$2^4$ subsets" },
      { expr: ["At", ["Subsets", 3], 1], expected: ["List"], caption: "the empty subset" },
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
      "That is the order [[IntegerDigits]] with `CombinatorialSystem(k)` unranks in — the two are the same map",
      "$k = 0$ gives the single empty subset; $k > n$ gives an empty family",
    ],
    examples: [
      { expr: ["Count", ["KSubsets", 5, 2]], expected: 10, caption: "$\\binom{5}{2}$" },
      { expr: ["At", ["KSubsets", 5, 2], 1], expected: ["List", 1, 2] },
      {
        // Index 3 is what separates the two orders: lexicographic would give {1,4} here.
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
    examples: [{ expr: ["Count", ["Multisets", 3, 2]], expected: 6, caption: "$\\binom{4}{2}$" }],
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
      { expr: ["Count", ["Tuples", 2, 3]], expected: 8, caption: "$2^3$" },
      { expr: ["At", ["Tuples", 2, 3], 1], expected: ["List", 1, 1, 1] },
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
      { expr: ["Count", ["SymmetricGroup", 4]], expected: 24, caption: "$4!$" },
      {
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
    examples: [{ expr: ["Count", ["Derangements", 4]], expected: 9, caption: "$!4$" }],
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
    examples: [{ expr: ["Count", ["Involutions", 4]], expected: 10 }],
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
      { expr: ["Count", ["IntegerPartitions", 6]], expected: 11, caption: "$p(6)$" },
      {
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
    examples: [{ expr: ["Count", ["IntegerCompositions", 5]], expected: 16, caption: "$2^{4}$" }],
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
    examples: [{ expr: ["Count", ["SetPartitions", 4]], expected: 15, caption: "$B_4$" }],
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
      { expr: ["Count", ["DyckPaths", 3]], expected: 5, caption: "$C_3$" },
      {
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
    examples: [{ expr: ["Count", ["BinaryTrees", 4]], expected: 14, caption: "$C_4$" }],
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
      { expr: ["Inversions", ["List", 3, 1, 2]], expected: 2, caption: "$(3,1)$ and $(3,2)$" },
      { expr: ["Inversions", ["List", 1, 2, 3]], expected: 0, caption: "the identity has none" },
      {
        expr: ["Inversions", ["List", 4, 3, 2, 1]],
        expected: 6,
        category: "Properties",
        caption: "the reversal attains the maximum $\\binom{4}{2}$",
      },
      {
        expr: ["ListFrom", ["Map", ["Function", ["Inversions", "p"], "p"], ["SymmetricGroup", 3]]],
        expected: ["List", 0, 1, 1, 2, 2, 3],
        category: "Applications",
        caption: "the inversion distribution over $S_3$, mapped across the lazy [[SymmetricGroup]]",
      },
      {
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
      { expr: ["Descents", ["List", 3, 1, 2]], expected: 1, caption: "only $3 > 1$" },
      { expr: ["Descents", ["List", 3, 2, 1]], expected: 2, caption: "every step falls" },
      {
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
      { expr: ["Ascents", ["List", 3, 1, 2]], expected: 1, caption: "only $1 < 2$" },
      {
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
        expr: DEFINITIONS.MajorIndex,
        note: "Checked against the implementation over every permutation of 1..6.",
      },
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/collections/src/stats.ts:majorIndex",
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
        expr: ["MajorIndex", ["List", 3, 1, 2]],
        expected: 1,
        caption: "one descent, at position 1",
      },
      {
        expr: ["MajorIndex", ["List", 3, 2, 1]],
        expected: 3,
        caption: "descents at positions 1 and 2",
      },
      { expr: ["MajorIndex", ["List", 1, 2, 3]], expected: 0, caption: "no descents" },
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
      { expr: ["FixedPoints", ["List", 1, 3, 2]], expected: 1, caption: "only $1$ is fixed" },
      { expr: ["FixedPoints", ["List", 1, 2, 3]], expected: 3, caption: "the identity fixes all" },
      {
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
        source: "packages/collections/src/stats.ts:cycleCount",
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
        expr: ["CycleCount", ["List", 2, 3, 1]],
        expected: 1,
        caption: "the 3-cycle $(1\\,2\\,3)$",
      },
      {
        expr: ["CycleCount", ["List", 1, 2, 3]],
        expected: 3,
        caption: "three singleton cycles",
      },
      { expr: ["CycleCount", ["List", 2, 1, 3]], expected: 2, caption: "$(1\\,2)(3)$" },
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
      { expr: ["Excedances", ["List", 3, 1, 2]], expected: 1, caption: "only position 1: $3 > 1$" },
      { expr: ["Excedances", ["List", 1, 2, 3]], expected: 0, caption: "the identity has none" },
      {
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
        expr: ["Antiexcedances", ["List", 3, 1, 2]],
        expected: 2,
        caption: "positions 2 and 3: $1 < 2$ and $2 < 3$",
      },
      {
        expr: ["Antiexcedances", ["List", 1, 2, 3]],
        expected: 0,
        caption: "the identity has none",
      },
      {
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
        expr: ["Records", ["List", 3, 1, 2]],
        expected: 1,
        caption: "$3$ alone; nothing after tops it",
      },
      {
        expr: ["Records", ["List", 1, 2, 3]],
        expected: 3,
        caption: "the identity sets a new record everywhere",
      },
      { expr: ["Records", ["List", 2, 3, 1]], expected: 2, caption: "$2$, then $3$" },
      {
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
        expr: ["Peaks", ["List", 2, 3, 1]],
        expected: 1,
        caption: "$3$ at position 2 tops both neighbors",
      },
      {
        expr: ["Peaks", ["List", 1, 2, 3]],
        expected: 0,
        caption: "monotone increasing has no interior peak",
      },
      {
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
        expr: ["Valleys", ["List", 3, 1, 2]],
        expected: 1,
        caption: "$1$ dips below both neighbors",
      },
      {
        expr: ["Valleys", ["List", 1, 2, 3]],
        expected: 0,
        caption: "monotone increasing has no interior valley",
      },
      {
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
        expr: ["MinorIndex", ["List", 3, 1, 2]],
        expected: 2,
        caption: "the lone ascent, at position 2",
      },
      {
        expr: ["MinorIndex", ["List", 1, 2, 3]],
        expected: 3,
        caption: "ascents at both positions: $1 + 2$",
      },
      { expr: ["MinorIndex", ["List", 3, 2, 1]], expected: 0, caption: "no ascents" },
      {
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
];
