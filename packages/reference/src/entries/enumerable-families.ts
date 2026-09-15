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
];
