// GENERATED from YAML by packages/reference/scripts/migrate/shims.ts -- do not edit.
// Edit the YAML named in `sources`, then run `node packages/reference/scripts/migrate/shims.ts`.

import type { ReferenceEntry } from "@enumeratio/entry";

/** The YAML each entry below was generated from, in the same order. */
export const sources: readonly string[] = [
  "packages/symbols/algebras/groupalgebra/reference/GroupBasis.yaml",
  "packages/symbols/algebras/groupalgebra/reference/ClassSum.yaml",
  "packages/symbols/algebras/groupalgebra/reference/ConjugacyClasses.yaml",
  "packages/symbols/algebras/groupalgebra/reference/Cycles.yaml",
  "packages/symbols/algebras/groupalgebra/reference/PermutationCycles.yaml",
  "packages/symbols/algebras/groupalgebra/reference/InversePermutation.yaml",
  "packages/symbols/algebras/groupalgebra/reference/Permute.yaml",
  "packages/symbols/algebras/groupalgebra/reference/PermutationGroup.yaml",
  "packages/symbols/algebras/groupalgebra/reference/GroupGenerators.yaml",
  "packages/symbols/algebras/groupalgebra/reference/GroupOrder.yaml",
  "packages/symbols/algebras/groupalgebra/reference/GroupElements.yaml",
];

export const groupAlgebras: readonly ReferenceEntry[] = [
  {
    name: "GroupBasis",
    domain: "Group algebras",
    signature: "GroupBasis(label)",
    summary:
      "A basis element of the group algebra $k[G]$, named by its group element's label. The product is the group's own multiplication, extended bilinearly.",
    signatures: [
      {
        call: "GroupBasis(label)",
        description: "the basis element for that group element",
        library: "enumeratio-groupalgebra",
      },
      {
        call: "GroupProduct(group, a, b)",
        description: "multiply — the group is named, since a basis element does not carry it",
        library: "enumeratio-groupalgebra",
      },
    ],
    details: [
      "Groups: `CyclicGroup(n)` with elements $0 \\dots n-1$, `DihedralGroup(n)` with elements `k` for $r^k$ and `s k` for $s r^k$, and `GroupDirectProduct(g, h)`",
      "$k[\\mathbb{Z}_n]$ multiplies by adding indices mod $n$ — it is $k[x]/(x^n-1)$",
      "$k[G]$ is commutative exactly when $G$ is abelian",
      "Dihedral relations: $r^n = 1$, $s^2 = 1$, $s r s = r^{-1}$",
      "$\\dim k[G] = |G|$, and `Basis(GroupAlgebra(group))` lists the elements",
    ],
    examples: [
      {
        id: "2-5-7-equiv-1",
        expr: [
          "GroupProduct",
          ["CyclicGroup", 6],
          ["GroupBasis", ["String", "2"]],
          ["GroupBasis", ["String", "5"]],
        ],
        expected: ["GroupBasis", "'1'"],
        caption: "$2 + 5 = 7 \\equiv 1$",
      },
      {
        id: "s-2-1",
        expr: [
          "GroupProduct",
          ["DihedralGroup", 4],
          ["GroupBasis", ["String", "s0"]],
          ["GroupBasis", ["String", "s0"]],
        ],
        expected: ["GroupBasis", "'0'"],
        caption: "$s^2 = 1$",
        category: "Properties",
      },
      {
        id: "d-4-8",
        expr: ["AlgebraDimension", ["GroupAlgebra", ["DihedralGroup", 4]]],
        expected: 8,
        caption: "$|D_4| = 8$",
      },
      {
        id: "so-k-d-4-is-not-commutative-either",
        expr: ["GroupIsAbelian", ["DihedralGroup", 4]],
        expected: "False",
        caption: "so $k[D_4]$ is not commutative either",
        category: "Properties",
      },
    ],
    seeAlso: ["ClassSum", "ConjugacyClasses", "Basis"],
  },
  {
    name: "ClassSum",
    domain: "Group algebras",
    signature: "ClassSum(group, k)",
    summary:
      "The $k$-th class sum: add up one conjugacy class. Class sums are the basis of the CENTRE of $k[G]$ — a commutative subalgebra of a usually non-commutative algebra.",
    signatures: [
      {
        call: "ClassSum(group, k)",
        description: "the sum of the $k$-th conjugacy class (1-indexed)",
        library: "enumeratio-groupalgebra",
      },
      {
        call: "IsCentral(group, element)",
        description: "whether an element commutes with everything",
        library: "enumeratio-groupalgebra",
      },
    ],
    details: [
      "A single non-central element is not central, but the class sum containing it always is — that is the point",
      "Class sums have disjoint supports, so they are linearly independent and form a basis of the centre",
      "The first class is always the identity alone",
      "$\\dim Z(k[G])$ is the number of conjugacy classes, which is also the number of irreducible characters of $G$",
    ],
    examples: [
      {
        id: "the-identity-s-class-is-a-singleton",
        expr: ["ClassSum", ["DihedralGroup", 3], 1],
        expected: ["GroupBasis", "'0'"],
        caption: "the identity's class is a singleton",
      },
      {
        id: "class-sums-are-central",
        expr: ["IsCentral", ["DihedralGroup", 3], ["ClassSum", ["DihedralGroup", 3], 2]],
        expected: "True",
        caption: "class sums are central",
        category: "Properties",
      },
      {
        id: "a-lone-reflection-is-not",
        expr: ["IsCentral", ["DihedralGroup", 3], ["GroupBasis", ["String", "s0"]]],
        expected: "False",
        caption: "a lone reflection is not",
        category: "Properties",
      },
      {
        id: "in-an-abelian-group-everything-is-central",
        expr: ["IsCentral", ["CyclicGroup", 6], ["GroupBasis", ["String", "3"]]],
        expected: "True",
        caption: "in an abelian group everything is central",
        category: "Scope",
      },
    ],
    seeAlso: ["ConjugacyClasses", "GroupBasis"],
  },
  {
    name: "ConjugacyClasses",
    domain: "Group algebras",
    signature: "ConjugacyClasses(group)",
    summary:
      "The conjugacy classes of a finite group — the orbits of $g \\mapsto xgx^{-1}$. Their number is the dimension of the centre of $k[G]$.",
    signatures: [
      {
        call: "ConjugacyClasses(group)",
        description: "the classes, as a list of lists",
        library: "enumeratio-groupalgebra",
      },
      {
        call: "GroupCentreDimension(group)",
        description: "how many there are",
        library: "enumeratio-groupalgebra",
      },
    ],
    details: [
      "An abelian group has one class per element, so $\\dim Z(k[G]) = |G|$",
      "$D_n$ has $(n+3)/2$ classes for odd $n$ and $(n+6)/2$ for even $n$",
      "$D_3 \\cong S_3$ has three: the identity, the transpositions, and the 3-cycles",
      "The classes partition the group, and the identity is always alone in its own",
    ],
    examples: [
      {
        id: "abelian-one-class-per-element",
        expr: ["GroupCentreDimension", ["CyclicGroup", 6]],
        expected: 6,
        caption: "abelian: one class per element",
      },
      {
        id: "d-3-cong-s-3",
        expr: ["GroupCentreDimension", ["DihedralGroup", 3]],
        expected: 3,
        caption: "$D_3 \\cong S_3$",
      },
      {
        id: "4-6-2",
        expr: ["GroupCentreDimension", ["DihedralGroup", 4]],
        expected: 5,
        caption: "$(4+6)/2$",
        category: "Properties",
      },
      {
        id: "direct-products-work-too",
        expr: ["GroupOrder", ["GroupDirectProduct", ["CyclicGroup", 2], ["CyclicGroup", 3]]],
        expected: 6,
        caption: "direct products work too",
        category: "Scope",
      },
    ],
    seeAlso: ["ClassSum", "GroupBasis"],
  },
  {
    name: "Cycles",
    domain: "Permutations",
    signature: "Cycles({{i1, i2, ...}, ...})",
    summary:
      "A permutation written in disjoint-cycle notation: $(i_1\\,i_2\\,\\dots\\,i_k)$ sends $i_1 \\to i_2 \\to \\dots \\to i_k \\to i_1$ and fixes everything else. A carrier, like [[PermutationGroup]] — it holds the cycles rather than computing anything from them.",
    signatures: [
      {
        call: "Cycles({{i1, ..., ik}, ...})",
        description: "the permutation that cycles each listed tuple and fixes every other point",
        library: "enumeratio-groupalgebra",
      },
    ],
    details: [
      "Fixed points (singleton cycles) are dropped on construction — $\\mathrm{Cycles}(\\{\\{1\\},\\{2,3\\}\\})$ and $\\mathrm{Cycles}(\\{\\{2,3\\}\\})$ are the same value",
      "The cycles and their internal order are kept exactly as given otherwise — nothing is sorted or rotated to a canonical start",
      "[[PermutationCycles]] builds one from a one-line word; [[Permute]] applies one to a list; [[InversePermutation]] reverses one",
    ],
    examples: [
      {
        id: "fixed-points-are-dropped",
        expr: ["Cycles", ["List", ["List", 1, 3, 2], ["List", 5], ["List", 4]]],
        expected: ["Cycles", ["List", ["List", 1, 3, 2]]],
        caption:
          "the singleton cycles $\\{5\\}$ and $\\{4\\}$ vanish — they fix those points anyway",
      },
      {
        id: "applying-a-cycle",
        expr: ["Permute", ["List", "a", "b", "c", "d"], ["Cycles", ["List", ["List", 1, 3, 2]]]],
        expected: ["List", "b", "c", "a", "d"],
        caption: "$(1\\,3\\,2)$ moves the item at position 1 to position 3, 3 to 2, 2 to 1",
        category: "Applications",
      },
    ],
    seeAlso: ["PermutationCycles", "Permute", "PermutationGroup", "InversePermutation"],
  },
  {
    name: "PermutationCycles",
    domain: "Permutations",
    signature: "PermutationCycles(perm)",
    summary:
      "A permutation given as a one-line word $\\{\\sigma(1), \\dots, \\sigma(n)\\}$, converted to disjoint-cycle notation ([[Cycles]]). The other direction of [[Permute]]'s two conventions.",
    signatures: [
      {
        call: "PermutationCycles(perm)",
        description: "the cycles of the one-line permutation `perm`, fixed points dropped",
        library: "enumeratio-groupalgebra",
      },
      {
        call: "PermutationCycles(perm, f)",
        description:
          "every position, fixed points included, each wrapped as a singleton — with `f` used in place of [[Cycles]]",
        library: "enumeratio-groupalgebra",
      },
    ],
    details: [
      "Cycles come out ordered by, and each starting at, its smallest point",
      "Already-Cycles input passes straight through unchanged — `PermutationCycles` is idempotent on its own output",
      "The identity permutation has no non-trivial cycles, so `PermutationCycles({1, ..., n})` is `Cycles({})`",
    ],
    examples: [
      {
        id: "one-line-to-cycles",
        expr: ["PermutationCycles", ["List", 2, 5, 3, 6, 1, 8, 7, 9, 4, 10]],
        expected: ["Cycles", ["List", ["List", 1, 2, 5], ["List", 4, 6, 8, 9]]],
        caption: "positions 3, 7 and 10 are fixed and drop out",
      },
      {
        id: "identity-has-no-cycles",
        expr: ["PermutationCycles", ["List", 1, 2, 3, 4, 5]],
        expected: ["Cycles", ["List"]],
        caption: "the identity fixes everything",
      },
      {
        id: "with-a-custom-head",
        expr: ["PermutationCycles", ["List", 2, 5, 3, 6, 1, 8, 7, 9, 4, 10], "head"],
        expected: [
          "head",
          ["List", ["List", 1, 2, 5], ["List", 3], ["List", 4, 6, 8, 9], ["List", 7], ["List", 10]],
        ],
        caption:
          "with a second argument, fixed points stay as singletons and `head` replaces `Cycles`",
        category: "Scope",
      },
      {
        id: "idempotent-on-cycles",
        expr: ["PermutationCycles", ["Cycles", ["List", ["List", 1, 3, 5], ["List", 2, 4, 6]]]],
        expected: ["Cycles", ["List", ["List", 1, 3, 5], ["List", 2, 4, 6]]],
        caption: "already in cycle notation — passed through",
        category: "Scope",
      },
    ],
    seeAlso: ["Cycles", "Permute", "InversePermutation"],
  },
  {
    name: "InversePermutation",
    domain: "Permutations",
    signature: "InversePermutation(perm)",
    summary:
      "The inverse $\\sigma^{-1}$ of a permutation, in whichever notation it was given: a one-line word back to a one-line word, [[Cycles]] back to [[Cycles]].",
    signatures: [
      {
        call: "InversePermutation(perm)",
        description: "$\\sigma^{-1}$, in the same notation as `perm`",
        library: "enumeratio-groupalgebra",
      },
    ],
    details: [
      "For a one-line word, $\\sigma^{-1}(\\sigma(i)) = i$ for every $i$",
      "For [[Cycles]], each cycle $(i_1\\,i_2\\,\\dots\\,i_k)$ inverts to $(i_1\\,i_k\\,\\dots\\,i_2)$ — reversed but still starting at $i_1$",
    ],
    examples: [
      {
        id: "one-line-word",
        expr: ["InversePermutation", ["List", 2, 5, 3, 6, 1, 8, 7, 9, 4, 10]],
        expected: ["List", 5, 1, 3, 9, 2, 4, 7, 6, 8, 10],
      },
      {
        id: "cycle-notation",
        expr: ["InversePermutation", ["Cycles", ["List", ["List", 1, 2, 5], ["List", 4, 6, 8, 9]]]],
        expected: ["Cycles", ["List", ["List", 1, 5, 2], ["List", 4, 9, 8, 6]]],
        category: "Scope",
      },
    ],
    seeAlso: ["Cycles", "PermutationCycles", "Permute"],
  },
  {
    name: "Permute",
    domain: "Permutations",
    signature: "Permute(list, perm)",
    summary:
      "Move the item at position $i$ of `list` to position $\\sigma(i)$, for a permutation `perm` given as [[Cycles]] or a one-line word. Given a [[PermutationGroup]] instead, returns `list` permuted by every element of the group.",
    signatures: [
      {
        call: "Permute(list, perm)",
        description: "list with position $i$ moved to $\\sigma(i)$",
        library: "enumeratio-groupalgebra",
      },
      {
        call: "Permute(list, group)",
        description: "one permuted copy of `list` per element of `group`",
        library: "enumeratio-groupalgebra",
      },
    ],
    details: [
      "`Permute` and [[PermutationCycles]]/[[InversePermutation]] all read $\\sigma$ the same way: a one-line word `{v1, ..., vn}` means $\\sigma(i) = v_i$",
      "A cycle or one-line word longer than `list` leaves the call unevaluated — there is nowhere for the extra positions to go",
      "The `PermutationGroup` form orders its output the way [[GroupElements]] orders that group",
    ],
    examples: [
      {
        id: "by-a-cycle",
        expr: ["Permute", ["List", "a", "b", "c", "d"], ["Cycles", ["List", ["List", 1, 3, 2]]]],
        expected: ["List", "b", "c", "a", "d"],
      },
      {
        id: "by-disjoint-cycles",
        expr: [
          "Permute",
          ["List", "a", "b", "c", "d"],
          ["Cycles", ["List", ["List", 1, 3], ["List", 2, 4]]],
        ],
        expected: ["List", "c", "d", "a", "b"],
        category: "Scope",
      },
      {
        id: "by-a-one-line-word",
        expr: ["Permute", ["List", "a", "b", "c", "d"], ["List", 2, 3, 4, 1]],
        expected: ["List", "d", "a", "b", "c"],
        category: "Scope",
      },
      {
        id: "by-a-permutation-group",
        expr: [
          "Permute",
          ["List", "a", "b", "c"],
          ["PermutationGroup", ["List", ["Cycles", ["List", ["List", 1, 2, 3]]]]],
        ],
        expected: [
          "List",
          ["List", "a", "b", "c"],
          ["List", "c", "a", "b"],
          ["List", "b", "c", "a"],
        ],
        caption: "one permuted copy per element of the cyclic group of order 3",
        category: "Applications",
      },
    ],
    seeAlso: ["Cycles", "PermutationCycles", "PermutationGroup", "GroupElements"],
  },
  {
    name: "PermutationGroup",
    domain: "Permutations",
    signature: "PermutationGroup({perm, ...})",
    summary:
      "The group generated by a list of permutations ([[Cycles]]), closed by breadth-first search over products of the generators. A carrier, like [[Cycles]] — [[GroupOrder]], [[GroupElements]] and [[GroupGenerators]] read it directly rather than it computing anything itself.",
    signatures: [
      {
        call: "PermutationGroup({perm, ...})",
        description:
          "the group $\\langle \\mathrm{perm}, \\dots \\rangle$ generated by the given permutations",
        library: "enumeratio-groupalgebra",
      },
      {
        call: "PermutationGroup({perm, ...}, n)",
        description: "the same group, with its degree (largest point moved) at least `n`",
        library: "enumeratio-groupalgebra",
      },
    ],
    details: [
      "An empty generator list is the trivial group, order 1",
      "A single generator gives the cyclic group of its order — the least common multiple of its cycle lengths",
      "Dihedral groups arise as `PermutationGroup` of an $n$-cycle (rotation) and a 2-cycle-full involution (a flip)",
    ],
    examples: [
      {
        id: "a-cyclic-group",
        expr: [
          "GroupOrder",
          ["PermutationGroup", ["List", ["Cycles", ["List", ["List", 1, 9, 6], ["List", 3, 7]]]]],
        ],
        expected: 6,
        caption: "lcm(3, 2) — one 3-cycle and one 2-cycle in the single generator",
      },
      {
        id: "s4-from-two-generators",
        expr: [
          "GroupOrder",
          [
            "PermutationGroup",
            [
              "List",
              ["Cycles", ["List", ["List", 1, 2, 3, 4]]],
              ["Cycles", ["List", ["List", 1, 2]]],
            ],
          ],
        ],
        expected: 24,
        caption: "a 4-cycle and a transposition generate all of $S_4$",
        category: "Applications",
      },
      {
        id: "the-dihedral-group-of-the-square",
        expr: [
          "GroupOrder",
          [
            "PermutationGroup",
            [
              "List",
              ["Cycles", ["List", ["List", 1, 2, 3, 4]]],
              ["Cycles", ["List", ["List", 1, 3]]],
            ],
          ],
        ],
        expected: 8,
        caption: "rotation + a flip generate the dihedral group of order 8",
        category: "Applications",
      },
    ],
    seeAlso: [
      "Cycles",
      "GroupOrder",
      "GroupElements",
      "GroupGenerators",
      "DihedralGroup",
      "CyclicGroup",
    ],
  },
  {
    name: "GroupGenerators",
    domain: "Permutations",
    signature: "GroupGenerators(group)",
    summary:
      "The generating permutations a [[PermutationGroup]] was built from, in [[Cycles]] notation.",
    signatures: [
      {
        call: "GroupGenerators(group)",
        description: "the generators passed to `PermutationGroup`, unchanged",
        library: "enumeratio-groupalgebra",
      },
    ],
    examples: [
      {
        id: "the-given-generators-come-back",
        expr: [
          "GroupGenerators",
          ["PermutationGroup", ["List", ["Cycles", ["List", ["List", 1, 9, 6], ["List", 3, 7]]]]],
        ],
        expected: ["List", ["Cycles", ["List", ["List", 1, 9, 6], ["List", 3, 7]]]],
      },
    ],
    seeAlso: ["PermutationGroup", "GroupOrder", "GroupElements"],
  },
  {
    name: "GroupOrder",
    domain: "Permutations",
    signature: "GroupOrder(group)",
    summary:
      "$|G|$: how many elements a group has. Works over every carrier this package knows — [[CyclicGroup]], [[DihedralGroup]], [[GroupDirectProduct]], [[SymmetricGroup]] and [[PermutationGroup]].",
    signatures: [
      {
        call: "GroupOrder(group)",
        description: "the number of elements of `group`",
        library: "enumeratio-groupalgebra",
      },
    ],
    details: [
      "For a `PermutationGroup`, the order comes from a breadth-first closure over its generators, not a stored table",
      "`GroupOrder(SymmetricGroup(n))` is $n!$ without materialising all $n!$ permutations",
    ],
    examples: [
      { id: "a-dihedral-group", expr: ["GroupOrder", ["DihedralGroup", 100]], expected: 200 },
      {
        id: "a-permutation-group",
        expr: [
          "GroupOrder",
          ["PermutationGroup", ["List", ["Cycles", ["List", ["List", 1, 9, 6], ["List", 3, 7]]]]],
        ],
        expected: 6,
        category: "Scope",
      },
      {
        id: "the-symmetric-group",
        expr: ["GroupOrder", ["SymmetricGroup", 4]],
        expected: 24,
        caption: "$4!$, without unranking every permutation",
        category: "Scope",
      },
    ],
    seeAlso: [
      "GroupElements",
      "PermutationGroup",
      "DihedralGroup",
      "CyclicGroup",
      "SymmetricGroup",
    ],
  },
  {
    name: "GroupElements",
    domain: "Permutations",
    signature: "GroupElements(group)",
    summary:
      "Every element of a group, or — for a [[PermutationGroup]] with a second, list argument — the elements at those positions (`Part`-style, negative counts from the end).",
    signatures: [
      {
        call: "GroupElements(group)",
        description: "all of `group`'s elements",
        library: "enumeratio-groupalgebra",
      },
      {
        call: "GroupElements(group, positions)",
        description: "a `PermutationGroup`'s elements at `positions`, in its own order",
        library: "enumeratio-groupalgebra",
      },
    ],
    details: [
      "A `PermutationGroup`'s elements print as [[Cycles]], not as [[GroupBasis]] labels — its elements are permutations, not abstract group-algebra basis vectors",
      "The identity always comes first; the rest follow the ascending order of their one-line words",
    ],
    examples: [
      {
        id: "every-element-of-a-permutation-group",
        expr: [
          "GroupElements",
          ["PermutationGroup", ["List", ["Cycles", ["List", ["List", 1, 9, 6], ["List", 3, 7]]]]],
        ],
        expected: [
          "List",
          ["Cycles", ["List"]],
          ["Cycles", ["List", ["List", 3, 7]]],
          ["Cycles", ["List", ["List", 1, 6, 9]]],
          ["Cycles", ["List", ["List", 1, 6, 9], ["List", 3, 7]]],
          ["Cycles", ["List", ["List", 1, 9, 6]]],
          ["Cycles", ["List", ["List", 1, 9, 6], ["List", 3, 7]]],
        ],
      },
      {
        id: "the-first-three-elements",
        expr: [
          "GroupElements",
          ["PermutationGroup", ["List", ["Cycles", ["List", ["List", 1, 9, 6], ["List", 3, 7]]]]],
          ["List", 1, 2, 3],
        ],
        expected: [
          "List",
          ["Cycles", ["List"]],
          ["Cycles", ["List", ["List", 3, 7]]],
          ["Cycles", ["List", ["List", 1, 6, 9]]],
        ],
        category: "Scope",
      },
      {
        id: "the-last-element",
        expr: [
          "GroupElements",
          ["PermutationGroup", ["List", ["Cycles", ["List", ["List", 1, 9, 6], ["List", 3, 7]]]]],
          ["List", -1],
        ],
        expected: ["List", ["Cycles", ["List", ["List", 1, 9, 6], ["List", 3, 7]]]],
        caption: "a negative position counts from the end",
        category: "Scope",
      },
    ],
    seeAlso: ["GroupOrder", "PermutationGroup", "GroupGenerators"],
  },
];
