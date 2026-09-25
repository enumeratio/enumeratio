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
];
