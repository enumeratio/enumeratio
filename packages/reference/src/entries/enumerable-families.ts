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
];
