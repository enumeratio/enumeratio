import type { ReferenceEntry } from "../types.ts";

// The enumerable combinatorial families: heads that name a finite indexed collection.
// Each has a closed-form `Count` and an `At` that unranks, so the page can enumerate it
// with `<notatio-collection-table>` without ever materialising the whole family. The
// families are provided by @enumeratio/collections, which the reference test does not
// load (it would cycle: collections depends on the reference), so these entries assert
// nothing in bare compute-engine and demonstrate through the live `enumerate` table.
export const enumerableFamilies: readonly ReferenceEntry[] = [
  {
    name: "Subsets",
    domain: "Collections",
    signature: "Subsets(n)",
    summary: "The power set of $\\{1, …, n\\}$ — every subset, as a lazy indexed family of $2^n$.",
    signatures: [
      { call: "Subsets(n)", description: "the $2^n$ subsets of $\\{1, …, n\\}$." },
      { call: "Subsets(collection)", description: "the subsets of any finite collection." },
    ],
    details: [
      "A lazy indexed collection: $Count(Subsets(n)) = 2^n$ in closed form and $At(Subsets(n), i)$ unranks the $i$-th subset, so no subset beyond the page in view is built.",
      "The subsets carrying a fixed size $k$ number $\\binom{n}{k}$; summing over $k$ gives $2^n$. See [[Binomial]].",
      "Each element is the subset's list of members; [[Length]] is its size.",
    ],
    examples: [],
    enumerate: { expr: "Subsets(4)", columns: "Length, Sum", glyph: "subset" },
    seeAlso: ["Binomial", "Length", "Count", "At"],
  },
  {
    name: "SymmetricGroup",
    domain: "Collections",
    signature: "SymmetricGroup(n)",
    summary: "The $n!$ permutations of $\\{1, …, n\\}$ as a lazy indexed family, in one-line form.",
    signatures: [
      { call: "SymmetricGroup(n)", description: "the $n!$ permutations of $\\{1, …, n\\}$." },
    ],
    details: [
      "A lazy indexed collection: $Count(SymmetricGroup(n)) = n!$ and $At$ unranks the $i$-th permutation, so $SymmetricGroup(20)$ — over $2 \\times 10^{18}$ rows — pages as cheaply as a small one.",
      "Each element is the image word $[\\pi(1), …, \\pi(n)]$; the classical statistics ([[Descents]], MajorIndex, Inversions, CycleCount, FixedPoints) are heads over that word.",
      "The derangements — permutations with no fixed point — number $Subfactorial(n)$. See [[Subfactorial]].",
    ],
    examples: [],
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
      },
    ],
    details: [
      "A lazy indexed collection, unranked in reverse-lexicographic order; the count is the partition number $p(n)$ — $p(8) = 22$ — with no elementary closed form.",
      "Each element is the part list in weakly decreasing order; drawn as a Ferrers diagram, its statistics (Length, LargestPart, DurfeeSquare, …) live in $@enumeratio/statistics$.",
      "Conjugation (transposing the diagram) is an involution; the self-conjugate partitions of $n$ equal the partitions of $n$ into distinct odd parts.",
    ],
    examples: [],
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
      },
    ],
    details: [
      "A lazy indexed collection; the count is the Bell number $B_n$ — $B_4 = 15$. See [[BellNumber]].",
      "The partitions into exactly $k$ blocks number the Stirling numbers of the second kind $S(n, k)$; summing over $k$ gives $B_n$. See [[Stirling]].",
      "Each element is the block list; the $set$-$partition$ glyph draws it from its restricted-growth string.",
    ],
    examples: [],
    enumerate: {
      expr: "SetPartitions(4)",
      columns: "Length, Max(Map(Length, _))",
      glyph: "set-partition",
    },
    seeAlso: ["BellNumber", "Stirling", "Count", "At"],
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
        description: "the Baxter permutations of $\\{1, …, n\\}$.",
      },
    ],
    details: [
      "A lazy indexed collection; the count follows the Chung–Graham–Hoggatt–Kleiman rational formula $\\sum_k \\binom{n+1}{k}\\binom{n+1}{k+1}\\binom{n+1}{k+2} \\big/ \\binom{n+1}{1}\\binom{n+1}{2}$ — A001181: $1, 1, 2, 6, 22, 92, …$",
      "Each element is the one-line word $[\\pi(1), …, \\pi(n)]$, as in [[SymmetricGroup]].",
      "$At$ enumerates all $n!$ permutations in lexicographic (factorial-number-system) order and indexes into those satisfying the avoidance, so the family stays a filtered slice of [[SymmetricGroup]]'s own order.",
    ],
    examples: [],
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
        description: "the permutations of $\\{1, …, n\\}$ whose inversions are all adjacent.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is $F(n+1)$ — $1, 1, 2, 3, 5, 8, …$, A000045. See [[Fibonacci]].",
      'As implemented here this is NOT Tenner\'s "Boolean permutations" $Av(321, 3412)$, counted by $F(2n-1)$ (A001519, $1, 1, 2, 5, 13, …$); the two readings first differ at $n = 3$ (3 here against 5 there).',
      "Each permutation is a product of pairwise non-adjacent adjacent transpositions — a bijection with independent sets of the path graph on $\\{1, …, n-1\\}$, i.e. with a length-$(n-1)$ Fibonacci word. $At$ unranks that word and applies its transpositions to the identity.",
    ],
    examples: [],
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
        description: "the permutations of $\\{1, …, n\\}$ with at most one descent.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is $2^n - n$, A000325.",
      'A permutation with at most one descent is the sorted-ascending concatenation of a value-subset $A$ (the "first block") with its sorted-ascending complement, split at the descent; every subset gives such a permutation except that the $n+1$ prefix subsets $\\{1, …, k\\}$ all collapse to the identity.',
      "$At$ fixes the identity at rank $0$ and, for increasing block size $k = 1, …, n-1$, unranks $A$ from the size-$k$ subsets in colex order ([[Binomial]]-many minus the one prefix subset already spoken for).",
    ],
    examples: [],
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
        description: "the permutations of $\\{1, …, n\\}$ with at most one ascent.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is the same $2^n - n$ as [[GrassmannianPermutations]] (A000325), since complementing every value $v \\mapsto n+1-v$ turns each descent into an ascent and vice versa.",
      "Each element is the one-line word of the complemented permutation.",
      "$At$ unranks the Grassmannian permutation of the same rank and applies the value-complement, so it inherits that family's order (identity first, then increasing first-block size).",
    ],
    examples: [],
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
        description:
          "the permutations of $\\{1, …, n\\}$ whose cycles are a non-crossing set partition.",
      },
    ],
    details: [
      "A lazy indexed collection; the count follows a verified recurrence on the block containing $1$ — $1, 2, 6, 23, 105, …$ — with no OEIS match confirmed for this reading, so none is cited.",
      "As implemented, cyclic order within a block is unconstrained; requiring each cycle's elements to increase (the interval $[e, (1\\,2\\,…\\,n)]$ in absolute order) instead gives the Catalan reading $1, 2, 5, 14, …$",
      "Each element is the one-line word; $At$ enumerates all $n!$ permutations in lexicographic order and indexes into those whose cycles are non-crossing.",
    ],
    examples: [],
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
        description: "the permutations of $\\{1, …, n\\}$ built up by direct and skew sums.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is the large Schröder numbers, A006318 — $1, 2, 6, 22, 90, …$",
      "Each element is the one-line word; $At$ enumerates all $n!$ permutations in lexicographic order and indexes into those avoiding $2413$ and $3142$ — there is no closed-form unrank of the permutation itself.",
      "Separable permutations are exactly those avoiding every non-trivial [[SimplePermutations]] pattern beyond length $2$ — every one decomposes recursively as a direct or skew sum.",
    ],
    examples: [],
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
        description: "the permutations of $\\{1, …, n\\}$ with no non-trivial interval.",
      },
    ],
    details: [
      "A lazy indexed collection; there is no closed-form count implemented, so it is the enumeration's own length — A111111, $1, 2, 0, 2, 6, 46, 338, 2926, …$",
      "Every permutation of size $\\geq 4$ decomposes into simple permutations by substitution, which makes this family the atoms [[SeparablePermutations]] and every other substitution-closed class are built from.",
      "Each element is the one-line word; $At$ enumerates all $n!$ permutations in lexicographic order and indexes into those with no non-trivial interval.",
    ],
    examples: [],
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
        description: "the permutations of $\\{1, …, n\\}$ whose Schubert variety is smooth.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is A032351 (Bóna, 1998) — $1, 2, 6, 22, 88, 366, …$ — with no simple closed-form generating function.",
      "Each element is the one-line word; $At$ enumerates all $n!$ permutations in lexicographic order and indexes into those avoiding $3412$ and $4231$.",
      "Smoothness of the Schubert variety $X_\\pi$ is equivalent to pattern-avoidance (Lakshmibai–Sandhya, 1990); no closed-form unrank of the permutation itself is implemented.",
    ],
    examples: [],
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
        description: "the permutations of $\\{1, …, n\\}$ avoiding $2143$.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is A005802 — $1, 2, 6, 23, 103, 513, …$",
      "Each element is the one-line word; $At$ enumerates all $n!$ permutations in lexicographic order and indexes into those avoiding $2143$.",
      'Vexillary ("flag") permutations are exactly those whose Schubert polynomial is a single Schur polynomial — the name is Lascoux and Schützenberger\'s.',
    ],
    examples: [],
    enumerate: {
      expr: "VexillaryPermutations(4)",
      columns: "Descents, MajorIndex",
      glyph: "permutation",
    },
    seeAlso: ["SmoothPermutations", "Count", "At"],
  },
];
