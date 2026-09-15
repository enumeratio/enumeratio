import type { MathJSON, ReferenceEntry } from "../types.ts";

const DOMAIN = "Hopf algebras";
const H = (...parts: number[]): MathJSON => ["NSymH", ["List", ...parts]];
const M = (...parts: number[]): MathJSON => ["QSymM", ["List", ...parts]];
const times = (...parts: MathJSON[]): MathJSON => ["NonCommutativeMultiply", ...parts];

export const hopf: readonly ReferenceEntry[] = [
  {
    name: "QSymM",
    domain: DOMAIN,
    signature: "QSymM(composition)",
    summary:
      "The monomial basis $M_\\alpha$ of the quasi-symmetric functions, indexed by a composition. The product is the quasi-shuffle, which may ADD two leading parts as well as interleave them.",
    signatures: [
      {
        call: "QSymM([1,2])",
        description: "$M_\\alpha$ for the composition $\\alpha$",
        library: "enumeratio-hopf",
      },
      {
        call: "NSymH([1,2])",
        description: "the complete basis $H_\\alpha$ of NSym, whose product is concatenation",
        library: "enumeratio-hopf",
      },
    ],
    details: [
      "$M_1 \\cdot M_1 = 2M_{1,1} + M_2$ — the $M_2$ term is the overlap, and it is what makes this a QUASI-shuffle rather than an ordinary shuffle",
      "QSym is commutative; NSym is not, which is what its name records",
      "Both are graded with $2^{n-1}$ basis elements in degree $n$ — one per composition of $n$",
      "The two share an index set but are different algebras: mixing $H_\\alpha$ and $M_\\alpha$ in one product is refused",
      "Use the ordered product ([[NonCommutativeMultiply]] or $\\otimes$); see [[Coproduct]] for the other half of the structure",
    ],
    examples: [
      {
        expr: times(M(1), M(1)),
        expected: ["Add", ["Multiply", 2, M(1, 1)], M(2)],
        caption: "the quasi-shuffle, overlap term included",
      },
      {
        expr: times(M(1), M(2)),
        expected: ["Add", M(3), M(1, 2), M(2, 1)],
        caption: "two interleavings and one overlap",
      },
      {
        expr: times(H(2), H(1, 3)),
        expected: H(2, 1, 3),
        caption: "NSym just concatenates",
        category: "Scope",
      },
      {
        expr: ["AlgebraDimension", ["QSymAlgebra", 5]],
        expected: 16,
        caption: "$2^4$ compositions of 5",
        category: "Properties",
      },
    ],
    seeAlso: ["Coproduct", "Antipode", "Basis"],
  },
  {
    name: "Coproduct",
    domain: DOMAIN,
    signature: "Coproduct(element)",
    summary:
      "The coproduct $\\Delta$: takes one element to a sum of `HopfTensor` pairs. Deconcatenation for QSym; the multiplicative extension of splitting a part for NSym.",
    signatures: [
      {
        call: "Coproduct(element)",
        description: "$\\Delta(x)$, as a sum of tensor pairs",
        library: "enumeratio-hopf",
      },
    ],
    details: [
      "This is what makes these Hopf algebras rather than merely algebras — the product puts things together, the coproduct pulls them apart",
      "The two are tied by the bialgebra axiom $\\Delta(xy) = \\Delta(x)\\Delta(y)$, checked across every pair of basis elements up to degree 3 in both algebras",
      "Both coproducts are coassociative",
      "Tensor pairs use `HopfTensor(left, right)`, NOT `CircleTimes` — that head is already the shared ordered product",
      "Graded: the two halves' degrees sum to the degree of the input",
    ],
    examples: [
      {
        expr: ["Coproduct", M(1, 2)],
        expected: [
          "Add",
          ["HopfTensor", M(), M(1, 2)],
          ["HopfTensor", M(1, 2), M()],
          ["HopfTensor", M(1), M(2)],
        ],
        caption: "deconcatenation: cut at each gap",
      },
      {
        expr: ["Coproduct", H(2)],
        expected: [
          "Add",
          ["HopfTensor", H(), H(2)],
          ["HopfTensor", H(2), H()],
          ["HopfTensor", H(1), H(1)],
        ],
        caption: "$\\Delta(H_2) = 1\\otimes H_2 + H_1\\otimes H_1 + H_2\\otimes 1$",
      },
      {
        expr: ["Counit", H()],
        expected: 1,
        caption: "the counit picks out the constant term",
        category: "Properties",
      },
    ],
    seeAlso: ["QSymM", "Antipode", "Counit"],
  },
  {
    name: "Antipode",
    domain: DOMAIN,
    signature: "Antipode(element)",
    summary:
      "The antipode $S$, the last piece of a Hopf algebra: the unique map with $m(S \\otimes \\mathrm{id})\\Delta = \\eta\\varepsilon$.",
    signatures: [
      {
        call: "Antipode(element)",
        description: "$S(x)$",
        library: "enumeratio-hopf",
      },
    ],
    details: [
      "On a graded connected Hopf algebra the axiom DETERMINES $S$: splitting off the two trivial terms of $\\Delta$ gives $S(x) = -x - \\sum S(x')x''$, and the left factor's degree strictly drops, so the recursion terminates",
      "Computed that way and then verified by running the axiom, rather than trusted",
      "On a commutative Hopf algebra $S$ is an involution, so $S^2 = \\mathrm{id}$ on QSym",
    ],
    examples: [
      { expr: ["Antipode", M(1)], expected: ["Negate", M(1)], caption: "$S(M_1) = -M_1$" },
      {
        expr: ["Antipode", ["Antipode", M(1, 2)]],
        expected: M(1, 2),
        caption: "$S^2 = \\mathrm{id}$, since QSym is commutative",
        category: "Properties",
      },
      {
        expr: ["HopfDegree", times(M(1), M(2))],
        expected: 3,
        caption: "the product is homogeneous, so degrees add",
        category: "Properties",
      },
    ],
    seeAlso: ["Coproduct", "QSymM"],
  },
  {
    name: "NSymR",
    domain: "Combinatorial Hopf algebras",
    signature: "NSymR(composition)",
    summary:
      "The ribbon basis of NSym, and the fundamental basis `QSymF` of QSym. A composition of $n$ is a subset of $\\{1,\\ldots,n-1\\}$, so the compositions form a Boolean lattice; these bases come from summing over it and inverting.",
    signatures: [
      {
        call: "NSymR(composition)",
        description: "a ribbon basis element of NSym",
        library: "enumeratio-hopf",
      },
      {
        call: "QSymF(composition)",
        description: "a fundamental basis element of QSym",
        library: "enumeratio-hopf",
      },
      {
        call: "InCompleteBasis(x) / InRibbonBasis(x)",
        description: "change of basis within NSym",
        library: "enumeratio-hopf",
      },
      {
        call: "InMonomialBasis(x) / InFundamentalBasis(x)",
        description: "change of basis within QSym",
        library: "enumeratio-hopf",
      },
      {
        call: "ConjugateComposition(composition)",
        description: "the transpose of the ribbon's skew shape",
        library: "enumeratio-hopf",
      },
    ],
    details: [
      "$H_\\alpha = \\sum_{\\beta \\text{ coarsens } \\alpha} R_\\beta$, and the inverse carries the sign $(-1)^{\\ell(\\alpha)-\\ell(\\beta)}$ — Möbius inversion over the Boolean lattice",
      "$F_\\alpha = \\sum_{\\beta \\text{ refines } \\alpha} M_\\beta$ — the OPPOSITE direction, because NSym and QSym are dual with $H$ dual to $M$ and $R$ dual to $F$",
      "$\\langle R_\\alpha, F_\\beta\\rangle = \\delta_{\\alpha\\beta}$, which holds only if both transition matrices are right; they are written down separately",
      "The ribbon product has two terms: $R_\\alpha R_\\beta = R_{\\alpha\\cdot\\beta} + R_{\\alpha\\triangleright\\beta}$, for concatenation and near-concatenation",
      "The ribbon antipode has ONE term: $S(R_\\alpha) = (-1)^{|\\alpha|}R_{\\alpha^{*}}$ — against an alternating sum over all coarsenings in the $H$ basis",
      "Products, coproducts and antipodes answer in the basis they were asked in; the two algebras still refuse to mix",
    ],
    examples: [
      {
        expr: ["InCompleteBasis", ["NSymR", ["List", 1, 1]]],
        // Canonical Add order leads with the negated term.
        expected: ["Add", ["Negate", ["NSymH", ["List", 2]]], ["NSymH", ["List", 1, 1]]],
        caption: "$R_{(1,1)} = H_{(1,1)} - H_{(2)}$",
      },
      {
        expr: ["InMonomialBasis", ["QSymF", ["List", 2]]],
        expected: ["Add", ["QSymM", ["List", 2]], ["QSymM", ["List", 1, 1]]],
        caption: "the fundamental basis sums over refinements",
      },
      {
        expr: ["Antipode", ["NSymR", ["List", 3]]],
        expected: ["Negate", ["NSymR", ["List", 1, 1, 1]]],
        caption: "one signed term",
        category: "Properties",
      },
      {
        expr: ["ConjugateComposition", ["List", 2, 1]],
        expected: ["List", 2, 1],
        caption: "self-conjugate — the convention is settled by the antipode, not by taste",
        category: "Possible issues",
      },
    ],
    seeAlso: ["Coproduct", "Antipode"],
  },
];
