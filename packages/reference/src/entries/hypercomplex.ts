import type { ReferenceEntry } from "../types.ts";

// Reference entries for the heads @enumeratio/hypercomplex adds. The unit
// GENERATORS need no entry of their own -- they are ordinary subscripted symbols
// (`i_1`, `f_2`, `\theta_1`), documented under the heads that act on them and in
// /guide/hypercomplex. What is documented here is the algebra: the ordered
// product, the norm, the algebra constructors and their accessors, and the two
// modular-arithmetic heads that say where these units already live.

const DOMAIN = "Hypercomplex algebra";

export const hypercomplex: readonly ReferenceEntry[] = [
  {
    name: "NonCommutativeMultiply",
    domain: DOMAIN,
    signature: "NonCommutativeMultiply(a, b, …)",
    summary:
      "The ordered product, for units that anticommute. $\\times$ cannot host one: `Multiply` is declared commutative, so canonicalisation sorts its operands before any handler runs and the sign is lost.",
    signatures: [
      {
        call: "NonCommutativeMultiply(a, b, …)",
        description: "the product of the operands, in the order written",
        library: "enumeratio-hypercomplex",
      },
      {
        call: "GeometricProduct(a, b, …)",
        description: "alias, for the geometric-algebra reading",
        library: "enumeratio-hypercomplex",
      },
      {
        call: "a \\otimes b",
        description: "infix alias ($\\otimes$)",
        library: "enumeratio-hypercomplex",
      },
    ],
    details: [
      "Wolfram spells this head the same way (infix `**`), keeping it apart from `Times`; matrix multiplication is likewise its own head, `Dot`",
      "On the COMMUTING families it simply agrees with $\\times$, so it is safe to use everywhere",
      "A tensor product of two scalars is their product, so $2 \\otimes 3$ is $6$",
      "Associative across mixed families: the commutation factor $\\varepsilon(g,h) = (-1)^{\\mathrm{anti}(g)\\mathrm{anti}(h)}$ is a bicharacter",
      "Juxtaposition carries the sign on its own -- $e_2e_1$ is caught before `Multiply`'s commutative sort can reach it",
      "An explicit $\\times$ or $\\cdot$ is not: it parses straight to a sorted `Multiply`, so it REFUSES two distinct anticommuting units rather than assert a sign it cannot justify",
    ],
    examples: [
      {
        id: "the-canonical-order",
        expr: ["NonCommutativeMultiply", "e_1", "e_2"],
        expected: ["Multiply", "e_1", "e_2"],
        caption: "the canonical order",
      },
      {
        id: "reversing-the-operands-flips-the-sign",
        expr: ["NonCommutativeMultiply", "e_2", "e_1"],
        expected: ["Negate", ["Multiply", "e_1", "e_2"]],
        caption: "reversing the operands flips the sign",
        category: "Properties",
      },
      {
        id: "e-1e-2-2-1",
        expr: ["NonCommutativeMultiply", "e_1", "e_2", "e_1", "e_2"],
        expected: -1,
        caption: "$(e_1e_2)^2 = -1$",
        category: "Properties",
      },
      {
        id: "scalars-the-implied-identity-factor",
        expr: ["CircleTimes", 2, 3],
        expected: 6,
        caption: "scalars: the implied identity factor",
        category: "Scope",
        divergence: {
          wolfram:
            "Our CircleTimes commits to a concrete algebra where scalars multiply as usual; Wolfram's builtin CircleTimes is inert notation with no arithmetic rules, so it leaves $2\\otimes3$ displayed rather than reduced to 6.",
        },
      },
      {
        id: "commuting-units-agrees-with-times",
        expr: ["CircleTimes", "i_2", "i_1"],
        expected: ["Multiply", "i_1", "i_2"],
        caption: "commuting units: agrees with $\\times$",
        category: "Scope",
      },
      {
        id: "plain-times-declines-both-orders-arrive",
        expr: ["Multiply", "e_2", "e_1"],
        expected: ["Multiply", "e_1", "e_2"],
        caption: "plain $\\times$ declines: both orders arrive identical",
        category: "Possible issues",
      },
      {
        id: "the-quaternion-product-1-2i-3j-4k-2-i-j-3k-13",
        expr: [
          "NonCommutativeMultiply",
          ["Add", 1, ["Multiply", 2, "f_1"], ["Multiply", 3, "f_2"], ["Multiply", 4, "f_1", "f_2"]],
          ["Add", 2, ["Negate", "f_1"], "f_2", ["Multiply", -3, "f_1", "f_2"]],
        ],
        expected: [
          "Add",
          ["Multiply", 10, "f_1", "f_2"],
          ["Multiply", -10, "f_1"],
          ["Multiply", 9, "f_2"],
          13,
        ],
        caption:
          "the quaternion product $(1+2i+3j+4k)(2-i+j-3k) = 13-10i+9j+10k$, with $i = f_1$, $j = f_2$, $k = f_1f_2$",
        category: "Applications",
      },
      {
        id: "associative-nested-products-flatten",
        expr: ["NonCommutativeMultiply", "a", ["NonCommutativeMultiply", "b", "c"]],
        expected: ["Multiply", "a", "b", "c"],
        caption: "associative: nested products flatten",
        category: "Properties",
        divergence: {
          wolfram:
            "Wolfram flattens too but has no rules for undeclared symbols, so it keeps a**b**c unevaluated.",
        },
      },
      {
        id: "undeclared-symbols-are-taken-to-commute-so-the",
        expr: ["NonCommutativeMultiply", "b", "a"],
        expected: ["Multiply", "a", "b"],
        caption: "undeclared symbols are taken to commute, so the order is not kept",
        category: "Possible issues",
        divergence: {
          wolfram:
            "Wolfram assumes nothing about undeclared symbols and leaves b**a unevaluated, in its order.",
        },
      },
    ],
    seeAlso: ["Norm", "Basis", "Quaternions"],
  },
  {
    name: "Norm",
    domain: DOMAIN,
    signature: "Norm(z)",
    summary:
      "The algebra norm of a hypercomplex element: the determinant of multiplication-by-$z$ on the $2^n$-dimensional space. Reduces to the Gaussian $a^2+b^2$ at one imaginary unit.",
    signatures: [
      {
        call: "Norm(z)",
        description: "the determinant of the multiplication-by-$z$ map",
        library: "enumeratio-hypercomplex",
      },
    ],
    details: [
      "Computed through the tower $A = B[x]/(x^2-\\varepsilon)$: for $z = u + xv$, $N(z) = N_B(u^2 - \\varepsilon v^2)$, bottoming out at a scalar",
      "NOT $z\\,\\overline{z}$ — the signature is mixed, and at $\\mathbb{C}_2$ that product keeps a live $i_1i_2$ part",
      "Multiplicative on a FIXED unit set; the norm is taken over the subalgebra generated by the units occurring in $z$, and adjoining a generator squares it",
      "$z$ is invertible exactly when its norm is; a norm of $0$ marks a zero divisor",
      "Left symbolic for the anticommuting families, whose norm is a different object",
    ],
    examples: [
      {
        id: "3-2-4-2-the-gaussian-norm",
        expr: ["Norm", ["Add", 3, ["Multiply", 4, "i_1"]]],
        expected: 25,
        caption: "$3^2+4^2$ — the Gaussian norm",
      },
      {
        id: "the-4-times-4-multiplication-determinant",
        expr: ["Norm", ["Add", 1, ["Multiply", 2, "i_1"], ["Multiply", 3, "i_1", "i_2"]]],
        expected: 160,
        caption: "the $4\\times 4$ multiplication determinant",
      },
      {
        id: "split-units-give-a-2-b-2-which-is-indefinite",
        expr: ["Norm", ["Add", 3, ["Multiply", 4, "j_1"]]],
        expected: -7,
        caption: "split units give $a^2-b^2$, which is indefinite",
        category: "Properties",
      },
      {
        id: "a-zero-divisor",
        expr: ["Norm", ["Add", 1, ["Multiply", "i_1", "i_2"]]],
        expected: 0,
        caption: "a zero divisor",
        category: "Properties",
      },
      {
        id: "each-factor-has-norm-2-over-c-1-but-4-over-c-2",
        expr: ["Norm", ["Multiply", ["Add", 1, "i_1"], ["Add", 1, "i_2"]]],
        expected: 16,
        caption: "each factor has norm 2 over $\\mathbb{C}_1$, but 4 over $\\mathbb{C}_2$",
        category: "Possible issues",
      },
    ],
    seeAlso: ["Conjugate", "NonCommutativeMultiply", "Basis"],
  },
  {
    name: "Basis",
    domain: DOMAIN,
    signature: "Basis(algebra)",
    summary:
      "The $2^n$ basis blades of a named algebra, ordered by grade then by generator — so $\\mathbb{H}$ comes back as $(1, i, j, k)$.",
    signatures: [
      {
        call: "Basis(algebra)",
        description: "the basis blades, as a list",
        library: "enumeratio-hypercomplex",
      },
    ],
    details: [
      "An algebra is an ordered list of generators; the families already carry the squares and the commutation rules",
      "Constructors: `CliffordAlgebra(p, q)`, `MulticomplexAlgebra(n)`, `SplitAlgebra(n)`, `DualAlgebra(n)`, `GrassmannAlgebra(n)`",
      "Named: [[Quaternions]] (also $\\mathbb{H}$), `BicomplexNumbers`, `TricomplexNumbers`, `SplitComplexNumbers`, `DualNumbers`",
      "No element constructor is needed — `Dot` threads a tuple of scalars over the basis",
    ],
    examples: [
      {
        id: "1-i-j-k",
        expr: ["Basis", "Quaternions"],
        expected: ["List", 1, "f_1", "f_2", ["Multiply", "f_1", "f_2"]],
        caption: "$(1, i, j, k)$",
      },
      {
        id: "the-bicomplex-basis",
        expr: ["Basis", ["MulticomplexAlgebra", 2]],
        expected: ["List", 1, "i_1", "i_2", ["Multiply", "i_1", "i_2"]],
        caption: "the bicomplex basis",
      },
      {
        id: "an-element-from-a-coefficient-tuple",
        expr: ["Dot", ["List", 1, 2, 3, 4], ["Basis", "Quaternions"]],
        expected: [
          "Add",
          ["Multiply", 4, "f_1", "f_2"],
          ["Multiply", 2, "f_1"],
          ["Multiply", 3, "f_2"],
          1,
        ],
        caption: "an element from a coefficient tuple",
        category: "Applications",
      },
    ],
    seeAlso: ["Quaternions", "AlgebraDimension", "AlgebraSignature"],
  },
  {
    name: "AlgebraSignature",
    domain: DOMAIN,
    signature: "AlgebraSignature(algebra)",
    summary:
      "The signature vector: what each of the algebra's generators squares to, in order — $-1$, $+1$ or $0$.",
    signatures: [
      {
        call: "AlgebraSignature(algebra)",
        description: "each generator's square, as a list",
        library: "enumeratio-hypercomplex",
      },
    ],
    details: [
      "Together with the commutation rule this is all that defines the algebra",
      "$\\mathrm{Cl}(p,q)$ reads as $p$ entries of $+1$ then $q$ of $-1$",
      "A $0$ entry marks a nilpotent generator — the dual and Grassmann families",
    ],
    examples: [
      {
        id: "algebrasignature-quaternions",
        expr: ["AlgebraSignature", "Quaternions"],
        expected: ["List", -1, -1],
      },
      {
        id: "cl-2-1",
        expr: ["AlgebraSignature", ["CliffordAlgebra", 2, 1]],
        expected: ["List", 1, 1, -1],
        caption: "$\\mathrm{Cl}(2,1)$",
      },
      {
        id: "nilpotent",
        expr: ["AlgebraSignature", "DualNumbers"],
        expected: ["List", 0],
        caption: "nilpotent",
        category: "Scope",
      },
    ],
    seeAlso: ["Basis", "AlgebraDimension", "Quaternions", "PowerModList"],
  },
  {
    name: "AlgebraDimension",
    domain: DOMAIN,
    signature: "AlgebraDimension(algebra)",
    summary: "The dimension $2^n$ of an algebra on $n$ generators — the number of basis blades.",
    signatures: [
      {
        call: "AlgebraDimension(algebra)",
        description: "$2^n$ for $n$ generators",
        library: "enumeratio-hypercomplex",
      },
    ],
    details: [
      "Every subset of the generators is one basis blade, so the dimension doubles per generator",
      "A separate head from compute-engine's `Dimension`, which is defined for lists and matrices and is deliberately left alone",
    ],
    examples: [
      {
        id: "algebradimension-quaternions",
        expr: ["AlgebraDimension", "Quaternions"],
        expected: 4,
      },
      {
        id: "algebradimension-cliffordalgebra-2-1",
        expr: ["AlgebraDimension", ["CliffordAlgebra", 2, 1]],
        expected: 8,
      },
      {
        id: "c-4",
        expr: ["AlgebraDimension", ["MulticomplexAlgebra", 4]],
        expected: 16,
        caption: "$\\mathbb{C}_4$",
      },
    ],
    seeAlso: ["Basis", "AlgebraSignature"],
  },
  {
    name: "Quaternions",
    domain: DOMAIN,
    signature: "Quaternions",
    summary:
      "$\\mathbb{H}$, the quaternions — which IS $\\mathrm{Cl}(0,2)$: two anticommuting generators squaring to $-1$, with $k = f_1f_2$ as the third unit.",
    signatures: [
      { call: "Quaternions", description: "$\\mathbb{H}$", library: "enumeratio-hypercomplex" },
      {
        call: "\\mathbb{H}",
        description: "the same algebra, written as a set",
        library: "enumeratio-hypercomplex",
      },
    ],
    details: [
      "$i = f_1$, $j = f_2$, $k = f_1f_2$, and $i^2 = j^2 = k^2 = ijk = -1$",
      "Multiplication is NOT commutative: juxtaposition keeps the order, but an explicit $\\times$ does not -- use [[NonCommutativeMultiply]] (or $\\otimes$) there",
      "Usable as a set: $f_1f_2 \\in \\mathbb{H}$ is true, $f_3 \\in \\mathbb{H}$ is false",
      "The other named algebras are `BicomplexNumbers`, `TricomplexNumbers`, `SplitComplexNumbers` and `DualNumbers`",
    ],
    examples: [
      {
        id: "ijk-1",
        expr: ["NonCommutativeMultiply", "f_1", "f_2", ["Multiply", "f_1", "f_2"]],
        expected: -1,
        caption: "$ijk = -1$",
      },
      {
        id: "k-in-h",
        expr: ["Element", ["Multiply", "f_1", "f_2"], "Quaternions"],
        expected: "True",
        caption: "$k \\in \\mathbb{H}$",
        category: "Properties",
      },
      {
        id: "a-multicomplex-unit-is-not-a-quaternion",
        expr: ["Element", "i_1", "Quaternions"],
        expected: "False",
        caption: "a multicomplex unit is not a quaternion",
        category: "Properties",
      },
    ],
    seeAlso: ["Basis", "NonCommutativeMultiply", "AlgebraSignature"],
  },
];
