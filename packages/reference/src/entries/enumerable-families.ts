// GENERATED from YAML by packages/reference/scripts/migrate/shims.ts -- do not edit.
// Edit the YAML named in `sources`, then run `node packages/reference/scripts/migrate/shims.ts`.

import type { ReferenceEntry } from "@enumeratio/entry";

/** The YAML each entry below was generated from, in the same order. */
export const sources: readonly string[] = [
  "packages/reference/entries/Subsets.yaml",
  "packages/reference/entries/SymmetricGroup.yaml",
  "packages/reference/entries/IntegerPartitions.yaml",
  "packages/reference/entries/DyckPaths.yaml",
  "packages/reference/entries/SetPartitions.yaml",
  "packages/reference/entries/Primes.yaml",
  "packages/reference/entries/SquareNumbers.yaml",
  "packages/reference/entries/AbundantNumbers.yaml",
  "packages/reference/entries/SmoothNumbers.yaml",
  "packages/symbols/combinatorics/collections/reference/RootedUnlabeledTrees.yaml",
  "packages/symbols/combinatorics/collections/reference/UnlabeledFreeTrees.yaml",
  "packages/symbols/combinatorics/collections/reference/PhylogeneticTrees.yaml",
  "packages/symbols/combinatorics/collections/reference/NonCrossingTrees.yaml",
  "packages/symbols/combinatorics/collections/reference/BinaryBracelets.yaml",
  "packages/symbols/combinatorics/collections/reference/KBracelets.yaml",
  "packages/symbols/combinatorics/collections/reference/TriStrings.yaml",
  "packages/symbols/combinatorics/collections/reference/PrimitiveBinaryStrings.yaml",
  "packages/symbols/combinatorics/collections/reference/TernaryGrayCodes.yaml",
  "packages/symbols/combinatorics/collections/reference/StirlingPermutations.yaml",
  "packages/symbols/combinatorics/collections/reference/BaxterPermutations.yaml",
  "packages/symbols/combinatorics/collections/reference/BooleanPermutations.yaml",
  "packages/symbols/combinatorics/collections/reference/GrassmannianPermutations.yaml",
  "packages/symbols/combinatorics/collections/reference/CograssmannianPermutations.yaml",
  "packages/symbols/combinatorics/collections/reference/NonCrossingPermutations.yaml",
  "packages/symbols/combinatorics/collections/reference/SeparablePermutations.yaml",
  "packages/symbols/combinatorics/collections/reference/SimplePermutations.yaml",
  "packages/symbols/combinatorics/collections/reference/SmoothPermutations.yaml",
  "packages/symbols/combinatorics/collections/reference/VexillaryPermutations.yaml",
  "packages/symbols/combinatorics/collections/reference/SemistandardTableaux.yaml",
  "packages/symbols/combinatorics/collections/reference/GelfandTsetlin.yaml",
  "packages/symbols/combinatorics/collections/reference/AlternatingSignMatrices.yaml",
  "packages/symbols/combinatorics/collections/reference/SkewPartitions.yaml",
  "packages/symbols/combinatorics/collections/reference/SkewStandardTableaux.yaml",
  "packages/symbols/combinatorics/collections/reference/ShiftedStandardTableaux.yaml",
  "packages/symbols/combinatorics/collections/reference/StandardTableauPairs.yaml",
  "packages/symbols/combinatorics/collections/reference/PlanePartitions.yaml",
  "packages/symbols/combinatorics/collections/reference/BoxedPlanePartitions.yaml",
  "packages/reference/entries/TriangularNumbers.yaml",
  "packages/reference/entries/PentagonalNumbers.yaml",
  "packages/reference/entries/HexagonalNumbers.yaml",
  "packages/reference/entries/HeptagonalNumbers.yaml",
  "packages/reference/entries/OctagonalNumbers.yaml",
  "packages/reference/entries/PolygonalNumbers.yaml",
  "packages/reference/entries/CenteredTriangularNumbers.yaml",
  "packages/reference/entries/CenteredSquareNumbers.yaml",
  "packages/reference/entries/CenteredHexagonalNumbers.yaml",
  "packages/reference/entries/StarNumbers.yaml",
  "packages/reference/entries/PronicNumbers.yaml",
  "packages/reference/entries/CubeNumbers.yaml",
  "packages/reference/entries/TetrahedralNumbers.yaml",
  "packages/reference/entries/PentatopeNumbers.yaml",
  "packages/reference/entries/SquarePyramidalNumbers.yaml",
  "packages/reference/entries/PowersOfTwo.yaml",
  "packages/reference/entries/FactorialNumbers.yaml",
  "packages/reference/entries/DoubleFactorialNumbers.yaml",
  "packages/reference/entries/PrimorialNumbers.yaml",
  "packages/reference/entries/AllOnes.yaml",
  "packages/reference/entries/FibonacciNumbers.yaml",
  "packages/reference/entries/LucasNumbers.yaml",
  "packages/reference/entries/JacobsthalNumbers.yaml",
  "packages/reference/entries/PellNumbers.yaml",
  "packages/reference/entries/TribonacciNumbers.yaml",
  "packages/reference/entries/PadovanSequence.yaml",
  "packages/reference/entries/PerrinSequence.yaml",
  "packages/reference/entries/SternDiatomicSequence.yaml",
  "packages/reference/entries/ThueMorseNumbers.yaml",
  "packages/reference/entries/CatalanNumbers.yaml",
  "packages/reference/entries/BellNumbers.yaml",
  "packages/reference/entries/FubiniNumbers.yaml",
  "packages/reference/entries/MotzkinNumbers.yaml",
  "packages/reference/entries/PartitionNumbers.yaml",
  "packages/reference/entries/CentralDelannoyNumbers.yaml",
  "packages/reference/entries/LittleSchroderNumbers.yaml",
  "packages/reference/entries/SchroederNumbers.yaml",
  "packages/reference/entries/DeficientNumbers.yaml",
  "packages/reference/entries/PerfectNumbers.yaml",
  "packages/reference/entries/SemiperfectNumbers.yaml",
  "packages/reference/entries/WeirdNumbers.yaml",
  "packages/reference/entries/PracticalNumbers.yaml",
  "packages/reference/entries/HighlyCompositeNumbers.yaml",
  "packages/reference/entries/SuperabundantNumbers.yaml",
  "packages/reference/entries/ArithmeticNumbers.yaml",
  "packages/reference/entries/UntouchableNumbers.yaml",
  "packages/reference/entries/AchillesNumbers.yaml",
  "packages/reference/entries/PowerfulNumbers.yaml",
  "packages/reference/entries/PerfectPowerNumbers.yaml",
  "packages/reference/entries/SquareFreeNumbers.yaml",
  "packages/reference/entries/KFreeIntegers.yaml",
  "packages/reference/entries/CarmichaelNumbers.yaml",
  "packages/reference/entries/GiugaNumbers.yaml",
  "packages/reference/entries/IdonealNumbers.yaml",
  "packages/reference/entries/LuckyNumbers.yaml",
  "packages/reference/entries/HarshadNumbers.yaml",
  "packages/reference/entries/HappyNumbers.yaml",
  "packages/reference/entries/NarcissisticNumbers.yaml",
  "packages/reference/entries/AutomorphicNumbers.yaml",
  "packages/reference/entries/KaprekarNumbers.yaml",
  "packages/reference/entries/EvilNumbers.yaml",
  "packages/reference/entries/OdiousNumbers.yaml",
  "packages/reference/entries/PerniciousNumbers.yaml",
  "packages/reference/entries/SmithNumbers.yaml",
  "packages/reference/entries/SemiprimeNumbers.yaml",
  "packages/reference/entries/SquarefreeSemiprimes.yaml",
  "packages/reference/entries/SphenicNumbers.yaml",
  "packages/reference/entries/PrimePowerNumbers.yaml",
  "packages/reference/entries/KAlmostPrimes.yaml",
  "packages/reference/entries/RoughNumbers.yaml",
  "packages/reference/entries/TwinPrimes.yaml",
  "packages/reference/entries/CousinPrimes.yaml",
  "packages/reference/entries/SexyPrimes.yaml",
  "packages/reference/entries/SophieGermainPrimes.yaml",
  "packages/reference/entries/SafePrimes.yaml",
  "packages/reference/entries/PrimePairs.yaml",
  "packages/reference/entries/PalindromicPrimes.yaml",
  "packages/reference/entries/CircularPrimes.yaml",
  "packages/reference/entries/EmirpPrimes.yaml",
  "packages/reference/entries/MersennePrimes.yaml",
  "packages/reference/entries/FibonacciPrimes.yaml",
];

export const enumerableFamilies: readonly ReferenceEntry[] = [
  {
    name: "Subsets",
    domain: "Collections",
    signature: "Subsets(n)",
    summary: "The power set of $\\{1, …, n\\}$ — every subset, as a lazy indexed family of $2^n$.",
    signatures: [
      {
        call: "Subsets(n)",
        description: "the $2^n$ subsets of $\\{1, …, n\\}$.",
        library: "enumeratio-collections",
      },
      {
        call: "Subsets(collection)",
        description: "the subsets of any finite collection.",
        library: "enumeratio-collections",
      },
      {
        call: "Subsets(n, k)",
        description: "the subsets of $\\{1, …, n\\}$ of size at most $k$.",
        library: "enumeratio-collections",
      },
      {
        call: "Subsets(n, {k})",
        description: "the subsets of $\\{1, …, n\\}$ of size exactly $k$.",
        library: "enumeratio-collections",
      },
      {
        call: "Subsets(n, {kmin, kmax, dn})",
        description:
          "the subsets of $\\{1, …, n\\}$ with size in $kmin, kmin+dn, …$ up to $kmax$; $dn$ defaults to $1$.",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(Subsets(n)) = 2^n$ in closed form and $At(Subsets(n), i)$ unranks the $i$-th subset, so no subset beyond the page in view is built.",
      "The subsets carrying a fixed size $k$ number $\\binom{n}{k}$; summing over $k$ gives $2^n$. See [[Binomial]].",
      "Each element is the subset's list of members; [[Length]] is its size.",
    ],
    examples: [
      {
        id: "the-documented-subsets-collection-form-listed-in",
        expr: ["Subsets", ["List", "a", "b", "c"]],
        expected: [
          "List",
          ["List"],
          ["List", "a"],
          ["List", "b"],
          ["List", "a", "b"],
          ["List", "c"],
          ["List", "a", "c"],
          ["List", "b", "c"],
          ["List", "a", "b", "c"],
        ],
        caption:
          "The documented $Subsets(collection)$ form, listed in the family's binary-mask order",
        divergence: { wolfram: "Wolfram lists the subsets by size: {}, {a}, {b}, {c}, {a, b}, …" },
      },
      {
        id: "a-size-bound-the-subsets-with-at-most-2-elements",
        expr: ["Count", ["Subsets", 4, 2]],
        expected: 11,
        category: "Scope",
        caption: "A size bound: the subsets with at most 2 elements, $1 + 4 + 6$",
      },
      {
        id: "an-exact-size-2-binom-4-2-subsets",
        expr: ["Count", ["Subsets", 4, ["List", 2]]],
        expected: 6,
        category: "Scope",
        caption: "An exact size $\\{2\\}$: $\\binom{4}{2}$ subsets",
      },
      {
        id: "a-size-range-0-5-2-the-even-size-subsets-2-4-of",
        expr: ["Count", ["Subsets", 5, ["List", 0, 5, 2]]],
        expected: 16,
        category: "Scope",
        caption: "A size range $\\{0, 5, 2\\}$, the even-size subsets, $2^{4}$ of them",
      },
      {
        id: "a-set-of-n-elements-has-2-n-subsets-count",
        expr: ["Length", ["Subsets", ["Range", 1, 10]]],
        expected: 1024,
        category: "Properties",
        caption: "A set of $n$ elements has $2^n$ subsets: $Count(Subsets(list)) = 2^n$",
      },
      {
        id: "counting-by-size-sum-k-binom-n-k-2-n-subsets-of",
        expr: ["Sum", ["Binomial", 5, "k"], ["Tuple", "k", 0, 5]],
        expected: 32,
        category: "Properties",
        caption:
          "Counting by size: $\\sum_k \\binom{n}{k} = 2^n$ subsets of a 5-set. See [[Binomial]]",
      },
    ],
    enumerate: { expr: "Subsets(4)", columns: "Length, Sum", glyph: "subset" },
    seeAlso: ["Binomial", "Length", "Count", "At"],
  },
  {
    name: "SymmetricGroup",
    domain: "Collections",
    signature: "SymmetricGroup(n)",
    summary: "The $n!$ permutations of $\\{1, …, n\\}$ as a lazy indexed family, in one-line form.",
    signatures: [
      {
        call: "SymmetricGroup(n)",
        description: "the $n!$ permutations of $\\{1, …, n\\}$.",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(SymmetricGroup(n)) = n!$ and $At$ unranks the $i$-th permutation, so $SymmetricGroup(20)$ — over $2 \\times 10^{18}$ rows — pages as cheaply as a small one.",
      "Each element is the image word $[\\pi(1), …, \\pi(n)]$; the classical statistics ([[Descents]], MajorIndex, Inversions, CycleCount, FixedPoints) are heads over that word.",
      "The derangements — permutations with no fixed point — number $Subfactorial(n)$. See [[Subfactorial]].",
    ],
    examples: [
      {
        id: "the-order-of-s-5-is-5",
        expr: ["GroupOrder", ["SymmetricGroup", 5]],
        expected: 120,
        caption: "The order of $S_5$ is $5!$",
      },
      {
        id: "s-10-10",
        expr: ["GroupOrder", ["SymmetricGroup", 10]],
        expected: 3628800,
        category: "Scope",
        caption: "$|S_{10}| = 10!$",
      },
      {
        id: "the-one-line-words-are-compute-engine-s",
        expr: ["Length", ["Permutations", ["List", 1, 2, 3]]],
        expected: 6,
        category: "Properties",
        caption:
          "The one-line words are compute-engine's Permutations of $1, …, n$, $n!$ of them. See [[Factorial]]",
      },
    ],
    enumerate: {
      expr: "SymmetricGroup(5)",
      columns: "Descents, MajorIndex, Inversions, CycleCount, FixedPoints",
      glyph: "permutation",
    },
    seeAlso: ["Factorial", "Subfactorial", "Count", "At"],
  },
  {
    name: "IntegerPartitions",
    domain: "Collections",
    signature: "IntegerPartitions(n)",
    summary: "The partitions of $n$ into positive parts, as a lazy indexed family.",
    signatures: [
      {
        call: "IntegerPartitions(n)",
        description: "every way to write $n$ as a sum of positive parts, order-insensitive.",
        library: "enumeratio-collections",
      },
      {
        call: "IntegerPartitions(n, k)",
        description: "the partitions of $n$ into at most $k$ parts.",
        library: "enumeratio-collections",
      },
      {
        call: "IntegerPartitions(n, {k})",
        description: "the partitions of $n$ into exactly $k$ parts.",
        library: "enumeratio-collections",
      },
      {
        call: "IntegerPartitions(n, All, parts)",
        description: "the partitions of $n$ using only parts drawn from the given list.",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "A lazy indexed collection, unranked in reverse-lexicographic order; the count is the partition number $p(n)$ — $p(8) = 22$ — with no elementary closed form.",
      "Each element is the part list in weakly decreasing order; drawn as a Ferrers diagram, its statistics (Length, LargestPart, DurfeeSquare, …) live in $@enumeratio/statistics$.",
      "Conjugation (transposing the diagram) is an involution; the self-conjugate partitions of $n$ equal the partitions of $n$ into distinct odd parts.",
    ],
    examples: [
      {
        id: "the-partitions-of-8-into-at-most-3-parts",
        expr: ["IntegerPartitions", 8, 3],
        expected: [
          "List",
          ["List", 8],
          ["List", 7, 1],
          ["List", 6, 2],
          ["List", 6, 1, 1],
          ["List", 5, 3],
          ["List", 5, 2, 1],
          ["List", 4, 4],
          ["List", 4, 3, 1],
          ["List", 4, 2, 2],
          ["List", 3, 3, 2],
        ],
        caption: "The partitions of 8 into at most 3 parts",
      },
      {
        id: "exactly-3-parts",
        expr: ["IntegerPartitions", 8, ["List", 3]],
        expected: [
          "List",
          ["List", 6, 1, 1],
          ["List", 5, 2, 1],
          ["List", 4, 3, 1],
          ["List", 4, 2, 2],
          ["List", 3, 3, 2],
        ],
        category: "Scope",
        caption: "Exactly 3 parts",
      },
      {
        id: "parts-restricted-to-1-2-5",
        expr: ["IntegerPartitions", 8, "All", ["List", 1, 2, 5]],
        expected: [
          "List",
          ["List", 5, 2, 1],
          ["List", 5, 1, 1, 1],
          ["List", 2, 2, 2, 2],
          ["List", 2, 2, 2, 1, 1],
          ["List", 2, 2, 1, 1, 1, 1],
          ["List", 2, 1, 1, 1, 1, 1, 1],
          ["List", 1, 1, 1, 1, 1, 1, 1, 1],
        ],
        category: "Scope",
        caption: "Parts restricted to $\\{1, 2, 5\\}$",
      },
      {
        id: "the-family-has-p-8-22-members-compute-engine-s",
        expr: ["NPartition", 8],
        expected: 22,
        category: "Properties",
        caption: "The family has $p(8) = 22$ members, compute-engine's NPartition",
      },
      {
        id: "the-ways-to-make-change-for-a-dollar-from-1-5-10",
        expr: ["Count", ["IntegerPartitions", 100, "All", ["List", 1, 5, 10, 25, 50]]],
        expected: 292,
        category: "Applications",
        caption: "The ways to make change for a dollar from 1, 5, 10, 25 and 50 cent coins",
      },
      {
        id: "euler-partitions-into-odd-parts-are-as-many-as",
        expr: ["Count", ["IntegerPartitions", 10, "All", ["List", 1, 3, 5, 7, 9]]],
        expected: 10,
        category: "Neat examples",
        caption:
          "Euler: partitions into odd parts are as many as partitions into distinct parts, $q(10) = 10$. See [[DistinctPartitions]]",
      },
    ],
    enumerate: {
      expr: "IntegerPartitions(8)",
      columns: "Length, LargestPart, DistinctParts, DurfeeSquare",
      glyph: "partition",
    },
    seeAlso: ["Count", "At", "Length"],
  },
  {
    name: "DyckPaths",
    domain: "Collections",
    signature: "DyckPaths(n)",
    summary:
      "The Dyck paths of semilength $n$ — balanced up/down words — a lazy family of Catalan many.",
    signatures: [
      {
        call: "DyckPaths(n)",
        description:
          "the $C_n$ lattice paths of $n$ up- and $n$ down-steps that never dip below the axis.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is the Catalan number $C_n = \\frac{1}{n+1}\\binom{2n}{n}$ — $C_4 = 14$. See [[CatalanNumber]].",
      "Each element is the step word (1 up, 0 down); drawn as a mountain range. Height, Area, Returns and Hills are Dyck-path statistics.",
      "In bijection with binary trees, triangulations, and non-crossing partitions — all Catalan families.",
    ],
    examples: [],
    enumerate: { expr: "DyckPaths(4)", columns: "Height, Area, Returns", glyph: "dyck" },
    seeAlso: ["CatalanNumber", "Count", "At"],
  },
  {
    name: "SetPartitions",
    domain: "Collections",
    signature: "SetPartitions(n)",
    summary:
      "The partitions of the set $\\{1, …, n\\}$ into non-empty blocks, a lazy indexed family.",
    signatures: [
      {
        call: "SetPartitions(n)",
        description: "every way to split $\\{1, …, n\\}$ into disjoint non-empty blocks.",
        library: "enumeratio-collections",
      },
      {
        call: "SetPartitions(n, k)",
        description: "the set partitions of $\\{1, …, n\\}$ into exactly $k$ blocks.",
        library: "enumeratio-collections",
      },
      {
        call: "SetPartitions(collection)",
        description: "the set partitions of any finite collection.",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "A lazy indexed collection; the count is the Bell number $B_n$ — $B_4 = 15$. See [[BellNumber]].",
      "The partitions into exactly $k$ blocks number the Stirling numbers of the second kind $S(n, k)$; summing over $k$ gives $B_n$. See [[Stirling]].",
      "Each element is the block list; the $set$-$partition$ glyph draws it from its restricted-growth string.",
    ],
    examples: [
      {
        id: "the-set-partitions-of-an-explicit-list-in-the",
        expr: ["SetPartitions", ["List", "a", "b", "c"]],
        expected: [
          "List",
          ["List", ["List", "a", "b", "c"]],
          ["List", ["List", "a", "b"], ["List", "c"]],
          ["List", ["List", "a", "c"], ["List", "b"]],
          ["List", ["List", "a"], ["List", "b", "c"]],
          ["List", ["List", "a"], ["List", "b"], ["List", "c"]],
        ],
        caption: "The set partitions of an explicit list, in the family's own RGS order",
      },
      {
        id: "exactly-2-blocks",
        expr: ["SetPartitions", 3, 2],
        expected: [
          "List",
          ["List", ["List", 1, 2], ["List", 3]],
          ["List", ["List", 1, 3], ["List", 2]],
          ["List", ["List", 1], ["List", 2, 3]],
        ],
        category: "Scope",
        caption: "Exactly 2 blocks",
      },
      {
        id: "the-partitions-of-a-4-set-into-2-blocks-number-s",
        expr: ["Count", ["SetPartitions", 4, 2]],
        expected: 7,
        category: "Scope",
        caption: "The partitions of a 4-set into 2 blocks number $S(4, 2) = 7$",
      },
      {
        id: "the-family-has-b-4-15-members-see-bellnumber",
        expr: ["BellNumber", 4],
        expected: 15,
        category: "Properties",
        caption: "The family has $B_4 = 15$ members. See [[BellNumber]]",
      },
      {
        id: "those-with-exactly-2-blocks-number-s-4-2-7-see",
        expr: ["Stirling", 4, 2],
        expected: 7,
        category: "Properties",
        caption: "Those with exactly 2 blocks number $S(4, 2) = 7$. See [[Stirling]]",
      },
    ],
    enumerate: {
      expr: "SetPartitions(4)",
      columns: "Length, Max(Map(Length, _))",
      glyph: "set-partition",
    },
    seeAlso: ["BellNumber", "Stirling", "Count", "At"],
  },
  {
    name: "Primes",
    domain: "Collections",
    signature: "Primes",
    summary:
      "The prime numbers $2, 3, 5, 7, 11, …$ as a lazy indexed collection, unranked by position.",
    signatures: [
      {
        call: "Primes",
        description: "the primes in increasing order, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(Primes) = +\\infty$, and $At(Primes, k)$ unranks the $k$-th prime without ever sieving a full prefix -- $At(Primes, 5) = 11$.",
      "OEIS A000040.",
      "Membership goes through [[Element]]: $Element(11, Primes)$ is true, $Element(9, Primes)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(Primes, 20)" },
    seeAlso: ["Count", "At", "Element", "SquareNumbers", "AbundantNumbers", "SmoothNumbers"],
  },
  {
    name: "SquareNumbers",
    domain: "Collections",
    signature: "SquareNumbers",
    summary:
      "The perfect squares $1, 4, 9, 16, …$ as a lazy indexed collection, unranked by position.",
    signatures: [
      {
        call: "SquareNumbers",
        description: "the squares $k^2$ for $k = 1, 2, 3, …$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(SquareNumbers) = +\\infty$, and $At(SquareNumbers, k) = k^2$ unranks in closed form -- $At(SquareNumbers, 5) = 25$.",
      "OEIS A000290.",
      "Membership goes through [[Element]]: $Element(16, SquareNumbers)$ is true, $Element(15, SquareNumbers)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(SquareNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "Primes", "AbundantNumbers"],
  },
  {
    name: "AbundantNumbers",
    domain: "Collections",
    signature: "AbundantNumbers",
    summary:
      "The abundant numbers $12, 18, 20, 24, …$ -- integers whose proper divisors sum past them -- as a lazy indexed collection.",
    signatures: [
      {
        call: "AbundantNumbers",
        description:
          "the $n$ with $\\sigma(n) - n > n$ (proper-divisor sum exceeds $n$), an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(AbundantNumbers) = +\\infty$, and $At(AbundantNumbers, k)$ unranks the $k$-th abundant number by scanning forward from the last cached match -- $At(AbundantNumbers, 5) = 30$.",
      "OEIS A005101.",
      "Membership goes through [[Element]]: $Element(12, AbundantNumbers)$ is true, $Element(28, AbundantNumbers)$ is false (perfect, not abundant).",
    ],
    examples: [],
    enumerate: { expr: "Take(AbundantNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "Primes", "SquareNumbers"],
  },
  {
    name: "SmoothNumbers",
    domain: "Collections",
    signature: "SmoothNumbers(k)",
    summary:
      "The $k$-smooth numbers -- positive integers with every prime factor $\\le k$ -- as a lazy indexed family, one collection per $k$.",
    signatures: [
      {
        call: "SmoothNumbers(k)",
        description:
          "the positive integers whose prime factors are all $\\le k$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection for each $k$: $Count(SmoothNumbers(k)) = +\\infty$, and $At(SmoothNumbers(k), i)$ unranks the $i$-th $k$-smooth number -- $At(SmoothNumbers(7), 1) = 1$ (vacuously smooth).",
      "7-smooth numbers are OEIS A002473.",
      "Membership goes through [[Element]]: $Element(12, SmoothNumbers(7))$ is true (its factors $2, 3 \\le 7$), $Element(22, SmoothNumbers(7))$ is false ($22 = 2 \\times 11$).",
    ],
    examples: [],
    enumerate: { expr: "Take(SmoothNumbers(7), 20)" },
    seeAlso: ["Count", "At", "Element", "Primes"],
  },
  {
    name: "RootedUnlabeledTrees",
    domain: "Collections",
    signature: "RootedUnlabeledTrees(n)",
    summary:
      "The rooted trees on $n$ unlabelled nodes, up to isomorphism, as a lazy indexed family.",
    signatures: [
      {
        call: "RootedUnlabeledTrees(n)",
        library: "enumeratio-collections",
        description:
          "every rooted tree on $n$ nodes with unordered children, one per isomorphism class.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is $A000081(n)$ — $A000081(6) = 20$ — with no elementary closed form, computed via the Euler transform over smaller rooted-tree counts (a multiset of subtrees hangs off the root).",
      "Each element is the level sequence: node depths in canonical preorder, root first at depth 0. Canonical means a node's children are generated weight-descending, ties broken by ascending own rank — the order `At` unranks in, so isomorphic labellings collapse to one entry.",
      "$UnlabeledFreeTrees(n)$ is the unrooted counterpart: a free tree canonically rooted at its centroid uses the same level-sequence encoding.",
    ],
    examples: [
      {
        id: "count-rootedunlabeledtrees-6-20-a000081",
        expr: ["Count", ["RootedUnlabeledTrees", 6]],
        expected: 20,
        category: "Basic",
        caption: "$Count(RootedUnlabeledTrees(6)) = 20$, A000081",
      },
    ],
    enumerate: { expr: "RootedUnlabeledTrees(6)", columns: "Max" },
    seeAlso: ["UnlabeledFreeTrees", "Count", "At"],
  },
  {
    name: "UnlabeledFreeTrees",
    domain: "Collections",
    signature: "UnlabeledFreeTrees(n)",
    summary: "The free (unrooted) trees on $n$ unlabelled nodes, up to isomorphism.",
    signatures: [
      {
        call: "UnlabeledFreeTrees(n)",
        library: "enumeratio-collections",
        description:
          "every tree on $n$ unlabelled nodes with no distinguished root, one per isomorphism class.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is $A000055(n)$ — $A000055(7) = 11$ — obtained by canonically rooting each free tree at its centroid: every branch must weigh at most $\\lfloor n/2 \\rfloor$, then a correction $\\binom{T(m), 2}$ (Otter 1948) removes the double count from trees split by a central edge into two non-isomorphic halves.",
      "Each element is a level sequence, exactly as for $RootedUnlabeledTrees$, but rooted at the tree's centroid rather than an arbitrary node.",
      "See [[Binomial]] for the correction term and [[RootedUnlabeledTrees]] for the shared encoding and children-multiset kernel.",
    ],
    examples: [
      {
        id: "count-unlabeledfreetrees-7-11-a000055",
        expr: ["Count", ["UnlabeledFreeTrees", 7]],
        expected: 11,
        category: "Basic",
        caption: "$Count(UnlabeledFreeTrees(7)) = 11$, A000055",
      },
    ],
    enumerate: { expr: "UnlabeledFreeTrees(7)", columns: "Max" },
    seeAlso: ["RootedUnlabeledTrees", "Binomial", "Count", "At"],
  },
  {
    name: "PhylogeneticTrees",
    domain: "Collections",
    signature: "PhylogeneticTrees(n)",
    summary:
      "The rooted binary trees on $n$ labeled leaves with unlabeled internal nodes, as a lazy indexed family.",
    signatures: [
      {
        call: "PhylogeneticTrees(n)",
        library: "enumeratio-collections",
        description:
          "every rooted binary tree with leaves labeled $1, …, n$ and unlabeled internal nodes.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is $(2n-3)!! = A001147(n-2)$ — $PhylogeneticTrees(5)$ has $105$ elements. See [[Factorial2]].",
      "Built by successive insertion: start from the cherry $\\{1,2\\}$, then for $k = 3, …, n$ attach leaf $k$ at one of $2k-3$ places — above the current root, or subdividing one of the tree's edges.",
      "Each element is the digit sequence $(d_3, …, d_n)$ with $d_k \\in [0, 2k-3)$ recording that insertion choice at each step; $At$ unranks it as a mixed-radix number in those insertion-step radices.",
    ],
    examples: [
      {
        id: "count-phylogenetictrees-5-105-2-cdot-5-3-a001147",
        expr: ["Count", ["PhylogeneticTrees", 5]],
        expected: 105,
        category: "Basic",
        caption: "$Count(PhylogeneticTrees(5)) = 105 = (2 \\cdot 5 - 3)!!$, A001147",
      },
    ],
    enumerate: { expr: "PhylogeneticTrees(5)", columns: "Max" },
    seeAlso: ["Factorial2", "Count", "At"],
  },
  {
    name: "NonCrossingTrees",
    domain: "Collections",
    signature: "NonCrossingTrees(n)",
    summary:
      "The spanning trees on $n+1$ circle-labeled points whose edges, drawn as chords, never cross.",
    signatures: [
      {
        call: "NonCrossingTrees(n)",
        library: "enumeratio-collections",
        description:
          "every spanning tree on $n+1$ points around a circle with no two edges crossing.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is the Fuss–Catalan number $\\binom{3n}{n} / (2n+1) = A001764(n)$ — $NonCrossingTrees(3)$ has $12$ elements. See [[Binomial]].",
      "In bijection (Flajolet & Noy 1999) with the ternary trees on $n$ internal nodes; each element reuses that encoding as its flat preorder arity word — $3n+1$ entries, each $0$ (leaf) or $3$ (internal node, followed in preorder by its three children).",
      "The $tree$ glyph draws an element directly from this word, since it is already a preorder child-count sequence.",
    ],
    examples: [
      {
        id: "count-noncrossingtrees-5-273-binom-15-5-11",
        expr: ["Count", ["NonCrossingTrees", 5]],
        expected: 273,
        category: "Basic",
        caption: "$Count(NonCrossingTrees(5)) = 273 = \\binom{15}{5}/11$, A001764",
      },
    ],
    enumerate: { expr: "NonCrossingTrees(3)", glyph: "tree" },
    seeAlso: ["Binomial", "CatalanNumber", "Count", "At"],
  },
  {
    name: "BinaryBracelets",
    domain: "Collections",
    signature: "BinaryBracelets(n)",
    summary:
      "Binary strings of length $n$ up to rotation AND reflection — the dihedral-group orbits of $\\{0,1\\}^n$, a lazy indexed family.",
    signatures: [
      {
        call: "BinaryBracelets(n)",
        library: "enumeratio-collections",
        description: "the bracelets of $n$ black-or-white beads on a necklace that can flip.",
      },
    ],
    details: [
      "A lazy indexed collection; the count follows Burnside's lemma over the dihedral group $D_n$ — a rotation sum shared with binary necklaces, plus a reflection sum that splits on the parity of $n$ (OEIS A000029). See [[Totient]], used in the rotation sum.",
      "Each element is the lexicographically-least word in its rotation-and-reflection orbit; that canonical word's 1-count is an invariant of the whole orbit.",
      "$At$ unranks over these canonical words in ascending lexicographic order.",
    ],
    examples: [
      {
        id: "count-binarybracelets-6-13-a000029",
        expr: ["Count", ["BinaryBracelets", 6]],
        expected: 13,
        category: "Basic",
        caption: "$Count(BinaryBracelets(6)) = 13$, A000029",
      },
    ],
    enumerate: { expr: "BinaryBracelets(6)", columns: "Descents, Ascents" },
    seeAlso: ["KBracelets", "Totient", "Count", "At"],
  },
  {
    name: "KBracelets",
    domain: "Collections",
    signature: "KBracelets(n, k)",
    summary:
      "Words of length $n$ over a $k$-letter alphabet up to rotation and reflection — bracelets over $k$ colours, a lazy indexed family.",
    signatures: [
      {
        call: "KBracelets(n, k)",
        library: "enumeratio-collections",
        description: "the bracelets of $n$ beads, each one of $k$ colours.",
      },
    ],
    details: [
      "A lazy indexed collection; generalises [[BinaryBracelets]] from $k=2$ to any alphabet size, by the same Burnside sum over $D_n$.",
      "Each element is the lexicographically-least word in its rotation-and-reflection orbit, over letters $0,…,k-1$.",
      "$At$ unranks over these canonical words in ascending lexicographic order.",
    ],
    examples: [
      {
        id: "count-kbracelets-4-3-21-bracelets-of-length-4",
        expr: ["Count", ["KBracelets", 4, 3]],
        expected: 21,
        category: "Basic",
        caption: "$Count(KBracelets(4, 3)) = 21$: bracelets of length 4 over a 3-letter alphabet",
      },
      {
        id: "kbracelets-n-2-agrees-with-binarybracelets-n",
        expr: ["Equal", ["Count", ["KBracelets", 5, 2]], ["Count", ["BinaryBracelets", 5]]],
        expected: "True",
        category: "Properties",
        caption:
          "$KBracelets(n, 2)$ agrees with [[BinaryBracelets]]$(n)$ — same Burnside sum over $D_n$",
      },
    ],
    enumerate: { expr: "KBracelets(4, 3)", columns: "Descents, Ascents" },
    seeAlso: ["BinaryBracelets", "Totient", "Count", "At"],
  },
  {
    name: "TriStrings",
    domain: "Collections",
    signature: "TriStrings(n)",
    summary:
      "Binary strings of length $n$ with no run of 3 consecutive 1s, a lazy indexed family counted by the tribonacci recurrence.",
    signatures: [
      {
        call: "TriStrings(n)",
        library: "enumeratio-collections",
        description: "the length-$n$ binary strings avoiding three 1s in a row.",
      },
    ],
    details: [
      "A lazy indexed collection; the count $T(n)$ satisfies $T(n)=T(n-1)+T(n-2)+T(n-3)$ with $T(0)=1$, $T(1)=2$, $T(2)=4$ — a tribonacci-style recurrence (OEIS A000073, shifted).",
      "Each element is the bit string itself, as a list of 0s and 1s.",
      "$At$ unranks via the same combinatorial-number-system walk as the other binary-word families: at each position, the number of valid completions with a leading 0 sizes the block that sorts first.",
    ],
    examples: [
      {
        id: "count-tristrings-6-44-binary-strings-of-length-6",
        expr: ["Count", ["TriStrings", 6]],
        expected: 44,
        category: "Basic",
        caption:
          "$Count(TriStrings(6)) = 44$: binary strings of length 6 with no run of 3 consecutive 1s",
      },
    ],
    enumerate: { expr: "TriStrings(6)", columns: "Descents, Ascents" },
    seeAlso: ["PrimitiveBinaryStrings", "Count", "At"],
  },
  {
    name: "PrimitiveBinaryStrings",
    domain: "Collections",
    signature: "PrimitiveBinaryStrings(n)",
    summary:
      "Aperiodic binary strings of length $n$ — words with no proper period — a lazy indexed family (OEIS A027375).",
    signatures: [
      {
        call: "PrimitiveBinaryStrings(n)",
        library: "enumeratio-collections",
        description:
          "the length-$n$ binary strings that are not themselves a shorter word repeated.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is $\\sum_{d\\mid n}\\mu(d)\\,2^{n/d}$, the un-normalised sum inside the binary Lyndon-word count. See [[MoebiusMu]].",
      "Every primitive word's $n$ rotations are pairwise distinct and together form the orbit of exactly one length-$n$ Lyndon word, so the family is the union of every such orbit.",
      "Each element is the bit string itself; $At$ unranks over the rotations of the binary Lyndon words, sorted ascending lexicographically.",
    ],
    examples: [
      {
        id: "count-primitivebinarystrings-6-54-a027375",
        expr: ["Count", ["PrimitiveBinaryStrings", 6]],
        expected: 54,
        category: "Basic",
        caption:
          "$Count(PrimitiveBinaryStrings(6)) = 54$, A027375: aperiodic binary strings of length 6",
      },
    ],
    enumerate: { expr: "PrimitiveBinaryStrings(6)", columns: "Descents, Ascents" },
    seeAlso: ["TriStrings", "MoebiusMu", "Count", "At"],
  },
  {
    name: "TernaryGrayCodes",
    domain: "Collections",
    signature: "TernaryGrayCodes(n)",
    summary:
      "Length-$n$ words over $\\{0,1,2\\}$ in base-3 reflected Gray code order, where consecutive words differ by $\\pm1$ in exactly one digit.",
    signatures: [
      {
        call: "TernaryGrayCodes(n)",
        library: "enumeratio-collections",
        description: "the $3^n$ base-3 digit strings of length $n$, Gray-code ordered.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is the closed form $3^n$, but the ORDER is the point — it is the standard reflected-Gray-code recursion (each digit's block traversed forward or reversed in turn), not lexicographic.",
      "Each element is the digit string itself, as a list over $\\{0,1,2\\}$.",
      "$At$ unranks directly into that Gray-code order, so consecutive indices always differ in exactly one digit, by exactly 1.",
    ],
    examples: [
      {
        id: "count-ternarygraycodes-4-3-4-81",
        expr: ["Count", ["TernaryGrayCodes", 4]],
        expected: 81,
        category: "Basic",
        caption: "$Count(TernaryGrayCodes(4)) = 3^4 = 81$",
      },
    ],
    enumerate: { expr: "TernaryGrayCodes(4)", columns: "Descents, Ascents" },
    seeAlso: ["Count", "At"],
  },
  {
    name: "StirlingPermutations",
    domain: "Collections",
    signature: "StirlingPermutations(n)",
    summary:
      "Permutations of the multiset $\\{1,1,2,2,…,n,n\\}$ where everything between the two copies of $i$ exceeds $i$, a lazy indexed family of $(2n-1)!!$.",
    signatures: [
      {
        call: "StirlingPermutations(n)",
        library: "enumeratio-collections",
        description:
          "the $(2n-1)!!$ permutations of $\\{1,1,…,n,n\\}$ with that betweenness property.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is the double factorial $(2n-1)!!$. See [[Factorial2]].",
      "Built by inserting the pair $(k,k)$, for $k=2,…,n$ increasing, into any of the $2(k-1)+1$ gaps of a Stirling permutation of order $k-1$ — every gap is valid because a later pair always carries a larger label.",
      "Each element is the length-$2n$ word itself; $At$ unranks the per-$k$ gap choices as mixed-radix digits (radix $2k-1$ at level $k$), combined by the standard Horner scheme.",
    ],
    examples: [
      {
        id: "count-stirlingpermutations-4-105-7-a001147",
        expr: ["Count", ["StirlingPermutations", 4]],
        expected: 105,
        category: "Basic",
        caption: "$Count(StirlingPermutations(4)) = 105 = 7!!$, A001147",
      },
      {
        id: "count-stirlingpermutations-n-2n-1-see-factorial2",
        expr: ["Equal", ["Count", ["StirlingPermutations", 4]], ["Factorial2", 7]],
        expected: "True",
        category: "Properties",
        caption: "$Count(StirlingPermutations(n)) = (2n-1)!!$. See [[Factorial2]]",
      },
    ],
    enumerate: {
      expr: "StirlingPermutations(4)",
      columns: "Descents, Ascents, MajorIndex, Inversions",
    },
    seeAlso: ["Factorial2", "Count", "At"],
  },
  {
    name: "BaxterPermutations",
    domain: "Collections",
    signature: "BaxterPermutations(n)",
    summary:
      'The permutations of $\\{1, …, n\\}$ avoiding the vincular patterns $2\\text{-}41\\text{-}3$ and $3\\text{-}14\\text{-}2$ — the "41"/"14" descent or ascent must sit at adjacent positions — as a lazy indexed family.',
    signatures: [
      {
        call: "BaxterPermutations(n)",
        library: "enumeratio-collections",
        description: "the Baxter permutations of $\\{1, …, n\\}$.",
      },
    ],
    details: [
      "A lazy indexed collection; the count follows the Chung–Graham–Hoggatt–Kleiman rational formula $\\sum_k \\binom{n+1}{k}\\binom{n+1}{k+1}\\binom{n+1}{k+2} \\big/ \\binom{n+1}{1}\\binom{n+1}{2}$ — A001181: $1, 1, 2, 6, 22, 92, …$",
      "Each element is the one-line word $[\\pi(1), …, \\pi(n)]$, as in [[SymmetricGroup]].",
      "$At$ enumerates all $n!$ permutations in lexicographic (factorial-number-system) order and indexes into those satisfying the avoidance, so the family stays a filtered slice of [[SymmetricGroup]]'s own order.",
    ],
    examples: [
      {
        id: "count-baxterpermutations-4-22-a001181",
        expr: ["Count", ["BaxterPermutations", 4]],
        expected: 22,
        category: "Basic",
        caption: "$Count(BaxterPermutations(4)) = 22$, A001181",
      },
    ],
    enumerate: {
      expr: "BaxterPermutations(4)",
      columns: "Descents, Inversions",
      glyph: "permutation",
    },
    seeAlso: ["SymmetricGroup", "Binomial", "Count", "At"],
  },
  {
    name: "BooleanPermutations",
    domain: "Collections",
    signature: "BooleanPermutations(n)",
    summary:
      "The permutations of $\\{1, …, n\\}$ with no non-adjacent inversion — every inversion $\\pi(i) > \\pi(j)$ has $j = i+1$ — as a lazy indexed family.",
    signatures: [
      {
        call: "BooleanPermutations(n)",
        library: "enumeratio-collections",
        description: "the permutations of $\\{1, …, n\\}$ whose inversions are all adjacent.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is $F(n+1)$ — $1, 1, 2, 3, 5, 8, …$, A000045. See [[Fibonacci]].",
      'As implemented here this is NOT Tenner\'s "Boolean permutations" $Av(321, 3412)$, counted by $F(2n-1)$ (A001519, $1, 1, 2, 5, 13, …$); the two readings first differ at $n = 3$ (3 here against 5 there).',
      "Each permutation is a product of pairwise non-adjacent adjacent transpositions — a bijection with independent sets of the path graph on $\\{1, …, n-1\\}$, i.e. with a length-$(n-1)$ Fibonacci word. $At$ unranks that word and applies its transpositions to the identity.",
    ],
    examples: [
      {
        id: "count-booleanpermutations-5-f-6-8-see-fibonacci",
        expr: ["Count", ["BooleanPermutations", 5]],
        expected: 8,
        category: "Basic",
        caption: "$Count(BooleanPermutations(5)) = F(6) = 8$. See [[Fibonacci]]",
      },
    ],
    enumerate: {
      expr: "BooleanPermutations(4)",
      columns: "Descents, Inversions",
      glyph: "permutation",
    },
    seeAlso: ["Fibonacci", "Count", "At"],
  },
  {
    name: "GrassmannianPermutations",
    domain: "Collections",
    signature: "GrassmannianPermutations(n)",
    summary:
      "The permutations of $\\{1, …, n\\}$ with at most one descent, as a lazy indexed family.",
    signatures: [
      {
        call: "GrassmannianPermutations(n)",
        library: "enumeratio-collections",
        description: "the permutations of $\\{1, …, n\\}$ with at most one descent.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is $2^n - n$, A000325.",
      'A permutation with at most one descent is the sorted-ascending concatenation of a value-subset $A$ (the "first block") with its sorted-ascending complement, split at the descent; every subset gives such a permutation except that the $n+1$ prefix subsets $\\{1, …, k\\}$ all collapse to the identity.',
      "$At$ fixes the identity at rank $0$ and, for increasing block size $k = 1, …, n-1$, unranks $A$ from the size-$k$ subsets in colex order ([[Binomial]]-many minus the one prefix subset already spoken for).",
    ],
    examples: [
      {
        id: "count-grassmannianpermutations-5-2-5-5-27",
        expr: ["Count", ["GrassmannianPermutations", 5]],
        expected: 27,
        category: "Basic",
        caption: "$Count(GrassmannianPermutations(5)) = 2^5 - 5 = 27$, A000325",
      },
      {
        id: "grassmannian-and-cograssmannian-permutations",
        expr: [
          "Equal",
          ["Count", ["GrassmannianPermutations", 5]],
          ["Count", ["CograssmannianPermutations", 5]],
        ],
        expected: "True",
        category: "Properties",
        caption:
          "Grassmannian and Cograssmannian permutations share the same count, $2^n - n$, since value-complementing swaps descents for ascents",
      },
    ],
    enumerate: {
      expr: "GrassmannianPermutations(4)",
      columns: "Descents, Inversions",
      glyph: "permutation",
    },
    seeAlso: ["CograssmannianPermutations", "Binomial", "Count", "At"],
  },
  {
    name: "CograssmannianPermutations",
    domain: "Collections",
    signature: "CograssmannianPermutations(n)",
    summary:
      "The permutations of $\\{1, …, n\\}$ with at most one ascent — the value-complement of a [[GrassmannianPermutations]] permutation — as a lazy indexed family.",
    signatures: [
      {
        call: "CograssmannianPermutations(n)",
        library: "enumeratio-collections",
        description: "the permutations of $\\{1, …, n\\}$ with at most one ascent.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is the same $2^n - n$ as [[GrassmannianPermutations]] (A000325), since complementing every value $v \\mapsto n+1-v$ turns each descent into an ascent and vice versa.",
      "Each element is the one-line word of the complemented permutation.",
      "$At$ unranks the Grassmannian permutation of the same rank and applies the value-complement, so it inherits that family's order (identity first, then increasing first-block size).",
    ],
    examples: [
      {
        id: "count-cograssmannianpermutations-5-2-5-5-27",
        expr: ["Count", ["CograssmannianPermutations", 5]],
        expected: 27,
        category: "Basic",
        caption: "$Count(CograssmannianPermutations(5)) = 2^5 - 5 = 27$, A000325",
      },
    ],
    enumerate: {
      expr: "CograssmannianPermutations(4)",
      columns: "Ascents, Inversions",
      glyph: "permutation",
    },
    seeAlso: ["GrassmannianPermutations", "Count", "At"],
  },
  {
    name: "NonCrossingPermutations",
    domain: "Collections",
    signature: "NonCrossingPermutations(n)",
    summary:
      "The permutations of $\\{1, …, n\\}$ whose cycles, read as a set partition of $\\{1, …, n\\}$, form a non-crossing partition — cycles may hold their elements in any cyclic order — as a lazy indexed family.",
    signatures: [
      {
        call: "NonCrossingPermutations(n)",
        library: "enumeratio-collections",
        description:
          "the permutations of $\\{1, …, n\\}$ whose cycles are a non-crossing set partition.",
      },
    ],
    details: [
      "A lazy indexed collection; the count follows a verified recurrence on the block containing $1$ — $1, 2, 6, 23, 105, …$ — with no OEIS match confirmed for this reading, so none is cited.",
      "As implemented, cyclic order within a block is unconstrained; requiring each cycle's elements to increase (the interval $[e, (1\\,2\\,…\\,n)]$ in absolute order) instead gives the Catalan reading $1, 2, 5, 14, …$",
      "Each element is the one-line word; $At$ enumerates all $n!$ permutations in lexicographic order and indexes into those whose cycles are non-crossing.",
    ],
    examples: [
      {
        id: "count-noncrossingpermutations-5-105",
        expr: ["Count", ["NonCrossingPermutations", 5]],
        expected: 105,
        category: "Basic",
        caption: "$Count(NonCrossingPermutations(5)) = 105$",
      },
    ],
    enumerate: {
      expr: "NonCrossingPermutations(4)",
      columns: "CycleCount, FixedPoints",
      glyph: "permutation",
    },
    seeAlso: ["CatalanNumber", "Count", "At"],
  },
  {
    name: "SeparablePermutations",
    domain: "Collections",
    signature: "SeparablePermutations(n)",
    summary:
      "The permutations of $\\{1, …, n\\}$ avoiding the patterns $2413$ and $3142$, as a lazy indexed family.",
    signatures: [
      {
        call: "SeparablePermutations(n)",
        library: "enumeratio-collections",
        description: "the permutations of $\\{1, …, n\\}$ built up by direct and skew sums.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is the large Schröder numbers, A006318 — $1, 2, 6, 22, 90, …$",
      "Each element is the one-line word; $At$ enumerates all $n!$ permutations in lexicographic order and indexes into those avoiding $2413$ and $3142$ — there is no closed-form unrank of the permutation itself.",
      "Separable permutations are exactly those avoiding every non-trivial [[SimplePermutations]] pattern beyond length $2$ — every one decomposes recursively as a direct or skew sum.",
    ],
    examples: [
      {
        id: "count-separablepermutations-5-90-the-large",
        expr: ["Count", ["SeparablePermutations", 5]],
        expected: 90,
        category: "Basic",
        caption: "$Count(SeparablePermutations(5)) = 90$, the large Schröder numbers A006318",
      },
    ],
    enumerate: {
      expr: "SeparablePermutations(4)",
      columns: "Descents, Inversions",
      glyph: "permutation",
    },
    seeAlso: ["SimplePermutations", "Count", "At"],
  },
  {
    name: "SimplePermutations",
    domain: "Collections",
    signature: "SimplePermutations(n)",
    summary:
      "The permutations of $\\{1, …, n\\}$ with no non-trivial interval — no contiguous run of positions, other than a single position or the whole permutation, whose values form a contiguous range — as a lazy indexed family.",
    signatures: [
      {
        call: "SimplePermutations(n)",
        library: "enumeratio-collections",
        description: "the permutations of $\\{1, …, n\\}$ with no non-trivial interval.",
      },
    ],
    details: [
      "A lazy indexed collection; there is no closed-form count implemented, so it is the enumeration's own length — A111111, $1, 2, 0, 2, 6, 46, 338, 2926, …$",
      "Every permutation of size $\\geq 4$ decomposes into simple permutations by substitution, which makes this family the atoms [[SeparablePermutations]] and every other substitution-closed class are built from.",
      "Each element is the one-line word; $At$ enumerates all $n!$ permutations in lexicographic order and indexes into those with no non-trivial interval.",
    ],
    examples: [
      {
        id: "count-simplepermutations-5-6-a111111",
        expr: ["Count", ["SimplePermutations", 5]],
        expected: 6,
        category: "Basic",
        caption: "$Count(SimplePermutations(5)) = 6$, A111111",
      },
    ],
    enumerate: {
      expr: "SimplePermutations(5)",
      columns: "Descents, Inversions",
      glyph: "permutation",
    },
    seeAlso: ["SeparablePermutations", "Count", "At"],
  },
  {
    name: "SmoothPermutations",
    domain: "Collections",
    signature: "SmoothPermutations(n)",
    summary:
      "The permutations of $\\{1, …, n\\}$ avoiding the patterns $3412$ and $4231$ — those whose Schubert variety is smooth — as a lazy indexed family.",
    signatures: [
      {
        call: "SmoothPermutations(n)",
        library: "enumeratio-collections",
        description: "the permutations of $\\{1, …, n\\}$ whose Schubert variety is smooth.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is A032351 (Bóna, 1998) — $1, 2, 6, 22, 88, 366, …$ — with no simple closed-form generating function.",
      "Each element is the one-line word; $At$ enumerates all $n!$ permutations in lexicographic order and indexes into those avoiding $3412$ and $4231$.",
      "Smoothness of the Schubert variety $X_\\pi$ is equivalent to pattern-avoidance (Lakshmibai–Sandhya, 1990); no closed-form unrank of the permutation itself is implemented.",
    ],
    examples: [
      {
        id: "count-smoothpermutations-5-88-a032351",
        expr: ["Count", ["SmoothPermutations", 5]],
        expected: 88,
        category: "Basic",
        caption: "$Count(SmoothPermutations(5)) = 88$, A032351",
      },
    ],
    enumerate: {
      expr: "SmoothPermutations(4)",
      columns: "Descents, Inversions",
      glyph: "permutation",
    },
    seeAlso: ["VexillaryPermutations", "Count", "At"],
  },
  {
    name: "VexillaryPermutations",
    domain: "Collections",
    signature: "VexillaryPermutations(n)",
    summary:
      "The permutations of $\\{1, …, n\\}$ avoiding the pattern $2143$, as a lazy indexed family.",
    signatures: [
      {
        call: "VexillaryPermutations(n)",
        library: "enumeratio-collections",
        description: "the permutations of $\\{1, …, n\\}$ avoiding $2143$.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is A005802 — $1, 2, 6, 23, 103, 513, …$",
      "Each element is the one-line word; $At$ enumerates all $n!$ permutations in lexicographic order and indexes into those avoiding $2143$.",
      'Vexillary ("flag") permutations are exactly those whose Schubert polynomial is a single Schur polynomial — the name is Lascoux and Schützenberger\'s.',
    ],
    examples: [
      {
        id: "count-vexillarypermutations-5-103-a005802",
        expr: ["Count", ["VexillaryPermutations", 5]],
        expected: 103,
        category: "Basic",
        caption: "$Count(VexillaryPermutations(5)) = 103$, A005802",
      },
    ],
    enumerate: {
      expr: "VexillaryPermutations(4)",
      columns: "Descents, MajorIndex",
      glyph: "permutation",
    },
    seeAlso: ["SmoothPermutations", "Count", "At"],
  },
  {
    name: "SemistandardTableaux",
    domain: "Collections",
    signature: "SemistandardTableaux(size, max_entry)",
    summary:
      "Semistandard Young tableaux of $n$ cells with entries in $\\{1, …, k\\}$, summed over every shape $\\lambda \\vdash n$, as a lazy indexed family.",
    signatures: [
      {
        call: "SemistandardTableaux(size, max_entry)",
        library: "enumeratio-collections",
        description:
          "the SSYT of `size` cells over every partition shape, entries from 1 to `max_entry`.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is the hook-content formula $s_\\lambda(1^k) = \\prod_{(r,c) \\in \\lambda} \\frac{k + c - r}{hook(r,c)}$, summed over every shape $\\lambda \\vdash n$ — exact and closed-form.",
      "Each element is the filling's rows: weakly increasing left to right, strictly increasing top to bottom — semistandard, not standard, so entries may repeat within a row (unlike a standard Young tableau).",
      "Unranked in shape-then-entries order: by row-length shape first, then the flattened filling.",
    ],
    examples: [
      {
        id: "count-semistandardtableaux-4-3-39-every-ssyt-of",
        expr: ["Count", ["SemistandardTableaux", 4, 3]],
        expected: 39,
        category: "Basic",
        caption:
          "$Count(SemistandardTableaux(4, 3)) = 39$: every SSYT of 4 cells with entries in $\\{1,2,3\\}$, summed over shape",
      },
      {
        id: "the-first-ssyt-of-3-cells-with-entries-in-1-2-as",
        expr: ["At", ["SemistandardTableaux", 3, 2], 1],
        expected: ["List", ["List", 1, 1], ["List", 2]],
        category: "Scope",
        caption: "The first SSYT of 3 cells with entries in $\\{1, 2\\}$, as a list of rows",
      },
    ],
    enumerate: { expr: "SemistandardTableaux(4, 3)", columns: "Length" },
    seeAlso: ["IntegerPartitions", "Count", "At"],
  },
  {
    name: "GelfandTsetlin",
    domain: "Collections",
    signature: "GelfandTsetlin(rows, max_entry)",
    summary:
      "Gelfand–Tsetlin patterns — triangular interlacing arrays of $n$ rows with entries in $\\{0, …, k\\}$ — as a lazy indexed family.",
    signatures: [
      {
        call: "GelfandTsetlin(rows, max_entry)",
        library: "enumeratio-collections",
        description:
          "the triangular arrays with `rows` rows (lengths $n, n-1, …, 1$), entries from 0 to `max_entry`, each row interlacing the row above it.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is the closed-form dimension formula $\\prod_{1 \\le i \\le j \\le n} \\frac{k+i+j-1}{i+j-1}$.",
      "Each element is the array's rows, top (length $n$) to bottom (length 1); row $i{+}1$ interlaces row $i$: within a row entries weakly decrease, and $row_i[j] \\ge row_{i+1}[j] \\ge row_i[j+1]$.",
      "Unranked in backtracking generation order — rows built top-down, each row's entries enumerated within the bounds the row above imposes.",
    ],
    examples: [
      {
        id: "count-gelfandtsetlin-3-2-35-gelfand-tsetlin",
        expr: ["Count", ["GelfandTsetlin", 3, 2]],
        expected: 35,
        category: "Basic",
        caption:
          "$Count(GelfandTsetlin(3, 2)) = 35$: Gelfand–Tsetlin patterns with 3 rows, entries up to 2",
      },
    ],
    enumerate: { expr: "GelfandTsetlin(3, 2)" },
    seeAlso: ["Count", "At"],
  },
  {
    name: "AlternatingSignMatrices",
    domain: "Collections",
    signature: "AlternatingSignMatrices(size)",
    summary:
      "The $n \\times n$ alternating sign matrices — entries in $\\{-1, 0, 1\\}$, every row and column summing to 1 with alternating nonzero signs — as a lazy indexed family.",
    signatures: [
      {
        call: "AlternatingSignMatrices(size)",
        library: "enumeratio-collections",
        description: "the ASMs of size `size` × `size`.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is the ASM number $A(n) = \\prod_{j=0}^{n-1} \\frac{(3j+1)!}{(n+j)!}$ (the Robbins numbers, OEIS A005130) — $A(4) = 42$.",
      "Each element is the matrix's rows; every row and column sums to 1, and every partial sum reading a row or column from its start lies in $\\{0, 1\\}$ — the alternating-sign condition.",
      "The permutation matrices are exactly the ASMs with no $-1$ entry; $A(n) \\ge n!$ for every $n$, with equality only at $n \\le 2$.",
    ],
    examples: [
      {
        id: "count-alternatingsignmatrices-4-42-the-asm",
        expr: ["Count", ["AlternatingSignMatrices", 4]],
        expected: 42,
        category: "Basic",
        caption: "$Count(AlternatingSignMatrices(4)) = 42$, the ASM numbers A005130",
      },
    ],
    enumerate: { expr: "AlternatingSignMatrices(4)" },
    seeAlso: ["Count", "At"],
  },
  {
    name: "SkewPartitions",
    domain: "Collections",
    signature: "SkewPartitions(size)",
    summary:
      "Reduced skew shapes $\\lambda/\\mu$ with $n$ cells — no empty row or column — as a lazy indexed family.",
    signatures: [
      {
        call: "SkewPartitions(size)",
        library: "enumeratio-collections",
        description:
          "the reduced skew shapes $\\lambda/\\mu$ with `size` cells total ($|\\lambda| - |\\mu| = n$).",
      },
    ],
    details: [
      "A lazy indexed collection with no known closed form; the count is the cached enumeration's length, following Sage's `SkewPartitions(n)` convention.",
      'Each element packs both partitions as `[λ, μ]`; "reduced" means every row of $\\lambda$ strictly exceeds the matching row of $\\mu$ (no empty row) and every column $1..\\lambda_1$ is covered by some row\'s cells (no empty column).',
      "Unranked lexicographically, by $\\lambda$ first, then by $\\mu$.",
    ],
    examples: [
      {
        id: "count-skewpartitions-4-28-pairs-lambda-mu-with",
        expr: ["Count", ["SkewPartitions", 4]],
        expected: 28,
        category: "Basic",
        caption:
          "$Count(SkewPartitions(4)) = 28$: pairs $(\\lambda, \\mu)$ with $\\mu \\subseteq \\lambda$ and $|\\lambda| - |\\mu| = 4$",
      },
      {
        id: "the-first-skew-shape-of-size-3-as-an-outer-inner",
        expr: ["At", ["SkewPartitions", 3], 1],
        expected: ["List", ["List", 1, 1, 1], ["List"]],
        category: "Scope",
        caption: "The first skew shape of size 3, as an outer/inner partition pair",
      },
    ],
    enumerate: { expr: "SkewPartitions(4)" },
    seeAlso: ["IntegerPartitions", "Count", "At"],
  },
  {
    name: "SkewStandardTableaux",
    domain: "Collections",
    signature: "SkewStandardTableaux(size)",
    summary:
      "Standard Young tableaux on reduced skew shapes $\\lambda/\\mu$, summed over every shape with $n$ cells, as a lazy indexed family.",
    signatures: [
      {
        call: "SkewStandardTableaux(size)",
        library: "enumeratio-collections",
        description:
          "the standard fillings of every reduced skew shape $\\lambda/\\mu$ with `size` cells, entries $1..n$ each once, increasing along rows and down columns.",
      },
    ],
    details: [
      "A lazy indexed collection with no known closed form; the count is the cached enumeration's length, summed over every reduced skew shape from [[SkewPartitions]].",
      "Each element packs `[λ, μ, rowWord]`, where `rowWord[i]` is the 0-based row entry $i{+}1$ was placed in, in placement order; $\\mu = 0$ (every row) recovers a plain standard Young tableau.",
      "Unranked by shape ([[SkewPartitions]]'s $\\lambda$-then-$\\mu$ order), then by row-word within a shape.",
    ],
    examples: [
      {
        id: "count-skewstandardtableaux-3-24-standard",
        expr: ["Count", ["SkewStandardTableaux", 3]],
        expected: 24,
        category: "Basic",
        caption:
          "$Count(SkewStandardTableaux(3)) = 24$: standard fillings of every skew shape of 3 cells",
      },
    ],
    enumerate: { expr: "SkewStandardTableaux(3)" },
    seeAlso: ["SkewPartitions", "Count", "At"],
  },
  {
    name: "ShiftedStandardTableaux",
    domain: "Collections",
    signature: "ShiftedStandardTableaux(size)",
    summary:
      "Standard tableaux on shifted diagrams of strict partitions of $n$ — row $i$ starting one column right of row $i-1$ — as a lazy indexed family.",
    signatures: [
      {
        call: "ShiftedStandardTableaux(size)",
        library: "enumeratio-collections",
        description:
          "the standard fillings of every shifted diagram of a strict partition of `size`, entries $1..n$ increasing along rows and down columns.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is exact but not a simple closed form — computed by recursive corner removal, the same identity the shifted hook-length formula gives; $1, 1, 1, 2, 3, 6, 12, …$ for $n = 0, 1, 2, …$.",
      "Each element is the diagram's rows; row $i$ (0-indexed) occupies columns $i..i{+}shape[i]{-}1$, so a cell shares a column with the cell one row up and one entry over.",
      "Unranked by shape (strict partitions of $n$, in distinct-parts order), then by recursive corner-removal order within a shape — the value $n$ always sits at a removable corner.",
    ],
    examples: [
      {
        id: "count-shiftedstandardtableaux-5-6-standard",
        expr: ["Count", ["ShiftedStandardTableaux", 5]],
        expected: 6,
        category: "Basic",
        caption:
          "$Count(ShiftedStandardTableaux(5)) = 6$: standard fillings of every shifted shape of a strict partition of 5",
      },
    ],
    enumerate: { expr: "ShiftedStandardTableaux(6)", columns: "Length" },
    seeAlso: ["Count", "At"],
  },
  {
    name: "StandardTableauPairs",
    domain: "Collections",
    signature: "StandardTableauPairs(size)",
    summary:
      "Pairs $(P, Q)$ of same-shape standard Young tableaux with $n$ cells — the RSK codomain — as a lazy indexed family of $n!$.",
    signatures: [
      {
        call: "StandardTableauPairs(size)",
        library: "enumeratio-collections",
        description:
          "the $(P, Q)$ pairs of size `size`, in bijection with the permutations of `size` via RSK.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(StandardTableauPairs(n)) = n!$, exact and closed-form, since Robinson–Schensted–Knuth is a bijection $S_n \\leftrightarrow \\{(P, Q)\\}$. See [[Factorial]].",
      "Each element is `[P, Q]`, two standard Young tableaux of the same shape; unranking goes through [[SymmetricGroup]]'s permutation unrank, then forward RSK insertion.",
      "Ranking inverts RSK back to a permutation and reads off [[SymmetricGroup]]'s rank — so the two families share one underlying order.",
    ],
    examples: [
      {
        id: "count-standardtableaupairs-4-4-24-rsk-is-a",
        expr: ["Count", ["StandardTableauPairs", 4]],
        expected: 24,
        category: "Basic",
        caption: "$Count(StandardTableauPairs(4)) = 4! = 24$: RSK is a bijection with permutations",
      },
    ],
    enumerate: { expr: "StandardTableauPairs(4)" },
    seeAlso: ["SymmetricGroup", "Factorial", "Count", "At"],
  },
  {
    name: "PlanePartitions",
    domain: "Collections",
    signature: "PlanePartitions(size)",
    summary:
      "Plane partitions of $n$ — 2D arrays of positive integers nonincreasing along rows and down columns, summing to $n$ — as a lazy indexed family.",
    signatures: [
      {
        call: "PlanePartitions(size)",
        library: "enumeratio-collections",
        description: "the plane partitions summing to `size` (OEIS A000219).",
      },
    ],
    details: [
      "A lazy indexed collection with no known simple closed form, unlike ordinary partitions' generating function; the count is the cached enumeration's length — $Count(PlanePartitions(6)) = 48$.",
      "Each element is the array's rows; entries weakly decrease along every row and down every column, and the whole array sums to $n$.",
      "Unranked in shape-then-entries order: by row-length shape first, then the flattened array.",
    ],
    examples: [
      {
        id: "count-planepartitions-4-13-a000219",
        expr: ["Count", ["PlanePartitions", 4]],
        expected: 13,
        category: "Basic",
        caption: "$Count(PlanePartitions(4)) = 13$, A000219",
      },
    ],
    enumerate: { expr: "PlanePartitions(6)", columns: "Length" },
    seeAlso: ["IntegerPartitions", "Count", "At"],
  },
  {
    name: "BoxedPlanePartitions",
    domain: "Collections",
    signature: "BoxedPlanePartitions(a, b, c)",
    summary:
      "Plane partitions of any size fitting in an $a \\times b \\times c$ box — at most $a$ rows, each at most $b$ long, entries at most $c$ — as a lazy indexed family.",
    signatures: [
      {
        call: "BoxedPlanePartitions(a, b, c)",
        library: "enumeratio-collections",
        description: "the plane partitions fitting an $a \\times b \\times c$ box.",
      },
    ],
    details: [
      "A lazy indexed collection, exact and closed-form by MacMahon's box formula: $Count(BoxedPlanePartitions(a,b,c)) = \\prod_{i=1}^{a} \\prod_{j=1}^{b} \\prod_{k=1}^{c} \\frac{i+j+k-1}{i+j+k-2}$ — $Count(BoxedPlanePartitions(2,2,2)) = 20$.",
      "Each element is the array's rows, [[PlanePartitions]]'s ragged carrier: entries weakly decrease along every row and down every column, with trailing zeros trimmed rather than stored.",
      "Unranked in shape-then-entries order, same as [[PlanePartitions]]; rank/unrank enumerate the box and index into it, so stick to small boxes.",
    ],
    examples: [
      {
        id: "count-boxedplanepartitions-2-2-2-20-macmahon-s",
        expr: ["Count", ["BoxedPlanePartitions", 2, 2, 2]],
        expected: 20,
        category: "Basic",
        caption: "$Count(BoxedPlanePartitions(2,2,2)) = 20$, MacMahon's box formula",
      },
      {
        id: "a-degenerate-1-times-1-times-n-box-count-n-1",
        expr: ["Count", ["BoxedPlanePartitions", 1, 1, 4]],
        expected: 5,
        category: "Scope",
        caption: "A degenerate $1 \\times 1 \\times n$ box: $Count = n + 1$",
      },
    ],
    enumerate: { expr: "BoxedPlanePartitions(2, 2, 2)" },
    seeAlso: ["PlanePartitions", "Count", "At"],
  },
  {
    name: "TriangularNumbers",
    domain: "Collections",
    signature: "TriangularNumbers",
    summary: "The triangular numbers $1, 3, 6, 10, …$ — $T(n) = n(n+1)/2$ — dots in a triangle.",
    signatures: [
      { call: "TriangularNumbers", description: "$T(n) = n(n+1)/2$ for $n = 1, 2, 3, …$." },
    ],
    details: [
      "A lazy indexed collection: $Count(TriangularNumbers) = +\\infty$, and $At(TriangularNumbers, k) = k(k+1)/2$ unranks in closed form -- $At(TriangularNumbers, 5) = 15$.",
      "OEIS A000217.",
      "Membership goes through [[Element]] by inverting the closed form exactly: $x$ is triangular iff $8x+1$ is a perfect square -- $Element(15, TriangularNumbers)$ is true, $Element(14, TriangularNumbers)$ is false.",
      "The $k$-gonal case $k=3$ of [[PolygonalNumbers]].",
    ],
    examples: [],
    enumerate: { expr: "Take(TriangularNumbers, 20)" },
    seeAlso: ["PolygonalNumbers", "SquareNumbers", "PentagonalNumbers", "Count", "At", "Element"],
  },
  {
    name: "PentagonalNumbers",
    domain: "Collections",
    signature: "PentagonalNumbers",
    summary: "The pentagonal numbers $1, 5, 12, 22, …$ — $P(n) = n(3n-1)/2$ — dots in a pentagon.",
    signatures: [
      { call: "PentagonalNumbers", description: "$P(n) = n(3n-1)/2$ for $n = 1, 2, 3, …$." },
    ],
    details: [
      "A lazy indexed collection: $Count(PentagonalNumbers) = +\\infty$, and $At(PentagonalNumbers, k) = k(3k-1)/2$ unranks in closed form -- $At(PentagonalNumbers, 5) = 35$.",
      "OEIS A000326.",
      "Membership goes through [[Element]] by inverting the closed form exactly, solving the quadratic in $n$ over the integers -- $Element(35, PentagonalNumbers)$ is true, $Element(36, PentagonalNumbers)$ is false.",
      "The $k$-gonal case $k=5$ of [[PolygonalNumbers]]; not to be confused with the (signed-index) generalized pentagonal numbers of Euler's pentagonal number theorem.",
    ],
    examples: [],
    enumerate: { expr: "Take(PentagonalNumbers, 20)" },
    seeAlso: [
      "PolygonalNumbers",
      "TriangularNumbers",
      "HexagonalNumbers",
      "Count",
      "At",
      "Element",
    ],
  },
  {
    name: "HexagonalNumbers",
    domain: "Collections",
    signature: "HexagonalNumbers",
    summary: "The hexagonal numbers $1, 6, 15, 28, …$ — $H(n) = n(2n-1)$ — dots in a hexagon.",
    signatures: [
      { call: "HexagonalNumbers", description: "$H(n) = n(2n-1)$ for $n = 1, 2, 3, …$." },
    ],
    details: [
      "A lazy indexed collection: $Count(HexagonalNumbers) = +\\infty$, and $At(HexagonalNumbers, k) = k(2k-1)$ unranks in closed form -- $At(HexagonalNumbers, 5) = 45$.",
      "OEIS A000384.",
      "Membership goes through [[Element]] by inverting the closed form exactly -- $Element(45, HexagonalNumbers)$ is true, $Element(44, HexagonalNumbers)$ is false.",
      "Every hexagonal number is triangular ($H(n) = T(2n-1)$); the $k$-gonal case $k=6$ of [[PolygonalNumbers]].",
    ],
    examples: [],
    enumerate: { expr: "Take(HexagonalNumbers, 20)" },
    seeAlso: [
      "PolygonalNumbers",
      "TriangularNumbers",
      "PentagonalNumbers",
      "Count",
      "At",
      "Element",
    ],
  },
  {
    name: "HeptagonalNumbers",
    domain: "Collections",
    signature: "HeptagonalNumbers",
    summary: "The heptagonal numbers $1, 7, 18, 34, …$ — $n(5n-3)/2$ — dots in a heptagon.",
    signatures: [{ call: "HeptagonalNumbers", description: "$n(5n-3)/2$ for $n = 1, 2, 3, …$." }],
    details: [
      "A lazy indexed collection: $Count(HeptagonalNumbers) = +\\infty$, and $At(HeptagonalNumbers, k) = k(5k-3)/2$ unranks in closed form -- $At(HeptagonalNumbers, 5) = 55$.",
      "OEIS A000566.",
      "Membership goes through [[Element]] by inverting the closed form exactly -- $Element(55, HeptagonalNumbers)$ is true, $Element(54, HeptagonalNumbers)$ is false.",
      "The $k$-gonal case $k=7$ of [[PolygonalNumbers]].",
    ],
    examples: [],
    enumerate: { expr: "Take(HeptagonalNumbers, 20)" },
    seeAlso: ["PolygonalNumbers", "HexagonalNumbers", "OctagonalNumbers", "Count", "At", "Element"],
  },
  {
    name: "OctagonalNumbers",
    domain: "Collections",
    signature: "OctagonalNumbers",
    summary: "The octagonal numbers $1, 8, 21, 40, …$ — $n(3n-2)$ — dots in an octagon.",
    signatures: [{ call: "OctagonalNumbers", description: "$n(3n-2)$ for $n = 1, 2, 3, …$." }],
    details: [
      "A lazy indexed collection: $Count(OctagonalNumbers) = +\\infty$, and $At(OctagonalNumbers, k) = k(3k-2)$ unranks in closed form -- $At(OctagonalNumbers, 5) = 65$.",
      "OEIS A000567.",
      "Membership goes through [[Element]] by inverting the closed form exactly -- $Element(65, OctagonalNumbers)$ is true, $Element(64, OctagonalNumbers)$ is false.",
      "The $k$-gonal case $k=8$ of [[PolygonalNumbers]].",
    ],
    examples: [],
    enumerate: { expr: "Take(OctagonalNumbers, 20)" },
    seeAlso: ["PolygonalNumbers", "HeptagonalNumbers", "Count", "At", "Element"],
  },
  {
    name: "PolygonalNumbers",
    domain: "Collections",
    signature: "PolygonalNumbers(k)",
    summary:
      "The $k$-gonal figurate numbers $P(k, n) = \\big((k-2)n^2 - (k-4)n\\big)/2$, one lazy indexed collection per polygon size $k \\ge 3$.",
    signatures: [
      {
        call: "PolygonalNumbers(k)",
        description: "$P(k, n)$ for $n = 1, 2, 3, …$, the $k$-gonal numbers.",
      },
    ],
    details: [
      "A lazy indexed family for each $k \\ge 3$: $Count(PolygonalNumbers(k)) = +\\infty$, and $At(PolygonalNumbers(k), n)$ unranks $P(k, n)$ in closed form -- $At(PolygonalNumbers(5), 3) = 12$.",
      "$k = 3, 4, 5, 6, 7, 8$ reproduce [[TriangularNumbers]], [[SquareNumbers]], [[PentagonalNumbers]], [[HexagonalNumbers]], [[HeptagonalNumbers]] and [[OctagonalNumbers]] termwise; those fixed-$k$ names exist as their own lazy collections for convenience, not as a separate definition.",
      "Membership goes through [[Element]] by inverting the quadratic in $n$ exactly for the given $k$ -- $Element(12, PolygonalNumbers(5))$ is true, $Element(13, PolygonalNumbers(5))$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(PolygonalNumbers(5), 20)" },
    seeAlso: [
      "TriangularNumbers",
      "SquareNumbers",
      "PentagonalNumbers",
      "HexagonalNumbers",
      "Count",
      "At",
      "Element",
    ],
  },
  {
    name: "CenteredTriangularNumbers",
    domain: "Collections",
    signature: "CenteredTriangularNumbers",
    summary:
      "The centered triangular numbers $1, 4, 10, 19, …$ — $(3n^2-3n+2)/2$ — a triangle of dots grown ring by ring around a center.",
    signatures: [
      { call: "CenteredTriangularNumbers", description: "$(3n^2-3n+2)/2$ for $n = 1, 2, 3, …$." },
    ],
    details: [
      "A lazy indexed collection: $Count(CenteredTriangularNumbers) = +\\infty$, and $At(CenteredTriangularNumbers, k) = (3k^2-3k+2)/2$ unranks in closed form -- $At(CenteredTriangularNumbers, 5) = 31$.",
      "OEIS A005448.",
      "Membership goes through [[Element]] by inverting the closed form exactly -- $Element(31, CenteredTriangularNumbers)$ is true, $Element(30, CenteredTriangularNumbers)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(CenteredTriangularNumbers, 20)" },
    seeAlso: ["TriangularNumbers", "CenteredSquareNumbers", "Count", "At", "Element"],
  },
  {
    name: "CenteredSquareNumbers",
    domain: "Collections",
    signature: "CenteredSquareNumbers",
    summary:
      "The centered square numbers $1, 5, 13, 25, …$ — $2n^2-2n+1$ — a square of dots grown ring by ring around a center.",
    signatures: [
      { call: "CenteredSquareNumbers", description: "$2n^2-2n+1$ for $n = 1, 2, 3, …$." },
    ],
    details: [
      "A lazy indexed collection: $Count(CenteredSquareNumbers) = +\\infty$, and $At(CenteredSquareNumbers, k) = 2k^2-2k+1$ unranks in closed form -- $At(CenteredSquareNumbers, 5) = 41$.",
      "OEIS A001844.",
      "Membership goes through [[Element]] by inverting the closed form exactly -- $Element(41, CenteredSquareNumbers)$ is true, $Element(40, CenteredSquareNumbers)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(CenteredSquareNumbers, 20)" },
    seeAlso: ["SquareNumbers", "CenteredHexagonalNumbers", "Count", "At", "Element"],
  },
  {
    name: "CenteredHexagonalNumbers",
    domain: "Collections",
    signature: "CenteredHexagonalNumbers",
    summary:
      "The centered hexagonal numbers $1, 7, 19, 37, …$ — $3n^2-3n+1$ — a hexagon of dots grown ring by ring around a center.",
    signatures: [
      { call: "CenteredHexagonalNumbers", description: "$3n^2-3n+1$ for $n = 1, 2, 3, …$." },
    ],
    details: [
      "A lazy indexed collection: $Count(CenteredHexagonalNumbers) = +\\infty$, and $At(CenteredHexagonalNumbers, k) = 3k^2-3k+1$ unranks in closed form -- $At(CenteredHexagonalNumbers, 5) = 61$.",
      "OEIS A003215.",
      "Membership goes through [[Element]] by inverting the closed form exactly -- $Element(61, CenteredHexagonalNumbers)$ is true, $Element(60, CenteredHexagonalNumbers)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(CenteredHexagonalNumbers, 20)" },
    seeAlso: ["HexagonalNumbers", "CenteredSquareNumbers", "Count", "At", "Element"],
  },
  {
    name: "StarNumbers",
    domain: "Collections",
    signature: "StarNumbers",
    summary:
      "The star numbers $1, 13, 37, 73, …$ — $6n^2-6n+1$ — centered figurate numbers of a six-pointed star.",
    signatures: [{ call: "StarNumbers", description: "$6n^2-6n+1$ for $n = 1, 2, 3, …$." }],
    details: [
      "A lazy indexed collection: $Count(StarNumbers) = +\\infty$, and $At(StarNumbers, k) = 6k^2-6k+1$ unranks in closed form -- $At(StarNumbers, 5) = 121$.",
      "OEIS A003154.",
      "Membership goes through [[Element]] by inverting the closed form exactly -- $Element(121, StarNumbers)$ is true, $Element(120, StarNumbers)$ is false.",
      "Every star number is both centered hexagonal and centered triangular in disguise (it is the centered figurate number of the $\\{6/2\\}$ hexagram).",
    ],
    examples: [],
    enumerate: { expr: "Take(StarNumbers, 20)" },
    seeAlso: ["CenteredHexagonalNumbers", "Count", "At", "Element"],
  },
  {
    name: "PronicNumbers",
    domain: "Collections",
    signature: "PronicNumbers",
    summary:
      "The pronic (oblong) numbers $2, 6, 12, 20, …$ — $n(n+1)$ — twice a triangular number.",
    signatures: [{ call: "PronicNumbers", description: "$n(n+1)$ for $n = 1, 2, 3, …$." }],
    details: [
      "A lazy indexed collection: $Count(PronicNumbers) = +\\infty$, and $At(PronicNumbers, k) = k(k+1)$ unranks in closed form -- $At(PronicNumbers, 5) = 30$.",
      "OEIS A002378, whose offset differs from ours: A002378 opens $a(0) = 0$; this collection starts at $n=1$, so $At(PronicNumbers, 1) = 2$ and the value $0$ is not a member.",
      "Membership goes through [[Element]] by inverting the closed form exactly -- $Element(30, PronicNumbers)$ is true, $Element(29, PronicNumbers)$ is false. $PronicNumbers(k) = 2 \\cdot TriangularNumbers(k)$.",
    ],
    examples: [],
    enumerate: { expr: "Take(PronicNumbers, 20)" },
    seeAlso: ["TriangularNumbers", "SquareNumbers", "Count", "At", "Element"],
  },
  {
    name: "CubeNumbers",
    domain: "Collections",
    signature: "CubeNumbers",
    summary: "The perfect cubes $1, 8, 27, 64, …$ — $n^3$.",
    signatures: [{ call: "CubeNumbers", description: "$n^3$ for $n = 1, 2, 3, …$." }],
    details: [
      "A lazy indexed collection: $Count(CubeNumbers) = +\\infty$, and $At(CubeNumbers, k) = k^3$ unranks in closed form -- $At(CubeNumbers, 5) = 125$.",
      "OEIS A000578.",
      "Membership goes through [[Element]] by bisecting the monotone formula $n \\mapsto n^3$ for its exact integer cube root -- $Element(125, CubeNumbers)$ is true, $Element(126, CubeNumbers)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(CubeNumbers, 20)" },
    seeAlso: ["SquareNumbers", "TetrahedralNumbers", "Count", "At", "Element"],
  },
  {
    name: "TetrahedralNumbers",
    domain: "Collections",
    signature: "TetrahedralNumbers",
    summary:
      "The tetrahedral numbers $1, 4, 10, 20, …$ — $\\binom{n+2}{3}$ — stacked triangles, partial sums of the triangular numbers.",
    signatures: [
      { call: "TetrahedralNumbers", description: "$\\binom{n+2}{3}$ for $n = 1, 2, 3, …$." },
    ],
    details: [
      "A lazy indexed collection: $Count(TetrahedralNumbers) = +\\infty$, and $At(TetrahedralNumbers, k) = \\binom{k+2}{3}$ unranks in closed form -- $At(TetrahedralNumbers, 5) = 35$.",
      "OEIS A000292.",
      "Membership goes through [[Element]] by bisecting the monotone cubic for its exact root -- $Element(35, TetrahedralNumbers)$ is true, $Element(36, TetrahedralNumbers)$ is false.",
      "$TetrahedralNumbers(n) = \\sum_{i=1}^n TriangularNumbers(i)$; the 4-simplex case is [[PentatopeNumbers]].",
    ],
    examples: [],
    enumerate: { expr: "Take(TetrahedralNumbers, 20)" },
    seeAlso: ["TriangularNumbers", "PentatopeNumbers", "Binomial", "Count", "At", "Element"],
  },
  {
    name: "PentatopeNumbers",
    domain: "Collections",
    signature: "PentatopeNumbers",
    summary:
      "The pentatope numbers $1, 5, 15, 35, …$ — $\\binom{n+3}{4}$ — the 4-simplex figurate numbers.",
    signatures: [
      { call: "PentatopeNumbers", description: "$\\binom{n+3}{4}$ for $n = 1, 2, 3, …$." },
    ],
    details: [
      "A lazy indexed collection: $Count(PentatopeNumbers) = +\\infty$, and $At(PentatopeNumbers, k) = \\binom{k+3}{4}$ unranks in closed form -- $At(PentatopeNumbers, 5) = 70$.",
      "OEIS A000332.",
      "Membership goes through [[Element]] by bisecting the monotone quartic for its exact root -- $Element(70, PentatopeNumbers)$ is true, $Element(71, PentatopeNumbers)$ is false.",
      "$PentatopeNumbers(n) = \\sum_{i=1}^n TetrahedralNumbers(i)$, one dimension up from [[TetrahedralNumbers]].",
    ],
    examples: [],
    enumerate: { expr: "Take(PentatopeNumbers, 20)" },
    seeAlso: ["TetrahedralNumbers", "Binomial", "Count", "At", "Element"],
  },
  {
    name: "SquarePyramidalNumbers",
    domain: "Collections",
    signature: "SquarePyramidalNumbers",
    summary:
      "The square pyramidal numbers $1, 5, 14, 30, …$ — $n(n+1)(2n+1)/6$ — stacked squares, partial sums of the square numbers.",
    signatures: [
      { call: "SquarePyramidalNumbers", description: "$n(n+1)(2n+1)/6$ for $n = 1, 2, 3, …$." },
    ],
    details: [
      "A lazy indexed collection: $Count(SquarePyramidalNumbers) = +\\infty$, and $At(SquarePyramidalNumbers, k) = k(k+1)(2k+1)/6$ unranks in closed form -- $At(SquarePyramidalNumbers, 5) = 55$.",
      "OEIS A000330.",
      "Membership goes through [[Element]] by bisecting the monotone cubic for its exact root -- $Element(55, SquarePyramidalNumbers)$ is true, $Element(56, SquarePyramidalNumbers)$ is false.",
      "$SquarePyramidalNumbers(n) = \\sum_{i=1}^n SquareNumbers(i)$.",
    ],
    examples: [],
    enumerate: { expr: "Take(SquarePyramidalNumbers, 20)" },
    seeAlso: ["SquareNumbers", "TetrahedralNumbers", "Count", "At", "Element"],
  },
  {
    name: "PowersOfTwo",
    domain: "Collections",
    signature: "PowersOfTwo",
    summary:
      "The powers of two $1, 2, 4, 8, …$ — subsets of an $n$-set; row-sums of Pascal's triangle.",
    signatures: [{ call: "PowersOfTwo", description: "$2^{n-1}$ for $n = 1, 2, 3, …$." }],
    details: [
      "A lazy indexed collection: $Count(PowersOfTwo) = +\\infty$, and $At(PowersOfTwo, k) = 2^{k-1}$ unranks in closed form, exact for every $k$ -- $At(PowersOfTwo, 60)$ is exact past $2^{53}$, not a rounded double.",
      "OEIS A000079.",
      "Membership goes through [[Element]] by the bit trick $x \\mathbin{\\&} (x-1) = 0$ -- $Element(64, PowersOfTwo)$ is true, $Element(48, PowersOfTwo)$ is false.",
      "$Count(Subsets(n)) = At(PowersOfTwo, n+1)$; see [[Subsets]].",
    ],
    examples: [],
    enumerate: { expr: "Take(PowersOfTwo, 20)" },
    seeAlso: ["Subsets", "FactorialNumbers", "Count", "At", "Element"],
  },
  {
    name: "FactorialNumbers",
    domain: "Collections",
    signature: "FactorialNumbers",
    summary: "The factorials $1, 2, 6, 24, …$ — $n!$ — the number of permutations of $n$ items.",
    signatures: [{ call: "FactorialNumbers", description: "$n!$ for $n = 1, 2, 3, …$." }],
    details: [
      "A lazy indexed collection: $Count(FactorialNumbers) = +\\infty$, and $At(FactorialNumbers, k) = k!$ -- exact for every $k$, since every term is computed over arbitrary-precision integers rather than floats -- $At(FactorialNumbers, 20) = 2432902008176640000$, already past $2^{53}$.",
      "OEIS A000142, whose offset differs from ours: A000142 opens $a(0) = a(1) = 1$ (the duplicate $0! = 1! = 1$); this collection starts at $n=1$, so $At(FactorialNumbers, 1) = 1$ without repeating.",
      "Membership goes through [[Element]] by growing the factorial sequence forward until it reaches or passes the candidate -- $Element(720, FactorialNumbers)$ is true, $Element(700, FactorialNumbers)$ is false. See [[Factorial]] for the scalar function.",
    ],
    examples: [],
    enumerate: { expr: "Take(FactorialNumbers, 20)" },
    seeAlso: ["Factorial", "DoubleFactorialNumbers", "SymmetricGroup", "Count", "At", "Element"],
  },
  {
    name: "DoubleFactorialNumbers",
    domain: "Collections",
    signature: "DoubleFactorialNumbers",
    summary:
      "The odd double factorials $1, 3, 15, 105, …$ — $(2n-1)!!$ — perfect matchings of $K_{2n}$.",
    signatures: [
      { call: "DoubleFactorialNumbers", description: "$(2n-1)!!$ for $n = 1, 2, 3, …$." },
    ],
    details: [
      "A lazy indexed collection: $Count(DoubleFactorialNumbers) = +\\infty$, and $At(DoubleFactorialNumbers, k) = (2k-1)!!$, computed exactly over arbitrary-precision integers -- $At(DoubleFactorialNumbers, 5) = 945$.",
      "OEIS A001147, whose offset differs from ours the same way as [[FactorialNumbers]]: A001147 opens with the duplicate $a(0) = a(1) = 1$; this collection starts at $n=1$ without repeating it.",
      "Membership goes through [[Element]] by growing the sequence forward until it reaches or passes the candidate -- $Element(945, DoubleFactorialNumbers)$ is true, $Element(900, DoubleFactorialNumbers)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(DoubleFactorialNumbers, 20)" },
    seeAlso: ["FactorialNumbers", "PhylogeneticTrees", "Count", "At", "Element"],
  },
  {
    name: "PrimorialNumbers",
    domain: "Collections",
    signature: "PrimorialNumbers",
    summary: "The primorials $2, 6, 30, 210, …$ — $p_n\\#$ — the product of the first $n$ primes.",
    signatures: [{ call: "PrimorialNumbers", description: "$p_n\\#$ for $n = 1, 2, 3, …$." }],
    details: [
      "A lazy indexed collection: $Count(PrimorialNumbers) = +\\infty$, and $At(PrimorialNumbers, k) = p_k\\#$, computed exactly over arbitrary-precision integers -- $At(PrimorialNumbers, 5) = 2310$.",
      "OEIS A002110, whose offset differs from ours: A002110 opens with the empty product $a(0) = 1$; this collection starts at $n=1$ (value $2$), so the empty product is not itself a member.",
      "Membership goes through [[Element]] by growing the sequence forward until it reaches or passes the candidate -- $Element(2310, PrimorialNumbers)$ is true, $Element(2000, PrimorialNumbers)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(PrimorialNumbers, 20)" },
    seeAlso: ["Primes", "FactorialNumbers", "Count", "At", "Element"],
  },
  {
    name: "AllOnes",
    domain: "Collections",
    signature: "AllOnes",
    summary: "The constant sequence $1, 1, 1, …$ as a lazy indexed collection.",
    signatures: [{ call: "AllOnes", description: "the constant $1$, repeated forever." }],
    details: [
      "A lazy indexed collection: $Count(AllOnes) = +\\infty$, and $At(AllOnes, k) = 1$ for every $k$.",
      "OEIS A000012.",
      "A repeated-term collection: every position holds the same value, so $At$ still indexes by position while [[Element]] answers membership in the *set* of values -- $Element(1, AllOnes)$ is true, $Element(2, AllOnes)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(AllOnes, 20)" },
    seeAlso: ["Count", "At", "Element"],
  },
  {
    name: "FibonacciNumbers",
    domain: "Collections",
    signature: "FibonacciNumbers",
    summary: "The Fibonacci numbers $0, 1, 1, 2, 3, 5, …$ as a lazy indexed collection.",
    signatures: [
      {
        call: "FibonacciNumbers",
        description:
          "$F_n = F_{n-1} + F_{n-2}$, $F_0 = 0$, $F_1 = 1$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(FibonacciNumbers) = +\\infty$, and $At(FibonacciNumbers, k)$ unranks the term via a memoised linear recurrence -- $At(FibonacciNumbers, 1) = F_0 = 0$ (`At` is 1-indexed; rank 0 is $F_0$).",
      "OEIS A000045, starting exactly at its offset-0 term: $0, 1, 1, 2, 3, 5, 8, …$.",
      "Membership goes through [[Element]]: $Element(21, FibonacciNumbers)$ is true, $Element(10, FibonacciNumbers)$ is false. $F_1 = F_2 = 1$ repeats, so the sequence is non-decreasing rather than strictly increasing.",
    ],
    examples: [],
    enumerate: { expr: "Take(FibonacciNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "LucasNumbers", "PellNumbers", "TribonacciNumbers"],
  },
  {
    name: "LucasNumbers",
    domain: "Collections",
    signature: "LucasNumbers",
    summary: "The Lucas numbers $2, 1, 3, 4, 7, 11, …$ as a lazy indexed collection.",
    signatures: [
      {
        call: "LucasNumbers",
        description:
          "$L_n = L_{n-1} + L_{n-2}$, $L_0 = 2$, $L_1 = 1$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(LucasNumbers) = +\\infty$, and $At(LucasNumbers, 1) = L_0 = 2$.",
      "OEIS A000032, starting exactly at its offset-0 term: $2, 1, 3, 4, 7, 11, 18, …$. The sequence dips once ($L_0 = 2 > L_1 = 1$) before climbing forever from $L_1$ on.",
      "Membership goes through [[Element]]: $Element(1, LucasNumbers)$ is true, $Element(5, LucasNumbers)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(LucasNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "FibonacciNumbers"],
  },
  {
    name: "JacobsthalNumbers",
    domain: "Collections",
    signature: "JacobsthalNumbers",
    summary: "The Jacobsthal numbers $0, 1, 1, 3, 5, 11, …$ as a lazy indexed collection.",
    signatures: [
      {
        call: "JacobsthalNumbers",
        description:
          "$J_n = J_{n-1} + 2J_{n-2}$, $J_0 = 0$, $J_1 = 1$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(JacobsthalNumbers) = +\\infty$, and $At(JacobsthalNumbers, 1) = J_0 = 0$.",
      "OEIS A001045, starting exactly at its offset-0 term: $0, 1, 1, 3, 5, 11, 21, …$.",
      "Membership goes through [[Element]]: $Element(21, JacobsthalNumbers)$ is true, $Element(4, JacobsthalNumbers)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(JacobsthalNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "PellNumbers"],
  },
  {
    name: "PellNumbers",
    domain: "Collections",
    signature: "PellNumbers",
    summary: "The Pell numbers $0, 1, 2, 5, 12, 29, …$ as a lazy indexed collection.",
    signatures: [
      {
        call: "PellNumbers",
        description:
          "$P_n = 2P_{n-1} + P_{n-2}$, $P_0 = 0$, $P_1 = 1$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(PellNumbers) = +\\infty$, and $At(PellNumbers, 1) = P_0 = 0$.",
      "OEIS A000129, starting exactly at its offset-0 term: $0, 1, 2, 5, 12, 29, 70, …$; strictly increasing from the start.",
      "Membership goes through [[Element]]: $Element(12, PellNumbers)$ is true, $Element(7, PellNumbers)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(PellNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "JacobsthalNumbers", "CentralDelannoyNumbers"],
  },
  {
    name: "TribonacciNumbers",
    domain: "Collections",
    signature: "TribonacciNumbers",
    summary: "The tribonacci numbers $0, 0, 1, 1, 2, 4, 7, …$ as a lazy indexed collection.",
    signatures: [
      {
        call: "TribonacciNumbers",
        description:
          "$T_n = T_{n-1} + T_{n-2} + T_{n-3}$, $T_0 = 0$, $T_1 = 0$, $T_2 = 1$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(TribonacciNumbers) = +\\infty$, and $At(TribonacciNumbers, 1) = T_0 = 0$.",
      "OEIS A000073, starting exactly at its offset-0 term: $0, 0, 1, 1, 2, 4, 7, 13, …$.",
      "Membership goes through [[Element]]: $Element(24, TribonacciNumbers)$ is true, $Element(6, TribonacciNumbers)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(TribonacciNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "FibonacciNumbers"],
  },
  {
    name: "PadovanSequence",
    domain: "Collections",
    signature: "PadovanSequence",
    summary: "The Padovan sequence $1, 0, 0, 1, 0, 1, 1, 1, 2, …$ as a lazy indexed collection.",
    signatures: [
      {
        call: "PadovanSequence",
        description:
          "$a_n = a_{n-2} + a_{n-3}$, $a_0 = 1$, $a_1 = a_2 = 0$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(PadovanSequence) = +\\infty$, and $At(PadovanSequence, 1) = a_0 = 1$.",
      "OEIS A000931, starting exactly at its offset-0 term: $1, 0, 0, 1, 0, 1, 1, 1, 2, 2, 3, …$. The sequence dips through index 4 before climbing forever from $a_4 = 0$ on.",
      "Membership goes through [[Element]]: $Element(9, PadovanSequence)$ is true (it's $a_{16}$, following $…,7,9,12,…$), $Element(6, PadovanSequence)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(PadovanSequence, 20)" },
    seeAlso: ["Count", "At", "Element", "PerrinSequence"],
  },
  {
    name: "PerrinSequence",
    domain: "Collections",
    signature: "PerrinSequence",
    summary: "The Perrin sequence $3, 0, 2, 3, 2, 5, 5, 7, …$ as a lazy indexed collection.",
    signatures: [
      {
        call: "PerrinSequence",
        description:
          "$P_n = P_{n-2} + P_{n-3}$, $P_0 = 3$, $P_1 = 0$, $P_2 = 2$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(PerrinSequence) = +\\infty$, and $At(PerrinSequence, 1) = P_0 = 3$.",
      "OEIS A001608, starting exactly at its offset-0 term: $3, 0, 2, 3, 2, 5, 5, 7, 10, 12, …$. The sequence dips through index 4 before climbing forever from $P_4 = 2$ on.",
      "Membership goes through [[Element]]: $Element(10, PerrinSequence)$ is true, $Element(4, PerrinSequence)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(PerrinSequence, 20)" },
    seeAlso: ["Count", "At", "Element", "PadovanSequence"],
  },
  {
    name: "SternDiatomicSequence",
    domain: "Collections",
    signature: "SternDiatomicSequence",
    summary:
      "Stern's diatomic sequence (the fusc function) $0, 1, 1, 2, 1, 3, 2, 3, …$ as a lazy indexed collection.",
    signatures: [
      {
        call: "SternDiatomicSequence",
        description:
          "$s(0) = 0$, $s(1) = 1$, $s(2n) = s(n)$, $s(2n+1) = s(n) + s(n+1)$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(SternDiatomicSequence) = +\\infty$, and $At(SternDiatomicSequence, 1) = s(0) = 0$; unranking is $O(\\log k)$ via the bit-doubling pair $(s(n), s(n+1))$, not a growing cache.",
      "OEIS A002487, starting exactly at its offset-0 term: $0, 1, 1, 2, 1, 3, 2, 3, 1, 4, …$.",
      "Not monotone, so membership is not 'is this term $\\le$ some bound': every non-negative integer is a term ($0$ appears exactly once, at $n = 0$; every positive integer appears infinitely often). $Element(0, SternDiatomicSequence)$ and $Element(42, SternDiatomicSequence)$ are both true; only a negative or non-integer value is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(SternDiatomicSequence, 20)" },
    seeAlso: ["Count", "At", "Element", "ThueMorseNumbers"],
  },
  {
    name: "ThueMorseNumbers",
    domain: "Collections",
    signature: "ThueMorseNumbers",
    summary: "The Thue–Morse sequence $0, 1, 1, 0, 1, 0, 0, 1, …$ as a lazy indexed collection.",
    signatures: [
      {
        call: "ThueMorseNumbers",
        description: "$t(n) = popcount(n) \\bmod 2$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(ThueMorseNumbers) = +\\infty$, and $At(ThueMorseNumbers, 1) = t(0) = 0$.",
      "OEIS A010060, starting exactly at its offset-0 term: $0, 1, 1, 0, 1, 0, 0, 1, 1, 0, …$.",
      "Not monotone; every term is $0$ or $1$, so membership is exactly $\\{0, 1\\}$ -- $Element(0, ThueMorseNumbers)$ and $Element(1, ThueMorseNumbers)$ are true, everything else (including $2$) is false.",
    ],
    examples: [
      {
        id: "the-first-20-terms-oeis-a010060",
        expr: ["Take", "ThueMorseNumbers", 20],
        expected: ["List", 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1],
        caption: "The first 20 terms, OEIS A010060",
      },
    ],
    enumerate: { expr: "Take(ThueMorseNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "SternDiatomicSequence"],
  },
  {
    name: "CatalanNumbers",
    domain: "Collections",
    signature: "CatalanNumbers",
    summary: "The Catalan numbers $1, 1, 2, 5, 14, 42, …$ as a lazy indexed collection.",
    signatures: [
      {
        call: "CatalanNumbers",
        description: "$C_n = \\binom{2n}{n}/(n+1)$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(CatalanNumbers) = +\\infty$, and $At(CatalanNumbers, k)$ unranks $C_{k-1}$ exactly (bigint arithmetic; $C_{30}$ already exceeds $2^{53}$) -- $At(CatalanNumbers, 1) = C_0 = 1$.",
      "OEIS A000108, starting exactly at its offset-0 term: $1, 1, 2, 5, 14, 42, 132, …$; counts balanced parenthesizations, binary trees, Dyck paths and more.",
      "Membership goes through [[Element]]: $Element(14, CatalanNumbers)$ is true, $Element(10, CatalanNumbers)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(CatalanNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "MotzkinNumbers", "SymmetricGroup"],
  },
  {
    name: "BellNumbers",
    domain: "Collections",
    signature: "BellNumbers",
    summary: "The Bell numbers $1, 1, 2, 5, 15, 52, …$ as a lazy indexed collection.",
    signatures: [
      {
        call: "BellNumbers",
        description: "The number of set partitions of an $n$-set, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(BellNumbers) = +\\infty$, and $At(BellNumbers, k)$ unranks $B_{k-1}$ exactly via a memoised Bell (Aitken's) triangle, bigint throughout -- $At(BellNumbers, 5) = B_4 = 15$.",
      "OEIS A000110, starting exactly at its offset-0 term: $1, 1, 2, 5, 15, 52, 203, …$; $B_{25}$ already exceeds $2^{53}$.",
      "Membership goes through [[Element]]: $Element(15, BellNumbers)$ is true, $Element(10, BellNumbers)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(BellNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "FubiniNumbers", "PartitionNumbers"],
  },
  {
    name: "FubiniNumbers",
    domain: "Collections",
    signature: "FubiniNumbers",
    summary:
      "The Fubini numbers (ordered Bell numbers) $1, 1, 3, 13, 75, 541, …$ as a lazy indexed collection.",
    signatures: [
      {
        call: "FubiniNumbers",
        description:
          "The number of ordered set partitions (rankings with ties allowed) of an $n$-set, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(FubiniNumbers) = +\\infty$, and $At(FubiniNumbers, k)$ unranks term $k-1$ via $a(n) = \\sum_{j=1}^{n} \\binom{n}{j} a(n-j)$, bigint throughout -- $At(FubiniNumbers, 1) = a(0) = 1$.",
      "OEIS A000670, starting exactly at its offset-0 term: $1, 1, 3, 13, 75, 541, 4683, …$.",
      "Membership goes through [[Element]]: $Element(75, FubiniNumbers)$ is true, $Element(20, FubiniNumbers)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(FubiniNumbers, 15)" },
    seeAlso: ["Count", "At", "Element", "BellNumbers"],
  },
  {
    name: "MotzkinNumbers",
    domain: "Collections",
    signature: "MotzkinNumbers",
    summary: "The Motzkin numbers $1, 1, 2, 4, 9, 21, …$ as a lazy indexed collection.",
    signatures: [
      {
        call: "MotzkinNumbers",
        description: "The number of Motzkin paths of length $n$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(MotzkinNumbers) = +\\infty$, and $At(MotzkinNumbers, k)$ unranks term $k-1$ via $M(n) = \\left((2n+1)M(n-1) + 3(n-1)M(n-2)\\right)/(n+2)$, bigint throughout -- $At(MotzkinNumbers, 1) = M_0 = 1$.",
      "OEIS A001006, starting exactly at its offset-0 term: $1, 1, 2, 4, 9, 21, 51, …$.",
      "Membership goes through [[Element]]: $Element(9, MotzkinNumbers)$ is true, $Element(6, MotzkinNumbers)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(MotzkinNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "CatalanNumbers"],
  },
  {
    name: "PartitionNumbers",
    domain: "Collections",
    signature: "PartitionNumbers",
    summary:
      "The integer partition counts $p(n) = 1, 1, 2, 3, 5, 7, …$ as a lazy indexed collection.",
    signatures: [
      {
        call: "PartitionNumbers",
        description:
          "$p(n)$, the number of integer partitions of $n$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(PartitionNumbers) = +\\infty$, and $At(PartitionNumbers, k)$ unranks $p(k-1)$ via Euler's pentagonal-number recurrence, bigint throughout -- $At(PartitionNumbers, 1) = p(0) = 1$.",
      "OEIS A000041, starting exactly at its offset-0 term: $1, 1, 2, 3, 5, 7, 11, 15, …$.",
      "Membership goes through [[Element]]: $Element(11, PartitionNumbers)$ is true, $Element(9, PartitionNumbers)$ is false. See [[IntegerPartitions]] for the partitions themselves, not just their count.",
    ],
    examples: [],
    enumerate: { expr: "Take(PartitionNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "IntegerPartitions", "BellNumbers"],
  },
  {
    name: "CentralDelannoyNumbers",
    domain: "Collections",
    signature: "CentralDelannoyNumbers",
    summary: "The central Delannoy numbers $1, 3, 13, 63, 321, …$ as a lazy indexed collection.",
    signatures: [
      {
        call: "CentralDelannoyNumbers",
        description:
          "The count of king-move lattice paths across an $n \\times n$ grid, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(CentralDelannoyNumbers) = +\\infty$, and $At(CentralDelannoyNumbers, k)$ unranks term $k-1$ via $n D(n) = 3(2n-1)D(n-1) - (n-1)D(n-2)$, $D_0 = 1$, $D_1 = 3$, bigint throughout -- $At(CentralDelannoyNumbers, 1) = D_0 = 1$.",
      "OEIS A001850, starting exactly at its offset-0 term: $1, 3, 13, 63, 321, 1683, …$; strictly increasing.",
      "Membership goes through [[Element]]: $Element(13, CentralDelannoyNumbers)$ is true, $Element(10, CentralDelannoyNumbers)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(CentralDelannoyNumbers, 15)" },
    seeAlso: ["Count", "At", "Element", "SchroederNumbers", "PellNumbers"],
  },
  {
    name: "LittleSchroderNumbers",
    domain: "Collections",
    signature: "LittleSchroderNumbers",
    summary:
      "The little Schröder numbers (super-Catalan numbers) $1, 1, 3, 11, 45, 197, …$ as a lazy indexed collection.",
    signatures: [
      {
        call: "LittleSchroderNumbers",
        description:
          "$s_n$, counting dissections of a convex polygon, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(LittleSchroderNumbers) = +\\infty$, and $At(LittleSchroderNumbers, k)$ unranks term $k-1$ via $(n+1)s(n) = (6n-3)s(n-1) - (n-2)s(n-2)$, $s_0 = s_1 = 1$, bigint throughout -- $At(LittleSchroderNumbers, 1) = s_0 = 1$.",
      "OEIS A001003, starting exactly at its offset-0 term: $1, 1, 3, 11, 45, 197, 903, …$.",
      "Membership goes through [[Element]]: $Element(11, LittleSchroderNumbers)$ is true, $Element(6, LittleSchroderNumbers)$ is false. See [[SchroederNumbers]] -- $s_n$ is exactly half $SchroederNumbers$'s term for $n \\ge 1$.",
    ],
    examples: [],
    enumerate: { expr: "Take(LittleSchroderNumbers, 15)" },
    seeAlso: ["Count", "At", "Element", "SchroederNumbers", "CatalanNumbers"],
  },
  {
    name: "SchroederNumbers",
    domain: "Collections",
    signature: "SchroederNumbers",
    summary: "The (large) Schröder numbers $1, 2, 6, 22, 90, 394, …$ as a lazy indexed collection.",
    signatures: [
      {
        call: "SchroederNumbers",
        description:
          "$S_0 = 1$, $S_n = 2 s_n$ for $n \\ge 1$ (twice the little Schröder numbers), an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(SchroederNumbers) = +\\infty$, and $At(SchroederNumbers, k)$ unranks term $k-1$ by doubling [[LittleSchroderNumbers]] rather than re-deriving a recurrence -- $At(SchroederNumbers, 1) = S_0 = 1$.",
      "OEIS A006318, starting exactly at its offset-0 term: $1, 2, 6, 22, 90, 394, 1806, …$; counts monotone lattice paths from $(0,0)$ to $(n,n)$ using steps $(1,0)$, $(0,1)$ and $(1,1)$ that never rise above the diagonal.",
      "Membership goes through [[Element]]: $Element(22, SchroederNumbers)$ is true, $Element(10, SchroederNumbers)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(SchroederNumbers, 15)" },
    seeAlso: ["Count", "At", "Element", "LittleSchroderNumbers", "CentralDelannoyNumbers"],
  },
  {
    name: "DeficientNumbers",
    domain: "Collections",
    signature: "DeficientNumbers",
    summary:
      "The deficient numbers $1, 2, 3, 4, 5, 7, …$ -- integers whose proper divisors fall short of them -- as a lazy indexed collection.",
    signatures: [
      {
        call: "DeficientNumbers",
        description: "the $n$ with $\\sigma(n) - n < n$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(DeficientNumbers) = +\\infty$ -- deficient numbers include every prime -- and $At(DeficientNumbers, k)$ unranks the $k$-th by scanning forward from the last cached match.",
      "OEIS A005100.",
      "Membership goes through [[Element]]: $Element(7, DeficientNumbers)$ is true, $Element(12, DeficientNumbers)$ is false (abundant).",
    ],
    examples: [],
    enumerate: { expr: "Take(DeficientNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "AbundantNumbers", "PerfectNumbers"],
  },
  {
    name: "PerfectNumbers",
    domain: "Collections",
    signature: "PerfectNumbers",
    summary:
      "The perfect numbers $6, 28, 496, 8128, …$ -- integers equal to the sum of their proper divisors -- as a lazy indexed collection.",
    signatures: [
      {
        call: "PerfectNumbers",
        description: "the $n$ with $\\sigma(n) = 2n$, an indexed collection of unknown count.",
      },
    ],
    details: [
      "$Count(PerfectNumbers) = NaN$: every even perfect number is $2^{p-1}(2^p - 1)$ for a Mersenne prime exponent $p$ (Euclid–Euler), but whether any odd perfect number exists -- and so whether the family is even finite or infinite -- is open.",
      "$At$ reads off a table of the known even perfect numbers that fit an exact JS integer ($p = 2, 3, 5, 7, 13, 17, 19$); past that table it returns unevaluated rather than scanning forever, since no predicate here could safely keep searching.",
      "OEIS A000396. Membership goes through [[Element]]: $Element(28, PerfectNumbers)$ is true, $Element(24, PerfectNumbers)$ is false (abundant, not perfect).",
    ],
    examples: [],
    enumerate: { expr: "Take(PerfectNumbers, 7)" },
    seeAlso: ["Count", "At", "Element", "AbundantNumbers", "SemiperfectNumbers"],
  },
  {
    name: "SemiperfectNumbers",
    domain: "Collections",
    signature: "SemiperfectNumbers",
    summary:
      "The semiperfect numbers $6, 12, 18, 20, …$ -- integers equal to a sum of some subset of their proper divisors -- as a lazy indexed collection.",
    signatures: [
      {
        call: "SemiperfectNumbers",
        description:
          "the $n$ with a proper-divisor subset summing to $n$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(SemiperfectNumbers) = +\\infty$ (every perfect number is trivially semiperfect, taking the whole divisor set), and $At$ unranks the $k$-th by scanning forward, testing each candidate with a subset-sum search over its proper divisors.",
      "OEIS A005835.",
      "Membership goes through [[Element]]: $Element(12, SemiperfectNumbers)$ is true ($12 = 2 + 4 + 6$), $Element(70, SemiperfectNumbers)$ is false -- $70$ is abundant but [[WeirdNumbers|weird]].",
    ],
    examples: [],
    enumerate: { expr: "Take(SemiperfectNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "PerfectNumbers", "WeirdNumbers"],
  },
  {
    name: "WeirdNumbers",
    domain: "Collections",
    signature: "WeirdNumbers",
    summary:
      "The weird numbers $70, 836, 4030, …$ -- abundant but not semiperfect -- as a lazy indexed collection.",
    signatures: [
      {
        call: "WeirdNumbers",
        description:
          "the abundant $n$ with no proper-divisor subset summing to $n$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(WeirdNumbers) = +\\infty$ (infinitely many are known to exist), and $At$ unranks the $k$-th by scanning forward, testing $\\sigma(n) - n > n$ and then a subset-sum search over $n$'s proper divisors.",
      "OEIS A006037. $70$ is the smallest: its proper divisors $1, 2, 5, 7, 10, 14, 35$ sum past $70$ but no subset of them sums to exactly $70$.",
      "Membership goes through [[Element]]: $Element(70, WeirdNumbers)$ is true, $Element(12, WeirdNumbers)$ is false (abundant, but semiperfect).",
    ],
    examples: [],
    enumerate: { expr: "Take(WeirdNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "AbundantNumbers", "SemiperfectNumbers"],
  },
  {
    name: "PracticalNumbers",
    domain: "Collections",
    signature: "PracticalNumbers",
    summary:
      "The practical numbers $1, 2, 4, 6, 8, 12, …$ -- integers whose divisors let every smaller integer be written as a distinct-divisor sum -- as a lazy indexed collection.",
    signatures: [
      {
        call: "PracticalNumbers",
        description:
          "the $n$ where every $1 \\le m \\le n$ is a sum of distinct divisors of $n$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(PracticalNumbers) = +\\infty$ (Saias 1997 confirmed they have positive density), and $At$ unranks the $k$-th by the classical criterion -- sorted divisors $d_1 = 1 < d_2 < … < d_j = n$, practical iff no $d_{i+1}$ exceeds $1 + \\sum_{l \\le i} d_l$.",
      "OEIS A005153.",
      "Membership goes through [[Element]]: $Element(12, PracticalNumbers)$ is true, $Element(10, PracticalNumbers)$ is false ($7$ isn't a sum of $10$'s divisors $\\{1,2,5,10\\}$).",
    ],
    examples: [],
    enumerate: { expr: "Take(PracticalNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "ArithmeticNumbers"],
  },
  {
    name: "HighlyCompositeNumbers",
    domain: "Collections",
    signature: "HighlyCompositeNumbers",
    summary:
      "The highly composite numbers $1, 2, 4, 6, 12, 24, …$ -- integers with more divisors than any smaller one -- as a lazy indexed collection.",
    signatures: [
      {
        call: "HighlyCompositeNumbers",
        description:
          "the $n$ with $\\tau(n) > \\tau(m)$ for every $m < n$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(HighlyCompositeNumbers) = +\\infty$ ($n!$'s divisor count strictly increases with $n$), and $At$ unranks the $k$-th by scanning forward, keeping a running record of the largest divisor count seen so far.",
      "Ramanujan's sequence, OEIS A002182.",
      "Membership goes through [[Element]]: $Element(12, HighlyCompositeNumbers)$ is true ($\\tau(12) = 6$, a new record over $1..11$), $Element(18, HighlyCompositeNumbers)$ is false ($\\tau(18) = 6$, not a new record).",
    ],
    examples: [],
    enumerate: { expr: "Take(HighlyCompositeNumbers, 15)" },
    seeAlso: ["Count", "At", "Element", "SuperabundantNumbers"],
  },
  {
    name: "SuperabundantNumbers",
    domain: "Collections",
    signature: "SuperabundantNumbers",
    summary:
      "The superabundant numbers $1, 2, 4, 6, 12, 24, …$ -- integers whose abundancy $\\sigma(n)/n$ exceeds every smaller one's -- as a lazy indexed collection.",
    signatures: [
      {
        call: "SuperabundantNumbers",
        description:
          "the $n$ with $\\sigma(n)/n > \\sigma(m)/m$ for every $m < n$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(SuperabundantNumbers) = +\\infty$, and $At$ unranks the $k$-th by scanning forward, comparing abundancy ratios by cross-multiplication (exact, no floating point) against a running record.",
      "OEIS A004394. Every superabundant number is highly composite, but not conversely -- the two sequences share early terms and then diverge (e.g. $180$ is superabundant but not highly composite, and vice versa further out).",
      "Membership goes through [[Element]]: $Element(4, SuperabundantNumbers)$ is true ($\\sigma(4)/4 = 7/4$, a new record over $1..3$), $Element(3, SuperabundantNumbers)$ is false ($\\sigma(3)/3 = 4/3 < \\sigma(2)/2 = 3/2$).",
    ],
    examples: [],
    enumerate: { expr: "Take(SuperabundantNumbers, 15)" },
    seeAlso: ["Count", "At", "Element", "HighlyCompositeNumbers"],
  },
  {
    name: "ArithmeticNumbers",
    domain: "Collections",
    signature: "ArithmeticNumbers",
    summary:
      "The arithmetic numbers $1, 3, 5, 6, 7, …$ -- integers whose divisors have an integer mean -- as a lazy indexed collection.",
    signatures: [
      {
        call: "ArithmeticNumbers",
        description: "the $n$ with $\\tau(n) \\mid \\sigma(n)$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(ArithmeticNumbers) = +\\infty$ (almost all integers are arithmetic -- the exceptions have density zero), and $At$ unranks the $k$-th by scanning forward, testing $\\sigma(n) \\bmod \\tau(n) = 0$.",
      "OEIS A003601.",
      "Membership goes through [[Element]]: $Element(6, ArithmeticNumbers)$ is true (divisors $1,2,3,6$ average $3$), $Element(4, ArithmeticNumbers)$ is false (divisors $1,2,4$ average $7/3$).",
    ],
    examples: [],
    enumerate: { expr: "Take(ArithmeticNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "PracticalNumbers"],
  },
  {
    name: "UntouchableNumbers",
    domain: "Collections",
    signature: "UntouchableNumbers",
    summary:
      "The untouchable numbers $2, 5, 52, 88, …$ -- integers that are no number's aliquot sum -- as a lazy indexed collection.",
    signatures: [
      {
        call: "UntouchableNumbers",
        description:
          "the $n$ with $\\sigma(m) - m \\ne n$ for every $m$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(UntouchableNumbers) = +\\infty$ (Erdős), and $At$ unranks the $k$-th by scanning forward, testing each candidate $n$ against a sieve of aliquot sums $\\sigma(m) - m$ for $m$ up to $n^2$ -- large enough to catch $m = p^2$ for a prime $p$ as big as $n - 1$, which gives aliquot sum $1 + p = n$.",
      "OEIS A005114. $1$ is excluded by convention even though it's also never an aliquot sum for $m > 1$; the sequence starts at $2$.",
      "Membership goes through [[Element]]: $Element(5, UntouchableNumbers)$ is true, $Element(4, UntouchableNumbers)$ is false ($\\sigma(9) - 9 = 4$).",
    ],
    examples: [],
    enumerate: { expr: "Take(UntouchableNumbers, 15)" },
    seeAlso: ["Count", "At", "Element", "AbundantNumbers"],
  },
  {
    name: "AchillesNumbers",
    domain: "Collections",
    signature: "AchillesNumbers",
    summary:
      "The Achilles numbers $72, 108, 200, 288, …$ -- powerful but not a perfect power -- as a lazy indexed collection.",
    signatures: [
      {
        call: "AchillesNumbers",
        description:
          "the powerful $n > 1$ that aren't of the form $a^k$ ($a, k \\ge 2$), an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(AchillesNumbers) = +\\infty$, and $At$ unranks the $k$-th by scanning forward, testing [[PowerfulNumbers|powerfulness]] and then [[PerfectPowerNumbers|non-perfect-power]]ness.",
      "OEIS A052486. $72 = 2^3 \\cdot 3^2$ is the smallest: every prime factor's exponent is $\\ge 2$ (powerful), but no single base and exponent produce it (not a perfect power).",
      "Membership goes through [[Element]]: $Element(72, AchillesNumbers)$ is true, $Element(64, AchillesNumbers)$ is false ($64 = 2^6$, a perfect power).",
    ],
    examples: [],
    enumerate: { expr: "Take(AchillesNumbers, 15)" },
    seeAlso: ["Count", "At", "Element", "PowerfulNumbers", "PerfectPowerNumbers"],
  },
  {
    name: "PowerfulNumbers",
    domain: "Collections",
    signature: "PowerfulNumbers",
    summary:
      "The powerful numbers $1, 4, 8, 9, 16, …$ -- integers where every prime factor appears squared or more -- as a lazy indexed collection.",
    signatures: [
      {
        call: "PowerfulNumbers",
        description:
          "the $n$ whose every prime factor has exponent $\\ge 2$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(PowerfulNumbers) = +\\infty$ (every perfect square is powerful), and $At$ unranks the $k$-th by scanning forward, testing each candidate's factorisation.",
      "OEIS A001694. Every powerful number factors uniquely as $a^2 b^3$ for squarefree $b$.",
      "Membership goes through [[Element]]: $Element(8, PowerfulNumbers)$ is true ($8 = 2^3$), $Element(12, PowerfulNumbers)$ is false ($12 = 2^2 \\cdot 3$, and $3$'s exponent is only $1$).",
    ],
    examples: [],
    enumerate: { expr: "Take(PowerfulNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "SquareFreeNumbers", "PerfectPowerNumbers"],
  },
  {
    name: "PerfectPowerNumbers",
    domain: "Collections",
    signature: "PerfectPowerNumbers",
    summary:
      "The perfect powers $4, 8, 9, 16, 25, …$ -- integers $a^k$ with $a \\ge 2, k \\ge 2$ -- as a lazy indexed collection.",
    signatures: [
      {
        call: "PerfectPowerNumbers",
        description: "the $a^k$ for integers $a \\ge 2, k \\ge 2$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(PerfectPowerNumbers) = +\\infty$, and $At$ unranks the $k$-th by scanning forward, testing each candidate by binary search over exponents.",
      "OEIS A075109 -- the $a \\ge 2$ convention excludes $1$, unlike A001597's $m > 0$.",
      "Membership goes through [[Element]]: $Element(16, PerfectPowerNumbers)$ is true ($16 = 2^4 = 4^2$), $Element(1, PerfectPowerNumbers)$ is false under this convention (needs $a \\ge 2$).",
    ],
    examples: [],
    enumerate: { expr: "Take(PerfectPowerNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "PowerfulNumbers", "SquareNumbers"],
  },
  {
    name: "SquareFreeNumbers",
    domain: "Collections",
    signature: "SquareFreeNumbers",
    summary:
      "The squarefree numbers $1, 2, 3, 5, 6, …$ -- integers divisible by no perfect square $> 1$ -- as a lazy indexed collection.",
    signatures: [
      {
        call: "SquareFreeNumbers",
        description:
          "the $n$ with every prime factor's exponent $\\le 1$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(SquareFreeNumbers) = +\\infty$ (density $6/\\pi^2$), and $At$ unranks the $k$-th by scanning forward, testing each candidate's factorisation.",
      "OEIS A005117. Exactly $[[KFreeIntegers]](2)$ -- the two families are unranked identically.",
      "Membership goes through [[Element]]: $Element(10, SquareFreeNumbers)$ is true ($10 = 2 \\cdot 5$), $Element(12, SquareFreeNumbers)$ is false ($12 = 2^2 \\cdot 3$).",
    ],
    examples: [],
    enumerate: { expr: "Take(SquareFreeNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "KFreeIntegers", "PowerfulNumbers"],
  },
  {
    name: "KFreeIntegers",
    domain: "Collections",
    signature: "KFreeIntegers(k)",
    summary:
      "The $k$-free integers -- naturals with no prime factor raised to the $k$-th power or higher -- as a lazy indexed family, one collection per $k$.",
    signatures: [
      {
        call: "KFreeIntegers(k)",
        description:
          "the positive integers whose every prime factor has exponent $< k$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection for each $k$: $Count(KFreeIntegers(k)) = +\\infty$, and $At(KFreeIntegers(k), i)$ unranks the $i$-th by scanning forward, testing each candidate's factorisation against $k$.",
      "$KFreeIntegers(2)$ is exactly [[SquareFreeNumbers]] (A005117); $KFreeIntegers(3)$ is the cube-free numbers, A004709.",
      "Membership goes through [[Element]]: $Element(8, KFreeIntegers(3))$ is false ($8 = 2^3$, exponent $3 \\ge 3$), $Element(8, KFreeIntegers(4))$ is true.",
    ],
    examples: [],
    enumerate: { expr: "Take(KFreeIntegers(3), 20)" },
    seeAlso: ["Count", "At", "Element", "SquareFreeNumbers"],
  },
  {
    name: "CarmichaelNumbers",
    domain: "Collections",
    signature: "CarmichaelNumbers",
    summary:
      "The Carmichael numbers $561, 1105, 1729, …$ -- composite Fermat pseudoprimes to every coprime base -- as a lazy indexed collection.",
    signatures: [
      {
        call: "CarmichaelNumbers",
        description:
          "the composite $n$ satisfying Korselt's criterion, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(CarmichaelNumbers) = +\\infty$ (Alford–Granville–Pomerance, 1994), and $At$ unranks the $k$-th by scanning forward, testing Korselt's criterion -- $n$ squarefree, and $(p-1) \\mid (n-1)$ for every prime $p \\mid n$ -- which is equivalent to passing the Fermat test $a^{n-1} \\equiv 1 \\pmod n$ for every $a$ coprime to $n$.",
      "OEIS A002997. $561 = 3 \\cdot 11 \\cdot 17$ is the smallest, found by Korselt in 1899 (four years before Carmichael's first published example).",
      "Membership goes through [[Element]]: $Element(561, CarmichaelNumbers)$ is true, $Element(560, CarmichaelNumbers)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(CarmichaelNumbers, 10)" },
    seeAlso: ["Count", "At", "Element", "Primes"],
  },
  {
    name: "GiugaNumbers",
    domain: "Collections",
    signature: "GiugaNumbers",
    summary:
      "The Giuga numbers $30, 858, 1722, 66198, …$ -- composite $n$ with $p \\mid (n/p - 1)$ for every prime $p \\mid n$ -- as an indexed collection of unknown count.",
    signatures: [
      {
        call: "GiugaNumbers",
        description:
          "the composite $n$ satisfying Giuga's divisibility condition, an indexed collection of unknown count.",
      },
    ],
    details: [
      "$Count(GiugaNumbers) = NaN$: only a handful are known, none odd, and Giuga's conjecture (that no counterexample to Giuga's primality criterion exists, equivalently no Giuga number is a counterexample) is open -- so whether the family is finite is open too.",
      "$At$ reads off a table of the known Giuga numbers; past that table it returns unevaluated rather than scanning forever, since no predicate here could safely keep searching.",
      "OEIS A007850. Equivalently, $n$ is Giuga iff $\\sum_{p \\mid n} 1/p - \\prod_{p \\mid n} 1/p$ is a positive integer.",
      "Membership goes through [[Element]]: $Element(30, GiugaNumbers)$ is true ($30 = 2 \\cdot 3 \\cdot 5$: $2 \\mid (15-1)$, $3 \\mid (10-1)$, $5 \\mid (6-1)$), $Element(6, GiugaNumbers)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(GiugaNumbers, 4)" },
    seeAlso: ["Count", "At", "Element", "CarmichaelNumbers"],
  },
  {
    name: "IdonealNumbers",
    domain: "Collections",
    signature: "IdonealNumbers",
    summary:
      "Euler's 65 numeri idonei $1, 2, 3, 4, 5, …, 1848$ -- one class per genus of discriminant $-4n$ -- as an indexed collection of unknown count.",
    signatures: [
      {
        call: "IdonealNumbers",
        description: "Euler's idoneal numbers, an indexed collection of unknown count.",
      },
    ],
    details: [
      "$Count(IdonealNumbers) = NaN$: the 65 known idoneal numbers are exhaustive assuming the generalized Riemann hypothesis; unconditionally, at most one more (necessarily $> 1848$) could exist.",
      "$At$ reads off Euler's table of 65; past it, returns unevaluated rather than asserting a completeness the field doesn't unconditionally have.",
      "OEIS A000926. $n$ is idoneal iff every genus of binary quadratic forms of discriminant $-4n$ contains only one class -- equivalently, $n$'s only representations $n = x^2 + m y^2$ (for each $m$ coprime to $n$) force $\\gcd(x, y) = 1$ or similar; the list traces to Euler's search for primality-testing moduli.",
      "Membership goes through [[Element]]: $Element(120, IdonealNumbers)$ is true, $Element(11, IdonealNumbers)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(IdonealNumbers, 20)" },
    seeAlso: ["Count", "At", "Element"],
  },
  {
    name: "LuckyNumbers",
    domain: "Collections",
    signature: "LuckyNumbers",
    summary:
      "The lucky numbers $1, 3, 7, 9, 13, …$ -- survivors of Ulam's positional sieve -- as a lazy indexed collection.",
    signatures: [
      {
        call: "LuckyNumbers",
        description: "the survivors of Ulam's sieve, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(LuckyNumbers) = +\\infty$, and $At$ unranks the $k$-th by running the sieve out far enough -- start from the odd numbers, then repeatedly take the smallest surviving number past $1$ as a step and delete every step-th survivor, until enough terms remain.",
      "OEIS A000959. Despite the name, luckiness has nothing to do with primality; the sieve's mechanics happen to leave a prime-like density behind, a coincidence number theorists still find useful for testing conjectures like a lucky-number Goldbach analogue.",
      "Membership goes through [[Element]]: $Element(13, LuckyNumbers)$ is true, $Element(11, LuckyNumbers)$ is false ($11$ is sieved out at the step-$3$ pass).",
    ],
    examples: [],
    enumerate: { expr: "Take(LuckyNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "Primes"],
  },
  {
    name: "HarshadNumbers",
    domain: "Collections",
    signature: "HarshadNumbers",
    summary:
      "The Harshad (Niven) numbers $1, 2, 3, …, 10, 12, 18, …$: integers divisible by their own digit sum.",
    signatures: [
      {
        call: "HarshadNumbers",
        description:
          "the $n$ with $n \\bmod \\mathrm{digitSum}(n) = 0$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(HarshadNumbers) = +\\infty$ -- every digit-sum-1 number (a power of 10) qualifies, so the family never thins out. OEIS A005349.",
      "$At(HarshadNumbers, k)$ unranks by scanning forward from the last cached match -- $At(HarshadNumbers, 11) = 12$.",
      "Membership goes through [[Element]]: $Element(18, HarshadNumbers)$ is true (digit sum 9, $18/9=2$), $Element(11, HarshadNumbers)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(HarshadNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "HappyNumbers", "SmithNumbers"],
  },
  {
    name: "HappyNumbers",
    domain: "Collections",
    signature: "HappyNumbers",
    summary: "The happy numbers $1, 7, 10, 13, 19, …$: iterating sum-of-squared-digits reaches 1.",
    signatures: [
      {
        call: "HappyNumbers",
        description:
          "the $n$ whose sum-of-squared-digits iteration reaches 1 (rather than the other cycle, $\\{4,16,37,58,89,145,42,20\\}$), an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(HappyNumbers) = +\\infty$. OEIS A007770.",
      "$At(HappyNumbers, k)$ unranks by scanning forward from the last cached match -- $At(HappyNumbers, 5) = 19$.",
      "Membership goes through [[Element]]: $Element(7, HappyNumbers)$ is true ($7 \\to 49 \\to 97 \\to 130 \\to 10 \\to 1$), $Element(4, HappyNumbers)$ is false (the other cycle).",
    ],
    examples: [],
    enumerate: { expr: "Take(HappyNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "HarshadNumbers"],
  },
  {
    name: "NarcissisticNumbers",
    domain: "Collections",
    signature: "NarcissisticNumbers",
    summary:
      "The Armstrong (narcissistic) numbers $1, …, 9, 153, 370, …$: $n$ equal to the sum of its own digits, each raised to the digit count -- the one PROVEN finite family here.",
    signatures: [
      {
        call: "NarcissisticNumbers",
        description:
          "the base-10 narcissistic numbers, excluding the trivial 0: a finite indexed collection of exactly 88.",
      },
    ],
    details: [
      "A lazy indexed collection, but $Count(NarcissisticNumbers) = 88$, not $+\\infty$: Diamond \\& Kellner's digit-length bound proves base 10 has no more, and the largest is the 39-digit $115132219018763992565095597973971522401$. OEIS A005188 (which also lists the trivial $0 = 0^1$; this family starts at 1).",
      "$At(NarcissisticNumbers, k)$ unranks from a table verified against every OEIS term -- $At(NarcissisticNumbers, 10) = 153$. Terms past the 43rd exceed $2^{53}-1$ (IEEE-754 double precision) and come back as exact `bigint` instead, so every one of the 88 -- including the 39-digit largest -- is exact, never $NaN$.",
      "Membership goes through [[Element]]: $Element(153, NarcissisticNumbers)$ is true ($1^3+5^3+3^3=153$), $Element(154, NarcissisticNumbers)$ is false.",
    ],
    examples: [
      {
        id: "narcissistic-armstrong-numbers-are-proven-finite",
        expr: ["Count", "NarcissisticNumbers"],
        expected: 88,
        category: "Properties",
        caption: "Narcissistic (Armstrong) numbers are proven finite: exactly 88 exist.",
      },
      {
        id: "the-88th-largest-term-is-exact-past-2-53",
        expr: ["At", "NarcissisticNumbers", 88],
        expected: { num: "115132219018763992565095597973971522401" },
        category: "Scope",
        caption: "The 88th and largest term, a 39-digit exact integer well past $2^{53}-1$",
      },
    ],
    enumerate: { expr: "Take(NarcissisticNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "KaprekarNumbers"],
  },
  {
    name: "AutomorphicNumbers",
    domain: "Collections",
    signature: "AutomorphicNumbers",
    summary:
      "The automorphic numbers $1, 5, 6, 25, 76, 376, …$: $n$ whose square ends in $n$ itself (base 10).",
    signatures: [
      {
        call: "AutomorphicNumbers",
        description:
          "the $n$ with $n^2 \\equiv n \\pmod{10^{\\mathrm{digits}(n)}}$, excluding the trivial 0, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(AutomorphicNumbers) = +\\infty$ -- the two nontrivial 10-adic idempotents ($…890625$ and $…109376$) extend to a new automorphic number of every digit length. OEIS A003226.",
      "$At(AutomorphicNumbers, k)$ unranks from a table built by Hensel-lifting those idempotents digit by digit (not a search -- the terms thin out too fast, roughly 10x per step, for a scan to reach past the mid-teens); $At(AutomorphicNumbers, 5) = 76$. Terms whose value exceeds $2^{53}-1$ answer $NaN$, the same representable-range limit as [[NarcissisticNumbers]].",
      "Membership goes through [[Element]]: $Element(76, AutomorphicNumbers)$ is true ($76^2=5776$), $Element(77, AutomorphicNumbers)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(AutomorphicNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "KaprekarNumbers"],
  },
  {
    name: "KaprekarNumbers",
    domain: "Collections",
    signature: "KaprekarNumbers",
    summary:
      "The Kaprekar numbers $1, 9, 45, 55, 99, 297, …$: $n$ whose square splits into a left and a (nonzero) right part that sum back to $n$.",
    signatures: [
      {
        call: "KaprekarNumbers",
        description:
          "the $n$ for which some split of $n^2$'s decimal digits sums back to $n$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(KaprekarNumbers) = +\\infty$ -- every repunit-of-nines $10^k - 1$ qualifies, since $(10^k-1)^2$ splits at position $k$ into $10^k - 2$ and the last $k$ digits, summing to $10^k - 1$. OEIS A006886.",
      "$At(KaprekarNumbers, k)$ unranks by scanning forward from the last cached match, trying every split position (the split isn't always at $n$'s own digit count -- $4879^2 = 23804641$ splits as $238 + 4641$, not $2380+4641$) -- $At(KaprekarNumbers, 3) = 45$ ($45^2=2025 \\to 20+25$).",
      "Membership goes through [[Element]]: $Element(297, KaprekarNumbers)$ is true ($297^2=88209 \\to 88+209=297$), $Element(298, KaprekarNumbers)$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(KaprekarNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "NarcissisticNumbers"],
  },
  {
    name: "EvilNumbers",
    domain: "Collections",
    signature: "EvilNumbers",
    summary:
      "The evil numbers $0, 3, 5, 6, 9, …$: nonnegative integers with an even number of 1-bits.",
    signatures: [
      {
        call: "EvilNumbers",
        description:
          "the $n \\geq 0$ with an even binary popcount, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(EvilNumbers) = +\\infty$, and this is the one family here whose first term is 0 rather than 1 (popcount 0 is even). OEIS A001969.",
      "$At(EvilNumbers, k)$ unranks by scanning forward -- $At(EvilNumbers, 1) = 0$, $At(EvilNumbers, 2) = 3$.",
      "Membership goes through [[Element]]: $Element(6, EvilNumbers)$ is true ($110_2$, two 1-bits), $Element(7, EvilNumbers)$ is false ([[OdiousNumbers]], three 1-bits).",
    ],
    examples: [],
    enumerate: { expr: "Take(EvilNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "OdiousNumbers", "PerniciousNumbers"],
  },
  {
    name: "OdiousNumbers",
    domain: "Collections",
    signature: "OdiousNumbers",
    summary:
      "The odious numbers $1, 2, 4, 7, 8, …$: positive integers with an odd number of 1-bits.",
    signatures: [
      {
        call: "OdiousNumbers",
        description: "the $n$ with an odd binary popcount, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(OdiousNumbers) = +\\infty$, the complement of [[EvilNumbers]] among the positive integers. OEIS A000069.",
      "$At(OdiousNumbers, k)$ unranks by scanning forward -- $At(OdiousNumbers, 4) = 7$.",
      "Membership goes through [[Element]]: $Element(7, OdiousNumbers)$ is true ($111_2$, three 1-bits), $Element(6, OdiousNumbers)$ is false ([[EvilNumbers]]).",
    ],
    examples: [],
    enumerate: { expr: "Take(OdiousNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "EvilNumbers", "PerniciousNumbers"],
  },
  {
    name: "PerniciousNumbers",
    domain: "Collections",
    signature: "PerniciousNumbers",
    summary:
      "The pernicious numbers $3, 5, 6, 7, 9, …$: positive integers whose binary popcount is itself prime.",
    signatures: [
      {
        call: "PerniciousNumbers",
        description: "the $n$ with $\\mathrm{popcount}(n)$ prime, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(PerniciousNumbers) = +\\infty$ -- every $n$ with exactly two 1-bits already qualifies (popcount 2 is prime), and there are infinitely many. OEIS A052294.",
      "$At(PerniciousNumbers, k)$ unranks by scanning forward -- $At(PerniciousNumbers, 1) = 3$.",
      "Membership goes through [[Element]]: $Element(7, PerniciousNumbers)$ is true (popcount 3, prime), $Element(15, PerniciousNumbers)$ is false (popcount 4).",
    ],
    examples: [],
    enumerate: { expr: "Take(PerniciousNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "EvilNumbers", "OdiousNumbers", "Primes"],
  },
  {
    name: "SmithNumbers",
    domain: "Collections",
    signature: "SmithNumbers",
    summary:
      "The Smith numbers $4, 22, 27, 58, 85, …$: composite integers whose digit sum equals the digit sum of their prime factors (with multiplicity).",
    signatures: [
      {
        call: "SmithNumbers",
        description:
          "the composite $n$ with $\\mathrm{digitSum}(n) = \\sum \\mathrm{digitSum}(p)$ over $n$'s prime factorisation, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(SmithNumbers) = +\\infty$ (McDaniel, 1987). OEIS A006753.",
      "$At(SmithNumbers, k)$ unranks by scanning forward, factoring each candidate -- $At(SmithNumbers, 2) = 22$ ($2+2=4$; factors $2, 11$, digit sums $2+1+1=4$).",
      "Membership goes through [[Element]]: $Element(4, SmithNumbers)$ is true ($4=2 \\times 2$: digit sums $4 = 2+2$), $Element(6, SmithNumbers)$ is false ($6=2\\times3$: digit sums $2+3=5 \\ne 6$).",
    ],
    examples: [],
    enumerate: { expr: "Take(SmithNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "HarshadNumbers", "SemiprimeNumbers"],
  },
  {
    name: "SemiprimeNumbers",
    domain: "Collections",
    signature: "SemiprimeNumbers",
    summary:
      "The semiprimes $4, 6, 9, 10, 14, …$: products of exactly two primes, with multiplicity ($\\Omega(n) = 2$).",
    signatures: [
      {
        call: "SemiprimeNumbers",
        description:
          "the $n$ with $\\Omega(n) = 2$ (two prime factors counted with multiplicity, so $4=2^2$ counts), an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(SemiprimeNumbers) = +\\infty$ -- $2p$ is semiprime for every prime $p$. OEIS A001358. Identical to [[KAlmostPrimes]]$(2)$.",
      "$At(SemiprimeNumbers, k)$ unranks by scanning forward, factoring each candidate -- $At(SemiprimeNumbers, 3) = 9$ ($3^2$).",
      "Membership goes through [[Element]]: $Element(9, SemiprimeNumbers)$ is true, $Element(8, SemiprimeNumbers)$ is false ($2^3$, $\\Omega=3$).",
    ],
    examples: [],
    enumerate: { expr: "Take(SemiprimeNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "SquarefreeSemiprimes", "KAlmostPrimes", "Primes"],
  },
  {
    name: "SquarefreeSemiprimes",
    domain: "Collections",
    signature: "SquarefreeSemiprimes",
    summary:
      "The squarefree semiprimes $6, 10, 14, 15, 21, …$: products of two DISTINCT primes ($\\tau=4$, $\\mu=+1$).",
    signatures: [
      {
        call: "SquarefreeSemiprimes",
        description: "the $n = pq$ for distinct primes $p \\ne q$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(SquarefreeSemiprimes) = +\\infty$; the squarefree subset of [[SemiprimeNumbers]] (which also allows $p^2$). OEIS A006881.",
      "$At(SquarefreeSemiprimes, k)$ unranks by scanning forward, factoring each candidate -- $At(SquarefreeSemiprimes, 1) = 6$.",
      "Membership goes through [[Element]]: $Element(6, SquarefreeSemiprimes)$ is true ($2 \\times 3$), $Element(4, SquarefreeSemiprimes)$ is false ($2^2$, not squarefree).",
    ],
    examples: [],
    enumerate: { expr: "Take(SquarefreeSemiprimes, 20)" },
    seeAlso: ["Count", "At", "Element", "SemiprimeNumbers", "SphenicNumbers"],
  },
  {
    name: "SphenicNumbers",
    domain: "Collections",
    signature: "SphenicNumbers",
    summary:
      "The sphenic numbers $30, 42, 66, 70, 78, …$: products of three DISTINCT primes ($\\tau=8$, $\\mu=-1$).",
    signatures: [
      {
        call: "SphenicNumbers",
        description: "the $n = pqr$ for distinct primes $p, q, r$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(SphenicNumbers) = +\\infty$. OEIS A007304.",
      "$At(SphenicNumbers, k)$ unranks by scanning forward, factoring each candidate -- $At(SphenicNumbers, 1) = 30$ ($2\\times3\\times5$).",
      "Membership goes through [[Element]]: $Element(30, SphenicNumbers)$ is true, $Element(60, SphenicNumbers)$ is false ($2^2\\times3\\times5$, a repeated factor).",
    ],
    examples: [],
    enumerate: { expr: "Take(SphenicNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "SquarefreeSemiprimes", "KAlmostPrimes"],
  },
  {
    name: "PrimePowerNumbers",
    domain: "Collections",
    signature: "PrimePowerNumbers",
    summary:
      "The prime powers $2, 3, 4, 5, 7, 8, 9, 11, …$: $p^k$ for a prime $p$ and $k \\geq 1$ (excluding 1, which is $p^0$).",
    signatures: [
      {
        call: "PrimePowerNumbers",
        description:
          "the $n = p^k$ for a prime $p$ and integer $k \\geq 1$, an infinite indexed collection.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(PrimePowerNumbers) = +\\infty$ ([[Primes]] alone already is). OEIS A246655.",
      "$At(PrimePowerNumbers, k)$ unranks by scanning forward, factoring each candidate -- $At(PrimePowerNumbers, 3) = 4$ ($2^2$).",
      "Membership goes through [[Element]]: $Element(9, PrimePowerNumbers)$ is true ($3^2$), $Element(12, PrimePowerNumbers)$ is false ($2^2 \\times 3$, two distinct primes).",
    ],
    examples: [],
    enumerate: { expr: "Take(PrimePowerNumbers, 20)" },
    seeAlso: ["Count", "At", "Element", "Primes", "KAlmostPrimes"],
  },
  {
    name: "KAlmostPrimes",
    domain: "Collections",
    signature: "KAlmostPrimes(k)",
    summary:
      "The $k$-almost primes -- integers with exactly $k$ prime factors, counted with multiplicity ($\\Omega(n)=k$) -- as a lazy indexed family, one collection per $k$.",
    signatures: [
      {
        call: "KAlmostPrimes(k)",
        description:
          "the $n$ with $\\Omega(n) = k$, an infinite indexed collection for every $k \\geq 1$.",
      },
    ],
    details: [
      "A lazy indexed collection for each $k$: $Count(KAlmostPrimes(k)) = +\\infty$ -- $2^{k-1}p$ has $\\Omega = k$ for every prime $p$. $KAlmostPrimes(1)$ is [[Primes]] verbatim; $KAlmostPrimes(2)$ is [[SemiprimeNumbers]] verbatim.",
      "$At(KAlmostPrimes(k), i)$ unranks the $i$-th match by scanning forward, factoring each candidate -- $At(KAlmostPrimes(3), 1) = 8$ ($2^3$).",
      "Membership goes through [[Element]]: $Element(30, KAlmostPrimes(3))$ is true ($2\\times3\\times5$), $Element(30, KAlmostPrimes(2))$ is false.",
    ],
    examples: [],
    enumerate: { expr: "Take(KAlmostPrimes(3), 20)" },
    seeAlso: ["Count", "At", "Element", "Primes", "SemiprimeNumbers", "RoughNumbers"],
  },
  {
    name: "RoughNumbers",
    domain: "Collections",
    signature: "RoughNumbers(k)",
    summary:
      "The $k$-rough numbers -- positive integers with no prime factor below $k$ -- as a lazy indexed family, one collection per $k$ ([[SmoothNumbers]]'s mirror image).",
    signatures: [
      {
        call: "RoughNumbers(k)",
        description:
          "the $n \\geq 1$ whose prime factors are all $\\geq k$ ($n=1$ counts, vacuously), an infinite indexed collection for every $k$.",
      },
    ],
    details: [
      "A lazy indexed collection for each $k$: $Count(RoughNumbers(k)) = +\\infty$ -- every sufficiently large prime is $k$-rough. $RoughNumbers(5)$ is OEIS A007310 (coprime to 6); $RoughNumbers(7)$ is A007775 (coprime to 30).",
      "$At(RoughNumbers(k), i)$ unranks the $i$-th match by scanning forward, factoring each candidate -- $At(RoughNumbers(5), 1) = 1$ (vacuously rough).",
      "Membership goes through [[Element]]: $Element(35, RoughNumbers(5))$ is true ($5\\times7$, both $\\geq5$), $Element(15, RoughNumbers(5))$ is false ($3\\times5$, $3<5$).",
    ],
    examples: [],
    enumerate: { expr: "Take(RoughNumbers(7), 20)" },
    seeAlso: ["Count", "At", "Element", "SmoothNumbers", "KAlmostPrimes"],
  },
  {
    name: "TwinPrimes",
    domain: "Collections",
    signature: "TwinPrimes",
    summary: "The (lesser) twin primes $3, 5, 11, 17, 29, …$: primes $p$ with $p+2$ also prime.",
    signatures: [
      {
        call: "TwinPrimes",
        description:
          "the lesser prime $p$ of a twin pair $(p, p+2)$, an indexed collection of open infinitude.",
      },
    ],
    details: [
      "A lazy indexed collection; whether there are infinitely many is the open twin-prime conjecture, so $Count(TwinPrimes) = NaN$ rather than $+\\infty$ -- a deliberately different answer from every $+\\infty$ family in this library, marking a genuinely open question rather than a known-infinite one. OEIS A001359 (the LESSER member; A001097 lists both members of each pair instead).",
      "$At(TwinPrimes, k)$ unranks by scanning forward, testing primality of $n$ and $n+2$ -- $At(TwinPrimes, 3) = 11$.",
      "Membership goes through [[Element]]: $Element(11, TwinPrimes)$ is true ($11, 13$ both prime), $Element(13, TwinPrimes)$ is false ($15$ is not).",
      "$TwinPrimes$ is $PrimePairs(2)$ verbatim.",
    ],
    examples: [
      {
        id: "the-first-20-lesser-twin-primes-oeis-a001359",
        expr: ["Take", "TwinPrimes", 20],
        expected: [
          "List",
          3,
          5,
          11,
          17,
          29,
          41,
          59,
          71,
          101,
          107,
          137,
          149,
          179,
          191,
          197,
          227,
          239,
          269,
          281,
          311,
        ],
        caption: "The first 20 lesser twin primes, OEIS A001359",
      },
      {
        id: "count-twinprimes-is-unknown-but-the-first-20",
        expr: ["Count", ["Take", "TwinPrimes", 20]],
        expected: 20,
        caption:
          "$Count(TwinPrimes)$ is unknown, but the first 20 exist, so a prefix counts exactly",
      },
    ],
    enumerate: { expr: "Take(TwinPrimes, 20)" },
    seeAlso: ["Count", "At", "Element", "Primes", "CousinPrimes", "SexyPrimes", "PrimePairs"],
  },
  {
    name: "CousinPrimes",
    domain: "Collections",
    signature: "CousinPrimes",
    summary: "The (lesser) cousin primes $3, 7, 13, 19, 37, …$: primes $p$ with $p+4$ also prime.",
    signatures: [
      {
        call: "CousinPrimes",
        description:
          "the lesser prime $p$ of a cousin pair $(p, p+4)$, an indexed collection of open infinitude.",
      },
    ],
    details: [
      "A lazy indexed collection; open infinitude (a cousin-prime analogue of the twin-prime conjecture), so $Count(CousinPrimes) = NaN$. OEIS A023200 (the lesser member).",
      "$At(CousinPrimes, k)$ unranks by scanning forward, testing primality of $n$ and $n+4$ -- $At(CousinPrimes, 2) = 7$.",
      "Membership goes through [[Element]]: $Element(7, CousinPrimes)$ is true ($7, 11$ both prime), $Element(11, CousinPrimes)$ is false ($15$ is not).",
      "$CousinPrimes$ is $PrimePairs(4)$ verbatim.",
    ],
    examples: [
      {
        id: "the-first-20-lesser-cousin-primes-oeis-a023200",
        expr: ["Take", "CousinPrimes", 20],
        expected: [
          "List",
          3,
          7,
          13,
          19,
          37,
          43,
          67,
          79,
          97,
          103,
          109,
          127,
          163,
          193,
          223,
          229,
          277,
          307,
          313,
          349,
        ],
        caption: "The first 20 lesser cousin primes, OEIS A023200",
      },
    ],
    enumerate: { expr: "Take(CousinPrimes, 20)" },
    seeAlso: ["Count", "At", "Element", "TwinPrimes", "SexyPrimes", "PrimePairs"],
  },
  {
    name: "SexyPrimes",
    domain: "Collections",
    signature: "SexyPrimes",
    summary: "The (lesser) sexy primes $5, 7, 11, 13, 17, …$: primes $p$ with $p+6$ also prime.",
    signatures: [
      {
        call: "SexyPrimes",
        description:
          "the lesser prime $p$ of a sexy pair $(p, p+6)$, an indexed collection of open infinitude.",
      },
    ],
    details: [
      "A lazy indexed collection; open infinitude, so $Count(SexyPrimes) = NaN$. OEIS A023201 (the lesser member; named for the Latin \\emph{sex}, six).",
      "$At(SexyPrimes, k)$ unranks by scanning forward, testing primality of $n$ and $n+6$ -- $At(SexyPrimes, 1) = 5$.",
      "Membership goes through [[Element]]: $Element(5, SexyPrimes)$ is true ($5, 11$ both prime), $Element(7, SexyPrimes)$ is true too ($7,13$); $Element(9, SexyPrimes)$ is false (not prime).",
      "$SexyPrimes$ is $PrimePairs(6)$ verbatim.",
    ],
    examples: [
      {
        id: "the-first-20-lesser-sexy-primes-oeis-a023201",
        expr: ["Take", "SexyPrimes", 20],
        expected: [
          "List",
          5,
          7,
          11,
          13,
          17,
          23,
          31,
          37,
          41,
          47,
          53,
          61,
          67,
          73,
          83,
          97,
          101,
          103,
          107,
          131,
        ],
        caption: "The first 20 lesser sexy primes, OEIS A023201",
      },
    ],
    enumerate: { expr: "Take(SexyPrimes, 20)" },
    seeAlso: ["Count", "At", "Element", "TwinPrimes", "CousinPrimes", "PrimePairs"],
  },
  {
    name: "SophieGermainPrimes",
    domain: "Collections",
    signature: "SophieGermainPrimes",
    summary: "The Sophie Germain primes $2, 3, 5, 11, 23, …$: primes $p$ with $2p+1$ also prime.",
    signatures: [
      {
        call: "SophieGermainPrimes",
        description:
          "the prime $p$ with $2p+1$ also prime, an indexed collection of open infinitude.",
      },
    ],
    details: [
      "A lazy indexed collection; whether there are infinitely many is open, so $Count(SophieGermainPrimes) = NaN$. OEIS A005384.",
      "$At(SophieGermainPrimes, k)$ unranks by scanning forward, testing primality of $n$ and $2n+1$ -- $At(SophieGermainPrimes, 4) = 11$ ($23$ is prime).",
      "Membership goes through [[Element]]: $Element(11, SophieGermainPrimes)$ is true, $Element(7, SophieGermainPrimes)$ is false ($15$ is not prime).",
    ],
    examples: [],
    enumerate: { expr: "Take(SophieGermainPrimes, 20)" },
    seeAlso: ["Count", "At", "Element", "SafePrimes", "Primes"],
  },
  {
    name: "SafePrimes",
    domain: "Collections",
    signature: "SafePrimes",
    summary: "The safe primes $5, 7, 11, 23, 47, …$: primes $q$ with $(q-1)/2$ also prime.",
    signatures: [
      {
        call: "SafePrimes",
        description:
          "the prime $q$ with $(q-1)/2$ also prime, an indexed collection of open infinitude.",
      },
    ],
    details: [
      "A lazy indexed collection, and the mirror image of [[SophieGermainPrimes]] ($q$ is safe iff $(q-1)/2$ is Sophie Germain); infinitude is equally open, so $Count(SafePrimes) = NaN$. OEIS A005385.",
      "$At(SafePrimes, k)$ unranks by scanning forward, testing primality of $n$ and $(n-1)/2$ -- $At(SafePrimes, 1) = 5$ ($2$ is prime).",
      "Membership goes through [[Element]]: $Element(23, SafePrimes)$ is true ($11$ is prime), $Element(13, SafePrimes)$ is false ($6$ is not prime).",
    ],
    examples: [],
    enumerate: { expr: "Take(SafePrimes, 20)" },
    seeAlso: ["Count", "At", "Element", "SophieGermainPrimes", "Primes"],
  },
  {
    name: "PrimePairs",
    domain: "Collections",
    signature: "PrimePairs(gap)",
    summary:
      "The lesser prime $p$ of a pair $(p, p+gap)$, both prime -- $gap$ selects the family ($2$=twin, $4$=cousin, $6$=sexy, …), as a lazy indexed family.",
    signatures: [
      {
        call: "PrimePairs(gap)",
        description:
          "the prime $p$ with $p+gap$ also prime, an indexed collection of open infinitude for every $gap$.",
      },
    ],
    details: [
      "A lazy indexed collection for each $gap$; whether there are infinitely many prime pairs at ANY fixed gap is open (the twin-prime conjecture generalises to every gap), so $Count(PrimePairs(gap)) = NaN$ for every $gap$, not just $gap=2$.",
      "$PrimePairs(2)$, $PrimePairs(4)$, $PrimePairs(6)$ are [[TwinPrimes]], [[CousinPrimes]], [[SexyPrimes]] verbatim.",
      "$At(PrimePairs(gap), i)$ unranks the $i$-th match by scanning forward, testing primality of $n$ and $n+gap$ -- $At(PrimePairs(4), 1) = 3$.",
      "Membership goes through [[Element]]: $Element(3, PrimePairs(4))$ is true ($3,7$ both prime), $Element(5, PrimePairs(4))$ is false ($9$ is not).",
    ],
    examples: [],
    enumerate: { expr: "Take(PrimePairs(4), 20)" },
    seeAlso: ["Count", "At", "Element", "TwinPrimes", "CousinPrimes", "SexyPrimes"],
  },
  {
    name: "PalindromicPrimes",
    domain: "Collections",
    signature: "PalindromicPrimes",
    summary:
      "The palindromic primes $2, 3, 5, 7, 11, 101, …$: primes that read the same forwards and backwards in base 10.",
    signatures: [
      {
        call: "PalindromicPrimes",
        description:
          "the prime $p$ whose decimal digits are a palindrome, an indexed collection of open infinitude.",
      },
    ],
    details: [
      "A lazy indexed collection; whether there are infinitely many (beyond the trivial even-length exclusion -- every palindrome with an even digit count past 11 is divisible by 11) is open, so $Count(PalindromicPrimes) = NaN$. OEIS A002385.",
      "$At(PalindromicPrimes, k)$ unranks by scanning forward, testing primality and digit-palindromy -- $At(PalindromicPrimes, 6) = 101$.",
      "Membership goes through [[Element]]: $Element(101, PalindromicPrimes)$ is true, $Element(103, PalindromicPrimes)$ is false ($103 \\ne 301$).",
    ],
    examples: [],
    enumerate: { expr: "Take(PalindromicPrimes, 20)" },
    seeAlso: ["Count", "At", "Element", "CircularPrimes", "EmirpPrimes"],
  },
  {
    name: "CircularPrimes",
    domain: "Collections",
    signature: "CircularPrimes",
    summary:
      "The circular primes $2, 3, 5, 7, 11, 13, 17, 31, …$: primes whose every base-10 digit rotation is also prime.",
    signatures: [
      {
        call: "CircularPrimes",
        description:
          "the prime $p$ (no digit 0) with every cyclic rotation of its decimal digits also prime, an indexed collection of open infinitude.",
      },
    ],
    details: [
      "A lazy indexed collection; conjectured but unproven that only finitely many beyond the repunit primes $R_n$ (all-1s) exist at all, and separately whether infinitely many repunit primes exist is itself open, so $Count(CircularPrimes) = NaN$. OEIS A068652. A digit-0 prime is excluded (a rotation would start with a leading zero).",
      "$At(CircularPrimes, k)$ unranks by scanning forward, testing every rotation's primality -- $At(CircularPrimes, 8) = 31$ ($31$ and $13$ both prime).",
      "Membership goes through [[Element]]: $Element(13, CircularPrimes)$ is true ($13, 31$ both prime), $Element(19, CircularPrimes)$ is false ($91 = 7 \\times 13$, its only other rotation, isn't prime).",
    ],
    examples: [],
    enumerate: { expr: "Take(CircularPrimes, 20)" },
    seeAlso: ["Count", "At", "Element", "PalindromicPrimes", "EmirpPrimes"],
  },
  {
    name: "EmirpPrimes",
    domain: "Collections",
    signature: "EmirpPrimes",
    summary:
      "The emirps $13, 17, 31, 37, 71, …$: primes whose decimal reversal is a DIFFERENT prime ('prime' spelled backwards).",
    signatures: [
      {
        call: "EmirpPrimes",
        description:
          "the prime $p$ with $\\mathrm{reverse}(p) \\ne p$ also prime, an indexed collection of open infinitude.",
      },
    ],
    details: [
      "A lazy indexed collection; infinitude is conjectured but unproven, so $Count(EmirpPrimes) = NaN$. OEIS A006567. Excludes palindromic primes ($\\mathrm{reverse}(p)=p$ is disqualified, even though $p$ is trivially 'prime both ways').",
      "$At(EmirpPrimes, k)$ unranks by scanning forward, testing primality of $n$ and its reversal -- $At(EmirpPrimes, 1) = 13$ ($31$ is prime, and $31 \\ne 13$).",
      "Membership goes through [[Element]]: $Element(13, EmirpPrimes)$ is true, $Element(11, EmirpPrimes)$ is false (reversal is itself, a palindrome).",
    ],
    examples: [],
    enumerate: { expr: "Take(EmirpPrimes, 20)" },
    seeAlso: ["Count", "At", "Element", "PalindromicPrimes", "CircularPrimes"],
  },
  {
    name: "MersennePrimes",
    domain: "Collections",
    signature: "MersennePrimes",
    summary: "The Mersenne primes $3, 7, 31, 127, 8191, …$: primes of the form $2^p - 1$.",
    signatures: [
      {
        call: "MersennePrimes",
        description:
          "the primes $2^p-1$ for a prime exponent $p$, an indexed collection of open infinitude -- only finitely many are known at any time.",
      },
    ],
    details: [
      "A lazy indexed collection; whether there are infinitely many is the open Lenstra-Pomerance-Wagstaff conjecture, so $Count(MersennePrimes) = NaN$. OEIS A000668.",
      "$At(MersennePrimes, k)$ unranks from a table of exponents verified by the Lucas-Lehmer test, not a search -- the known terms grow to tens of millions of digits, so past the point a value would exceed what a numeric collection element can represent exactly ($2^{53}-1$), $At$ answers $NaN$ rather than hang looking for more: $At(MersennePrimes, 4) = 127$ ($p=7$), and $At(MersennePrimes, 9)$ is $NaN$ (the 9th, $2^{61}-1$, exists and is known, but doesn't fit).",
      "Membership goes through [[Element]]: $Element(127, MersennePrimes)$ is true, $Element(63, MersennePrimes)$ is false ($2^6-1=63=3^2 \\times 7$, and 6 isn't even prime).",
    ],
    examples: [],
    enumerate: { expr: "Take(MersennePrimes, 8)" },
    seeAlso: ["Count", "At", "Element", "Primes", "FibonacciPrimes"],
  },
  {
    name: "FibonacciPrimes",
    domain: "Collections",
    signature: "FibonacciPrimes",
    summary:
      "The Fibonacci primes $2, 3, 5, 13, 89, 233, …$: Fibonacci numbers that are themselves prime.",
    signatures: [
      {
        call: "FibonacciPrimes",
        description:
          "the Fibonacci number $F(n)$ that is prime, an indexed collection of open infinitude -- only finitely many are known at any time.",
      },
    ],
    details: [
      "A lazy indexed collection; whether there are infinitely many is open, so $Count(FibonacciPrimes) = NaN$. OEIS A005478.",
      "$At(FibonacciPrimes, k)$ unranks from a table of Fibonacci indices verified prime by exact bigint primality testing, not a search -- past the point a term exceeds what a numeric collection element can represent exactly ($2^{53}-1$), $At$ answers $NaN$ rather than hang: $At(FibonacciPrimes, 4) = 13$ ($F(7)$), $At(FibonacciPrimes, 12)$ is $NaN$.",
      "Membership goes through [[Element]]: $Element(89, FibonacciPrimes)$ is true ($F(11)$, prime), $Element(21, FibonacciPrimes)$ is false ($F(8)=21=3\\times7$).",
    ],
    examples: [],
    enumerate: { expr: "Take(FibonacciPrimes, 11)" },
    seeAlso: ["Count", "At", "Element", "MersennePrimes", "Primes"],
  },
];
