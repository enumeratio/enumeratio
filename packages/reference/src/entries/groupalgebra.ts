// GENERATED from YAML by packages/reference/scripts/migrate/shims.ts -- do not edit.
// Edit the YAML named in `sources`, then run `node packages/reference/scripts/migrate/shims.ts`.

import type { ReferenceEntry } from "@enumeratio/entry";

/** The YAML each entry below was generated from, in the same order. */
export const sources: readonly string[] = [
  "packages/symbols/algebras/groupalgebra/reference/GroupBasis.yaml",
  "packages/symbols/algebras/groupalgebra/reference/ClassSum.yaml",
  "packages/symbols/algebras/groupalgebra/reference/ConjugacyClasses.yaml",
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
];
