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
];
