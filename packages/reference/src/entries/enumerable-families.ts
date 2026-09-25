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
];
