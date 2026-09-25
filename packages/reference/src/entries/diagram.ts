// GENERATED from YAML by packages/reference/scripts/migrate/shims.ts -- do not edit.
// Edit the YAML named in `sources`, then run `node packages/reference/scripts/migrate/shims.ts`.

import type { ReferenceEntry } from "@enumeratio/entry";

/** The YAML each entry below was generated from, in the same order. */
export const sources: readonly string[] = [
  "packages/symbols/algebras/diagram/reference/Diagram.yaml",
  "packages/symbols/algebras/diagram/reference/PartitionAlgebra.yaml",
  "packages/symbols/algebras/diagram/reference/BrauerAlgebra.yaml",
  "packages/symbols/algebras/diagram/reference/TemperleyLiebAlgebra.yaml",
  "packages/symbols/algebras/diagram/reference/MotzkinAlgebra.yaml",
  "packages/symbols/algebras/diagram/reference/OrbitDiagram.yaml",
];

export const diagramAlgebras: readonly ReferenceEntry[] = [
  {
    name: "Diagram",
    domain: "Diagram algebras",
    signature: "Diagram(blocks)",
    summary:
      "A diagram: a set partition of $2n$ points, a top row $1…n$ and a bottom row $1'…n'$, written as blocks of signed labels. The basis element of every algebra below.",
    signatures: [
      {
        call: "Diagram([[1,-1],[2,-2]])",
        description: "blocks of signed labels — positive on the top row, negative on the bottom",
        library: "enumeratio-diagram",
      },
    ],
    details: [
      "Multiplication is geometric: stack $a$ above $b$, glue $a$'s bottom row to $b$'s top, keep what stays connected between the outer rows and discard the middle",
      "A block left entirely in the discarded middle was a closed loop, and contributes one factor of the loop parameter $\\delta$ — so these algebras live over $\\mathbb{Z}[\\delta]$",
      "Use the ORDERED product ([[NonCommutativeMultiply]], infix $\\otimes$): a diagram algebra is not commutative",
      "Diagrams normalise, so a written diagram and a computed one are the same expression",
      "Every point $\\pm 1 … \\pm n$ must appear exactly once; a diagram missing one is malformed and is left as written",
    ],
    examples: [
      {
        id: "the-cup-cap-squared-closes-one-loop-e-1-2-delta",
        expr: [
          "NonCommutativeMultiply",
          ["Diagram", ["List", ["List", 1, 2], ["List", -1, -2]]],
          ["Diagram", ["List", ["List", 1, 2], ["List", -1, -2]]],
        ],
        expected: ["Multiply", "delta", ["Diagram", ["List", ["List", 1, 2], ["List", -1, -2]]]],
        caption: "the cup-cap squared closes one loop: $e_1^2 = \\delta e_1$",
      },
      {
        id: "e-1e-2e-1-e-1-with-no-loop-closed",
        expr: [
          "NonCommutativeMultiply",
          ["Diagram", ["List", ["List", 1, 2], ["List", -1, -2], ["List", 3, -3]]],
          ["Diagram", ["List", ["List", 2, 3], ["List", -2, -3], ["List", 1, -1]]],
          ["Diagram", ["List", ["List", 1, 2], ["List", -1, -2], ["List", 3, -3]]],
        ],
        expected: ["Diagram", ["List", ["List", 1, 2], ["List", 3, -3], ["List", -1, -2]]],
        caption: "$e_1e_2e_1 = e_1$, with no loop closed",
        category: "Properties",
      },
      {
        id: "blocks-come-back-in-canonical-order",
        expr: ["Diagram", ["List", ["List", -1, -2], ["List", 3, -3], ["List", 1, 2]]],
        expected: ["Diagram", ["List", ["List", 1, 2], ["List", 3, -3], ["List", -1, -2]]],
        caption: "blocks come back in canonical order",
        category: "Properties",
      },
      {
        id: "malformed-the-point-2-is-missing-so-it-is-left",
        expr: ["Diagram", ["List", ["List", 1, -1], ["List", 2]]],
        expected: ["Diagram", ["List", ["List", 1, -1], ["List", 2]]],
        caption: "malformed — the point $-2$ is missing — so it is left alone",
        category: "Possible issues",
      },
    ],
    seeAlso: ["TemperleyLiebAlgebra", "PartitionAlgebra", "NonCommutativeMultiply"],
  },
  {
    name: "PartitionAlgebra",
    domain: "Diagram algebras",
    signature: "PartitionAlgebra(n)",
    summary:
      "$P_n(\\delta)$: every set partition of $2n$ points. The largest of the family — all the others are subalgebras cut out by admitting fewer diagrams. Dimension $B(2n)$, the Bell numbers.",
    signatures: [
      {
        call: "PartitionAlgebra(n)",
        description: "the partition algebra on $n$ strands",
        library: "enumeratio-diagram",
      },
      {
        call: "PlanarPartitionAlgebra(n)",
        description: "only the planar diagrams — dimension $C(2n)$",
        library: "enumeratio-diagram",
      },
    ],
    details: [
      "Dimension $B(2n)$: 2, 15, 203, 4140 for $n = 1,2,3,4$ — the Bell numbers at even index",
      "Restricting to planar diagrams gives $C(2n)$, the Catalan numbers",
      "[[Basis]] lists the diagrams and [[AlgebraDimension]] answers from the closed form, so the dimension is available well past the point where listing is useful",
      "[[Element]] tests membership, which is what makes the inclusions checkable",
    ],
    examples: [
      {
        id: "b-6",
        expr: ["AlgebraDimension", ["PartitionAlgebra", 3]],
        expected: 203,
        caption: "$B(6)$",
      },
      {
        id: "b-8-the-closed-form-answers-past-any-useful",
        expr: ["AlgebraDimension", ["PartitionAlgebra", 4]],
        expected: 4140,
        caption: "$B(8)$ — the closed form answers past any useful basis listing",
        category: "Scope",
      },
      {
        id: "c-6-planarity-cuts-203-down-to-132",
        expr: ["AlgebraDimension", ["PlanarPartitionAlgebra", 3]],
        expected: 132,
        caption: "$C(6)$ — planarity cuts 203 down to 132",
        category: "Scope",
      },
      {
        id: "a-block-of-three-is-a-partition-diagram-and",
        expr: [
          "Element",
          ["Diagram", ["List", ["List", 1, 2, -1], ["List", 3, -3], ["List", -2]]],
          ["PartitionAlgebra", 3],
        ],
        expected: "True",
        caption: "a block of three is a partition diagram and nothing smaller",
        category: "Properties",
      },
    ],
    seeAlso: ["Diagram", "BrauerAlgebra", "TemperleyLiebAlgebra"],
  },
  {
    name: "BrauerAlgebra",
    domain: "Diagram algebras",
    signature: "BrauerAlgebra(n)",
    summary:
      "$B_n(\\delta)$: the diagrams that are perfect matchings — every point paired with exactly one other. Dimension $(2n-1)!!$.",
    signatures: [
      {
        call: "BrauerAlgebra(n)",
        description: "the Brauer algebra on $n$ strands",
        library: "enumeratio-diagram",
      },
    ],
    details: [
      "Dimension $(2n-1)!!$ = 1, 3, 15, 105 — the perfect matchings of $2n$ points",
      "Contains the symmetric group: a permutation diagram is a matching whose every block joins a top point to a bottom one",
      "The generators satisfy $s_i^2 = 1$, the braid relation, and $s_ie_i = e_i$",
      "Restricting further to the PLANAR matchings gives [[TemperleyLiebAlgebra]]",
    ],
    examples: [
      { id: "5", expr: ["AlgebraDimension", ["BrauerAlgebra", 3]], expected: 15, caption: "$5!!$" },
      {
        id: "algebradimension-braueralgebra-4",
        expr: ["AlgebraDimension", ["BrauerAlgebra", 4]],
        expected: 105,
      },
      {
        id: "a-crossing-is-a-brauer-diagram",
        expr: [
          "Element",
          ["Diagram", ["List", ["List", 1, -2], ["List", 2, -1], ["List", 3, -3]]],
          ["BrauerAlgebra", 3],
        ],
        expected: "True",
        caption: "a crossing is a Brauer diagram…",
        category: "Properties",
      },
      {
        id: "but-not-a-planar-one",
        expr: [
          "Element",
          ["Diagram", ["List", ["List", 1, -2], ["List", 2, -1], ["List", 3, -3]]],
          ["TemperleyLiebAlgebra", 3],
        ],
        expected: "False",
        caption: "…but not a planar one",
        category: "Properties",
      },
    ],
    seeAlso: ["TemperleyLiebAlgebra", "PartitionAlgebra", "Diagram"],
  },
  {
    name: "TemperleyLiebAlgebra",
    domain: "Diagram algebras",
    signature: "TemperleyLiebAlgebra(n)",
    summary:
      "$TL_n(\\delta)$: the PLANAR perfect matchings — the diagrams you can draw in a rectangle without crossings. Dimension $C(n)$, the Catalan numbers.",
    signatures: [
      {
        call: "TemperleyLiebAlgebra(n)",
        description: "the Temperley–Lieb algebra on $n$ strands",
        library: "enumeratio-diagram",
      },
    ],
    details: [
      "Dimension $C(n)$ = 1, 2, 5, 14, 42 — the Catalan numbers, and the reason non-crossing matchings and Dyck paths are the same objects",
      "Generated by the cup-caps $e_i$, with $e_i^2 = \\delta e_i$, $e_ie_{i\\pm1}e_i = e_i$, and $e_ie_j = e_je_i$ when $|i-j| \\ge 2$",
      "Those relations are what the stacking rule produces — they are not imposed separately",
      "The home of the Jones polynomial, via the Markov trace on $TL_n$",
    ],
    examples: [
      {
        id: "c-4",
        expr: ["AlgebraDimension", ["TemperleyLiebAlgebra", 4]],
        expected: 14,
        caption: "$C(4)$",
      },
      {
        id: "the-cup-cap-is-planar-so-it-belongs",
        expr: [
          "Element",
          ["Diagram", ["List", ["List", 1, 2], ["List", -1, -2], ["List", 3, -3]]],
          ["TemperleyLiebAlgebra", 3],
        ],
        expected: "True",
        caption: "the cup-cap is planar, so it belongs",
        category: "Properties",
      },
      {
        id: "e-1-2-delta-e-1",
        expr: [
          "NonCommutativeMultiply",
          ["Diagram", ["List", ["List", 1, 2], ["List", -1, -2]]],
          ["Diagram", ["List", ["List", 1, 2], ["List", -1, -2]]],
        ],
        expected: ["Multiply", "delta", ["Diagram", ["List", ["List", 1, 2], ["List", -1, -2]]]],
        caption: "$e_1^2 = \\delta e_1$",
        category: "Properties",
      },
      {
        id: "the-cup-cap-and-the-identity-all-of-tl-2",
        expr: ["Basis", ["TemperleyLiebAlgebra", 2]],
        expected: [
          "List",
          ["Diagram", ["List", ["List", 1, 2], ["List", -1, -2]]],
          ["Diagram", ["List", ["List", 1, -1], ["List", 2, -2]]],
        ],
        caption: "the cup-cap and the identity — all of $TL_2$",
      },
    ],
    seeAlso: ["BrauerAlgebra", "MotzkinAlgebra", "Diagram"],
  },
  {
    name: "MotzkinAlgebra",
    domain: "Diagram algebras",
    signature: "MotzkinAlgebra(n)",
    summary:
      "$M_n(\\delta)$: the planar diagrams whose blocks have size at most two — so points may also be left unpaired. Dimension $M(2n)$, the Motzkin numbers.",
    signatures: [
      {
        call: "MotzkinAlgebra(n)",
        description: "the Motzkin algebra on $n$ strands",
        library: "enumeratio-diagram",
      },
      {
        call: "RookAlgebra(n)",
        description: "partial permutations — blocks of size ≤ 2, each pairing a top with a bottom",
        library: "enumeratio-diagram",
      },
      {
        call: "SymmetricGroupAlgebra(n)",
        description: "permutation diagrams only — dimension $n!$",
        library: "enumeratio-diagram",
      },
    ],
    details: [
      "Dimension $M(2n)$ = 2, 9, 51, 323 — the Motzkin numbers, which count the same paths with a flat step that Catalan counts without",
      "Contains [[TemperleyLiebAlgebra]]: dropping the requirement that every point be paired is exactly what turns Catalan into Motzkin",
      "`RookAlgebra(n)` counts $\\sum_k \\binom{n}{k}^2 k!$ — the partial permutations, i.e. the placements of non-attacking rooks",
      "`SymmetricGroupAlgebra(n)` is the group algebra of $S_n$, the diagrams that are honest bijections",
    ],
    examples: [
      {
        id: "m-6",
        expr: ["AlgebraDimension", ["MotzkinAlgebra", 3]],
        expected: 51,
        caption: "$M(6)$",
      },
      {
        id: "algebradimension-rookalgebra-3",
        expr: ["AlgebraDimension", ["RookAlgebra", 3]],
        expected: 34,
      },
      {
        id: "5",
        expr: ["AlgebraDimension", ["SymmetricGroupAlgebra", 5]],
        expected: 120,
        caption: "$5!$",
      },
      {
        id: "a-cup-cap-is-not-a-permutation",
        expr: [
          "Element",
          ["Diagram", ["List", ["List", 1, 2], ["List", -1, -2], ["List", 3, -3]]],
          ["SymmetricGroupAlgebra", 3],
        ],
        expected: "False",
        caption: "a cup-cap is not a permutation",
        category: "Properties",
      },
    ],
    seeAlso: ["TemperleyLiebAlgebra", "PartitionAlgebra", "Diagram"],
  },
  {
    name: "OrbitDiagram",
    domain: "Diagram algebras",
    signature: "OrbitDiagram(blocks)",
    summary:
      "The orbit basis of the partition algebra. A diagram $d_\\lambda$ asks for points to be connected; an orbit element $x_\\lambda$ asks for them to be connected AND NOTHING ELSE — so the two bases differ by Möbius inversion over the partition lattice.",
    signatures: [
      {
        call: "OrbitDiagram(blocks)",
        description: "an orbit basis element",
        library: "enumeratio-diagram",
      },
      {
        call: "InDiagramBasis(x) / InOrbitBasis(x)",
        description: "change of basis, either direction",
        library: "enumeratio-diagram",
      },
      {
        call: "PartitionMobius(finer, coarser)",
        description: "the partition lattice's Möbius function on that interval",
        library: "enumeratio-diagram",
      },
      {
        call: "DiagramCoarsenings(d)",
        description: "every partition coarser than this one",
        library: "enumeratio-diagram",
      },
    ],
    details: [
      "$d_\\lambda = \\sum_{\\mu \\succeq \\lambda} x_\\mu$, and the inverse carries $\\mu_\\Pi(\\lambda,\\mu) = \\prod_{B}(-1)^{k_B-1}(k_B-1)!$",
      "Coarsening is partitioning the blocks, so a diagram with $k$ blocks has $\\mathrm{Bell}(k)$ coarsenings",
      "The change of basis is unitriangular in the number of blocks, which is what makes the two maps inverse",
      "Contrast the Hopf-algebra bases, which invert over the BOOLEAN lattice where the Möbius function is only a sign — the factorials here are the cost of merging any blocks rather than adjacent ones",
      "The map onto the symmetric group's centraliser algebra kills $x_\\lambda$ exactly when $\\lambda$ has more blocks than $\\delta$ — a statement with no clean form in the diagram basis",
    ],
    examples: [
      {
        id: "merging-four-points-into-one-block-1-3-3",
        expr: [
          "PartitionMobius",
          ["Diagram", ["List", ["List", 1], ["List", 2], ["List", -1], ["List", -2]]],
          ["Diagram", ["List", ["List", 1, 2, -1, -2]]],
        ],
        expected: -6,
        caption: "merging four points into one block: $(-1)^3 3! $",
      },
      {
        id: "the-coarsest-partition-has-nothing-above-it",
        expr: ["InOrbitBasis", ["Diagram", ["List", ["List", 1, -1]]]],
        expected: ["OrbitDiagram", ["List", ["List", 1, -1]]],
        caption: "the coarsest partition has nothing above it",
        category: "Properties",
      },
      {
        id: "the-interval-of-length-zero",
        expr: [
          "PartitionMobius",
          ["Diagram", ["List", ["List", 1, -1]]],
          ["Diagram", ["List", ["List", 1, -1]]],
        ],
        expected: 1,
        caption: "the interval of length zero",
        category: "Properties",
      },
    ],
    seeAlso: ["Diagram", "PartitionAlgebra"],
  },
];
