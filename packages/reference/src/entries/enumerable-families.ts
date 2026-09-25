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
  // ---- numeric-set prototypes (@enumeratio/collections numeric-sets.ts spike): bare
  // integers, not lists, so no glyph fits and Count is genuinely infinite -- see each
  // entry's details. `enumerate` needs a finite collection (`<notatio-collection-table>`
  // rejects an infinite `Count`), so these page a `Take(...)` prefix instead of the family
  // itself.
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
        description:
          "every rooted tree on $n$ nodes with unordered children, one per isomorphism class.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is $A000081(n)$ — $A000081(6) = 20$ — with no elementary closed form, computed via the Euler transform over smaller rooted-tree counts (a multiset of subtrees hangs off the root).",
      "Each element is the level sequence: node depths in canonical preorder, root first at depth 0. Canonical means a node's children are generated weight-descending, ties broken by ascending own rank — the order `At` unranks in, so isomorphic labellings collapse to one entry.",
      "$UnlabeledFreeTrees(n)$ is the unrooted counterpart: a free tree canonically rooted at its centroid uses the same level-sequence encoding.",
    ],
    examples: [],
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
        description:
          "every tree on $n$ unlabelled nodes with no distinguished root, one per isomorphism class.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is $A000055(n)$ — $A000055(7) = 11$ — obtained by canonically rooting each free tree at its centroid: every branch must weigh at most $\\lfloor n/2 \\rfloor$, then a correction $\\binom{T(m), 2}$ (Otter 1948) removes the double count from trees split by a central edge into two non-isomorphic halves.",
      "Each element is a level sequence, exactly as for $RootedUnlabeledTrees$, but rooted at the tree's centroid rather than an arbitrary node.",
      "See [[Binomial]] for the correction term and [[RootedUnlabeledTrees]] for the shared encoding and children-multiset kernel.",
    ],
    examples: [],
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
        description:
          "every rooted binary tree with leaves labeled $1, …, n$ and unlabeled internal nodes.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is $(2n-3)!! = A001147(n-2)$ — $PhylogeneticTrees(5)$ has $105$ elements. See [[Factorial2]].",
      "Built by successive insertion: start from the cherry $\\{1,2\\}$, then for $k = 3, …, n$ attach leaf $k$ at one of $2k-3$ places — above the current root, or subdividing one of the tree's edges.",
      "Each element is the digit sequence $(d_3, …, d_n)$ with $d_k \\in [0, 2k-3)$ recording that insertion choice at each step; $At$ unranks it as a mixed-radix number in those insertion-step radices.",
    ],
    examples: [],
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
        description:
          "every spanning tree on $n+1$ points around a circle with no two edges crossing.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is the Fuss–Catalan number $\\binom{3n}{n} / (2n+1) = A001764(n)$ — $NonCrossingTrees(3)$ has $12$ elements. See [[Binomial]].",
      "In bijection (Flajolet & Noy 1999) with the ternary trees on $n$ internal nodes; each element reuses that encoding as its flat preorder arity word — $3n+1$ entries, each $0$ (leaf) or $3$ (internal node, followed in preorder by its three children).",
      "The $tree$ glyph draws an element directly from this word, since it is already a preorder child-count sequence.",
    ],
    examples: [],
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
        description: "the bracelets of $n$ black-or-white beads on a necklace that can flip.",
      },
    ],
    details: [
      "A lazy indexed collection; the count follows Burnside's lemma over the dihedral group $D_n$ — a rotation sum shared with binary necklaces, plus a reflection sum that splits on the parity of $n$ (OEIS A000029). See [[Totient]], used in the rotation sum.",
      "Each element is the lexicographically-least word in its rotation-and-reflection orbit; that canonical word's 1-count is an invariant of the whole orbit.",
      "$At$ unranks over these canonical words in ascending lexicographic order.",
    ],
    examples: [],
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
        description: "the bracelets of $n$ beads, each one of $k$ colours.",
      },
    ],
    details: [
      "A lazy indexed collection; generalises [[BinaryBracelets]] from $k=2$ to any alphabet size, by the same Burnside sum over $D_n$.",
      "Each element is the lexicographically-least word in its rotation-and-reflection orbit, over letters $0,…,k-1$.",
      "$At$ unranks over these canonical words in ascending lexicographic order.",
    ],
    examples: [],
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
        description: "the length-$n$ binary strings avoiding three 1s in a row.",
      },
    ],
    details: [
      "A lazy indexed collection; the count $T(n)$ satisfies $T(n)=T(n-1)+T(n-2)+T(n-3)$ with $T(0)=1$, $T(1)=2$, $T(2)=4$ — a tribonacci-style recurrence (OEIS A000073, shifted).",
      "Each element is the bit string itself, as a list of 0s and 1s.",
      "$At$ unranks via the same combinatorial-number-system walk as the other binary-word families: at each position, the number of valid completions with a leading 0 sizes the block that sorts first.",
    ],
    examples: [],
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
        description:
          "the length-$n$ binary strings that are not themselves a shorter word repeated.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is $\\sum_{d\\mid n}\\mu(d)\\,2^{n/d}$, the un-normalised sum inside the binary Lyndon-word count. See [[MoebiusMu]].",
      "Every primitive word's $n$ rotations are pairwise distinct and together form the orbit of exactly one length-$n$ Lyndon word, so the family is the union of every such orbit.",
      "Each element is the bit string itself; $At$ unranks over the rotations of the binary Lyndon words, sorted ascending lexicographically.",
    ],
    examples: [],
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
        description: "the $3^n$ base-3 digit strings of length $n$, Gray-code ordered.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is the closed form $3^n$, but the ORDER is the point — it is the standard reflected-Gray-code recursion (each digit's block traversed forward or reversed in turn), not lexicographic.",
      "Each element is the digit string itself, as a list over $\\{0,1,2\\}$.",
      "$At$ unranks directly into that Gray-code order, so consecutive indices always differ in exactly one digit, by exactly 1.",
    ],
    examples: [],
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
        description:
          "the $(2n-1)!!$ permutations of $\\{1,1,…,n,n\\}$ with that betweenness property.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is the double factorial $(2n-1)!!$. See [[Factorial2]].",
      "Built by inserting the pair $(k,k)$, for $k=2,…,n$ increasing, into any of the $2(k-1)+1$ gaps of a Stirling permutation of order $k-1$ — every gap is valid because a later pair always carries a larger label.",
      "Each element is the length-$2n$ word itself; $At$ unranks the per-$k$ gap choices as mixed-radix digits (radix $2k-1$ at level $k$), combined by the standard Horner scheme.",
    ],
    examples: [],
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
  {
    name: "SemistandardTableaux",
    domain: "Collections",
    signature: "SemistandardTableaux(size, max_entry)",
    summary:
      "Semistandard Young tableaux of $n$ cells with entries in $\\{1, …, k\\}$, summed over every shape $\\lambda \\vdash n$, as a lazy indexed family.",
    signatures: [
      {
        call: "SemistandardTableaux(size, max_entry)",
        description:
          "the SSYT of `size` cells over every partition shape, entries from 1 to `max_entry`.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is the hook-content formula $s_\\lambda(1^k) = \\prod_{(r,c) \\in \\lambda} \\frac{k + c - r}{hook(r,c)}$, summed over every shape $\\lambda \\vdash n$ — exact and closed-form.",
      "Each element is the filling's rows: weakly increasing left to right, strictly increasing top to bottom — semistandard, not standard, so entries may repeat within a row (unlike a standard Young tableau).",
      "Unranked in shape-then-entries order: by row-length shape first, then the flattened filling.",
    ],
    examples: [],
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
        description:
          "the triangular arrays with `rows` rows (lengths $n, n-1, …, 1$), entries from 0 to `max_entry`, each row interlacing the row above it.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is the closed-form dimension formula $\\prod_{1 \\le i \\le j \\le n} \\frac{k+i+j-1}{i+j-1}$.",
      "Each element is the array's rows, top (length $n$) to bottom (length 1); row $i{+}1$ interlaces row $i$: within a row entries weakly decrease, and $row_i[j] \\ge row_{i+1}[j] \\ge row_i[j+1]$.",
      "Unranked in backtracking generation order — rows built top-down, each row's entries enumerated within the bounds the row above imposes.",
    ],
    examples: [],
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
        description: "the ASMs of size `size` × `size`.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is the ASM number $A(n) = \\prod_{j=0}^{n-1} \\frac{(3j+1)!}{(n+j)!}$ (the Robbins numbers, OEIS A005130) — $A(4) = 42$.",
      "Each element is the matrix's rows; every row and column sums to 1, and every partial sum reading a row or column from its start lies in $\\{0, 1\\}$ — the alternating-sign condition.",
      "The permutation matrices are exactly the ASMs with no $-1$ entry; $A(n) \\ge n!$ for every $n$, with equality only at $n \\le 2$.",
    ],
    examples: [],
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
        description:
          "the reduced skew shapes $\\lambda/\\mu$ with `size` cells total ($|\\lambda| - |\\mu| = n$).",
      },
    ],
    details: [
      "A lazy indexed collection with no known closed form; the count is the cached enumeration's length, following Sage's `SkewPartitions(n)` convention.",
      'Each element packs both partitions as `[λ, μ]`; "reduced" means every row of $\\lambda$ strictly exceeds the matching row of $\\mu$ (no empty row) and every column $1..\\lambda_1$ is covered by some row\'s cells (no empty column).',
      "Unranked lexicographically, by $\\lambda$ first, then by $\\mu$.",
    ],
    examples: [],
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
        description:
          "the standard fillings of every reduced skew shape $\\lambda/\\mu$ with `size` cells, entries $1..n$ each once, increasing along rows and down columns.",
      },
    ],
    details: [
      "A lazy indexed collection with no known closed form; the count is the cached enumeration's length, summed over every reduced skew shape from [[SkewPartitions]].",
      "Each element packs `[λ, μ, rowWord]`, where `rowWord[i]` is the 0-based row entry $i{+}1$ was placed in, in placement order; $\\mu = 0$ (every row) recovers a plain standard Young tableau.",
      "Unranked by shape ([[SkewPartitions]]'s $\\lambda$-then-$\\mu$ order), then by row-word within a shape.",
    ],
    examples: [],
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
        description:
          "the standard fillings of every shifted diagram of a strict partition of `size`, entries $1..n$ increasing along rows and down columns.",
      },
    ],
    details: [
      "A lazy indexed collection; the count is exact but not a simple closed form — computed by recursive corner removal, the same identity the shifted hook-length formula gives; $1, 1, 1, 2, 3, 6, 12, …$ for $n = 0, 1, 2, …$.",
      "Each element is the diagram's rows; row $i$ (0-indexed) occupies columns $i..i{+}shape[i]{-}1$, so a cell shares a column with the cell one row up and one entry over.",
      "Unranked by shape (strict partitions of $n$, in distinct-parts order), then by recursive corner-removal order within a shape — the value $n$ always sits at a removable corner.",
    ],
    examples: [],
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
        description:
          "the $(P, Q)$ pairs of size `size`, in bijection with the permutations of `size` via RSK.",
      },
    ],
    details: [
      "A lazy indexed collection: $Count(StandardTableauPairs(n)) = n!$, exact and closed-form, since Robinson–Schensted–Knuth is a bijection $S_n \\leftrightarrow \\{(P, Q)\\}$. See [[Factorial]].",
      "Each element is `[P, Q]`, two standard Young tableaux of the same shape; unranking goes through [[SymmetricGroup]]'s permutation unrank, then forward RSK insertion.",
      "Ranking inverts RSK back to a permutation and reads off [[SymmetricGroup]]'s rank — so the two families share one underlying order.",
    ],
    examples: [],
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
        description: "the plane partitions summing to `size` (OEIS A000219).",
      },
    ],
    details: [
      "A lazy indexed collection with no known simple closed form, unlike ordinary partitions' generating function; the count is the cached enumeration's length — $Count(PlanePartitions(6)) = 48$.",
      "Each element is the array's rows; entries weakly decrease along every row and down every column, and the whole array sums to $n$.",
      "Unranked in shape-then-entries order: by row-length shape first, then the flattened array.",
    ],
    examples: [],
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
        description: "the plane partitions fitting an $a \\times b \\times c$ box.",
      },
    ],
    details: [
      "A lazy indexed collection, exact and closed-form by MacMahon's box formula: $Count(BoxedPlanePartitions(a,b,c)) = \\prod_{i=1}^{a} \\prod_{j=1}^{b} \\prod_{k=1}^{c} \\frac{i+j+k-1}{i+j+k-2}$ — $Count(BoxedPlanePartitions(2,2,2)) = 20$.",
      "Each element is the array's rows, [[PlanePartitions]]'s ragged carrier: entries weakly decrease along every row and down every column, with trailing zeros trimmed rather than stored.",
      "Unranked in shape-then-entries order, same as [[PlanePartitions]]; rank/unrank enumerate the box and index into it, so stick to small boxes.",
    ],
    examples: [],
    enumerate: { expr: "BoxedPlanePartitions(2, 2, 2)" },
    seeAlso: ["PlanePartitions", "Count", "At"],
  },
];
