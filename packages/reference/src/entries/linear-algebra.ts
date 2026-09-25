import type { ReferenceEntry } from "../types.ts";

// Every `expected` was produced by evaluating `expr` with compute-engine 0.128.0
// (the reference tests re-evaluate and pin it). See sibling domain files.

const LIBRARY = "@enumeratio/analytic";

const singular = ["List", ["List", 1, 2], ["List", 2, 4]];
const threeByThree = ["List", ["List", 1, 2, 3], ["List", 4, 5, 6], ["List", 7, 8, 9]];
const cube = [
  "List",
  ["List", ["List", 1, 2], ["List", 3, 4]],
  ["List", ["List", 5, 6], ["List", 7, 8]],
];

export const linearAlgebra: readonly ReferenceEntry[] = [
  {
    name: "Rank",
    domain: "Linear algebra",
    signature: "Rank(x)",
    summary:
      "The number of dimensions of an array: 0 for a scalar, 1 for a vector, 2 for a matrix.",
    signatures: [{ call: "Rank(x)", description: "the length of the shape of `x`." }],
    details: [
      "Tensor rank in the array sense — Wolfram's `ArrayDepth`, NumPy's `ndim`.",
      "Not the rank of a matrix (its number of independent rows); that is [[MatrixRank]].",
    ],
    examples: [
      {
        id: "rank-5",
        expr: ["Rank", 5],
        expected: 0,
      },
      {
        id: "rank-list-1-2-3",
        expr: ["Rank", ["List", 1, 2, 3]],
        expected: 1,
      },
      {
        id: "rank-list-list-1-0-list-0-1",
        expr: ["Rank", ["List", ["List", 1, 0], ["List", 0, 1]]],
        expected: 2,
      },
      {
        id: "rank-list-list-list-1-2-list-3-4-list-list-5-6",
        expr: ["Rank", cube],
        expected: 3,
      },
      {
        id: "the-length-of-the-array-s-shape",
        expr: ["Equal", ["Rank", cube], ["Length", ["Shape", cube]]],
        expected: "True",
        category: "Properties",
        caption: "The length of the array's shape",
      },
      {
        id: "a-singular-2-2-matrix-still-has-rank-2-its",
        expr: ["Rank", singular],
        expected: 2,
        category: "Possible issues",
        caption: "A singular 2×2 matrix still has Rank 2; its [[MatrixRank]] is 1",
      },
      {
        id: "symbolic-entries",
        expr: ["Rank", ["List", ["List", "a", "b"], ["List", "c", "d"]]],
        expected: 2,
        caption: "Symbolic entries",
      },
      {
        id: "a-symbol-is-a-scalar",
        expr: ["Rank", "x"],
        expected: 0,
        caption: "A symbol is a scalar",
      },
      {
        id: "rectangular-arrays",
        expr: ["Rank", ["List", ["List", 1, 2, 3], ["List", 4, 5, 6]]],
        expected: 2,
        category: "Scope",
        caption: "Rectangular arrays",
      },
      {
        id: "rank-identitymatrix-3",
        expr: ["Rank", ["IdentityMatrix", 3]],
        expected: 2,
        category: "Scope",
      },
      {
        id: "a-ragged-list-has-depth-1-only-its-outer-level",
        expr: ["Rank", ["List", ["List", 1, 2], ["List", 3]]],
        expected: 1,
        category: "Scope",
        caption: "A ragged list has depth 1 -- only its outer level is a full array",
      },
      {
        id: "likewise-a-list-mixing-scalars-and-lists",
        expr: ["Rank", ["List", 1, ["List", 2, 3]]],
        expected: 1,
        category: "Scope",
        caption: "...likewise a list mixing scalars and lists",
      },
      {
        id: "the-empty-list-is-still-a-vector-of-length-0",
        expr: ["Rank", ["List"]],
        expected: 1,
        category: "Scope",
        caption: "The empty list is still a vector, of length 0",
      },
      {
        id: "and-a-1-0-matrix",
        expr: ["Rank", ["List", ["List"]]],
        expected: 2,
        category: "Scope",
        caption: "...and $\\{\\{\\}\\}$ a 1×0 matrix",
      },
      {
        id: "a-2-3-grid-of-unevaluated-calls-still-reads-as-a",
        expr: ["Rank", ["Tabulate", "f", 2, 3]],
        expected: 2,
        category: "Scope",
        caption:
          "A 2×3 grid of unevaluated calls still reads as a matrix, from its dimensions alone",
      },
    ],
  },
  {
    name: "MatrixRank",
    domain: "Linear algebra",
    signature: "MatrixRank(A)",
    summary:
      "The rank of a matrix: the number of linearly independent rows (equivalently, columns).",
    signatures: [{ call: "MatrixRank(A)", description: "the rank of the matrix `A`." }],
    details: [
      "Written $\\operatorname{rank} A$. Row rank equals column rank, so $\\operatorname{rank} A = \\operatorname{rank} A^\\top$.",
      "A square matrix is invertible exactly when its rank is its size.",
      "Not the array [[Rank]], which counts dimensions.",
    ],
    examples: [
      {
        id: "matrixrank-list-list-1-0-list-0-1",
        expr: ["MatrixRank", ["List", ["List", 1, 0], ["List", 0, 1]]],
        expected: 2,
      },
      {
        id: "matrixrank-list-list-1-2-list-2-4",
        expr: ["MatrixRank", singular],
        expected: 1,
      },
      {
        id: "matrixrank-list-list-1-2-3-list-4-5-6-list-7-8-9",
        expr: ["MatrixRank", threeByThree],
        expected: 2,
      },
      {
        id: "non-square-matrices-too",
        expr: ["MatrixRank", ["List", ["List", 1, 2, 3], ["List", 2, 4, 6]]],
        expected: 1,
        caption: "Non-square matrices too",
      },
      {
        id: "matrixrank-list-list-0-0-list-0-0",
        expr: ["MatrixRank", ["List", ["List", 0, 0], ["List", 0, 0]]],
        expected: 0,
      },
      {
        id: "row-rank-equals-column-rank",
        expr: ["Equal", ["MatrixRank", threeByThree], ["MatrixRank", ["Transpose", threeByThree]]],
        expected: "True",
        category: "Properties",
        caption: "Row rank equals column rank",
      },
      {
        id: "a-symbolic-matrix-stays-unevaluated-wolfram",
        expr: ["MatrixRank", ["List", ["List", "x", 1], ["List", 1, "x"]]],
        expected: ["MatrixRank", ["List", ["List", "x", 1], ["List", 1, "x"]]],
        category: "Possible issues",
        caption: "A symbolic matrix stays unevaluated (Wolfram answers the generic rank, 2)",
      },
      {
        id: "a-vector-is-treated-as-a-1-n-matrix-wolfram",
        expr: ["MatrixRank", ["List", 1, 2, 3]],
        expected: 1,
        category: "Possible issues",
        caption: "A vector is treated as a 1×n matrix (Wolfram rejects it)",
        divergence: {
          wolfram: "Wolfram leaves `MatrixRank[{1, 2, 3}]` unevaluated: a vector is not a matrix.",
        },
      },
      {
        id: "a-matrix-of-pairwise-distinct-symbols-has-full",
        expr: ["MatrixRank", ["List", ["List", "a", "b"], ["List", "c", "d"]]],
        expected: 2,
        caption:
          "A matrix of pairwise-distinct symbols has full rank -- its determinant, as a polynomial in independent indeterminates, can never be identically zero",
      },
      {
        id: "approximate-entries",
        expr: ["MatrixRank", ["List", ["List", 1, 2.5], ["List", 3.5, 4]]],
        expected: 2,
        category: "Scope",
        caption: "Approximate entries",
      },
      {
        id: "complex-entries-the-second-row-is-i-times-the",
        expr: ["MatrixRank", ["List", ["List", 1, "ImaginaryUnit"], ["List", "ImaginaryUnit", -1]]],
        expected: 1,
        category: "Scope",
        caption: "Complex entries: the second row is $i$ times the first",
      },
      {
        id: "exact-numeric-entries",
        expr: [
          "MatrixRank",
          [
            "List",
            ["List", "Pi", "ExponentialE"],
            ["List", ["Multiply", 2, "Pi"], ["Multiply", 2, "ExponentialE"]],
          ],
        ],
        expected: 1,
        category: "Scope",
        caption: "Exact numeric entries",
      },
      {
        id: "the-second-row-is-sqrt-2-times-the-first",
        expr: ["MatrixRank", ["List", ["List", ["Sqrt", 2], 1], ["List", 2, ["Sqrt", 2]]]],
        expected: 1,
        category: "Scope",
        caption: "The second row is $\\sqrt{2}$ times the first",
      },
      {
        id: "a-3-4-matrix-with-one-dependent-row",
        expr: [
          "MatrixRank",
          ["List", ["List", 1, 2, 3, 4], ["List", 2, 4, 6, 8], ["List", 1, 0, 1, 0]],
        ],
        expected: 2,
        category: "Scope",
        caption: "A 3×4 matrix with one dependent row",
      },
      {
        id: "matrixrank-identitymatrix-5",
        expr: ["MatrixRank", ["IdentityMatrix", 5]],
        expected: 5,
        category: "Scope",
      },
      {
        id: "rank-nullity-the-rank-plus-the-dimension-of-the",
        expr: ["Add", ["MatrixRank", threeByThree], ["Length", ["Kernel", threeByThree]]],
        expected: 3,
        category: "Properties",
        caption:
          "Rank–nullity: the rank plus the dimension of the null space is the number of columns",
      },
      {
        id: "an-outer-product-u-v-top-has-rank-1-a-lazy",
        expr: ["MatrixRank", ["Tabulate", "Multiply", 4, 4]],
        expected: 1,
        category: "Properties",
        caption:
          "An outer product $u v^\\top$ has rank 1; a lazy [[Tabulate]] matrix is read as the matrix it describes",
      },
      {
        id: "the-4-4-hilbert-matrix-is-badly-conditioned-but",
        expr: [
          "MatrixRank",
          ["Tabulate", ["Function", ["Divide", 1, ["Subtract", ["Add", "_1", "_2"], 1]]], 4, 4],
        ],
        expected: 4,
        category: "Applications",
        caption: "The 4×4 Hilbert matrix is badly conditioned but invertible",
      },
      {
        id: "every-matrix-with-entries-i-j-has-rank-2",
        expr: ["MatrixRank", ["Tabulate", "Add", 4, 4]],
        expected: 2,
        category: "Neat examples",
        caption: "Every matrix with entries $i + j$ has rank 2, whatever its size",
      },
      {
        id: "a-3-times-3-matrix-of-pairwise-distinct-symbols",
        expr: [
          "MatrixRank",
          ["List", ["List", "p", "q", "r"], ["List", "s", "t", "u"], ["List", "v", "w", "x"]],
        ],
        expected: 3,
        category: "Scope",
        caption:
          "A $3\\times3$ matrix of pairwise-distinct symbols is full rank — the determinant, as a polynomial in independent indeterminates, can't be identically zero.",
      },
    ],
  },
  {
    name: "MatrixExp",
    domain: "Linear algebra",
    signature: "MatrixExp(A)",
    summary: "The matrix exponential $e^A = \\sum_{k \\ge 0} A^k / k!$, for a square matrix A.",
    signatures: [
      {
        call: "MatrixExp(A)",
        description: "the matrix exponential of the square matrix `A`.",
        library: LIBRARY,
      },
      {
        call: "MatrixExp(A, v)",
        description: "$e^A v$: `A`'s matrix exponential applied to the vector `v`.",
        library: LIBRARY,
      },
    ],
    details: [
      "NOT [[Exp]] of a matrix, which broadcasts element-wise instead -- see that entry's divergence note.",
      "Exact where the structure gives one: a diagonal A reduces to elementwise Exp on the diagonal; a 2×2 A reduces to a closed form in Cosh, Sinh and Sqrt of its trace and determinant (which also covers every 2×2 nilpotent and repeated-eigenvalue case, and -- written to recognize a provably negative discriminant -- every 2×2 rotation generator, in Cos and Sin instead); a nilpotent A of any size, with exact entries, reduces to its truncated Taylor series.",
      "Otherwise numeric only, produced under N(): scaling-and-squaring, in double precision.",
      "Rejects a non-square argument, same as [[MatrixRank]]'s siblings [[Inverse]], [[MatrixPower]], and [[Determinant]].",
      "MatrixExp(A, v) computes $e^A$ first (via whichever path above applies) and multiplies by `v`; it is not a matrix-free method, just a shorter call.",
    ],
    examples: [
      {
        id: "the-2-2-closed-form-exact-not-decimalized",
        expr: ["MatrixExp", ["List", ["List", 0, 1], ["List", 1, 0]]],
        expected: ["List", ["List", ["Cosh", 1], ["Sinh", 1]], ["List", ["Sinh", 1], ["Cosh", 1]]],
        caption: "The 2×2 closed form -- exact, not decimalized",
      },
      {
        id: "a-nilpotent-matrix-i-a-since-a-2-0",
        expr: ["MatrixExp", ["List", ["List", 0, 1], ["List", 0, 0]]],
        expected: ["List", ["List", 1, 1], ["List", 0, 1]],
        category: "Scope",
        caption: "A nilpotent matrix: $I + A$, since $A^2 = 0$",
      },
      {
        id: "a-diagonal-matrix-exp-of-each-diagonal-entry",
        expr: ["MatrixExp", ["List", ["List", 1, 0, 0], ["List", 0, 2, 0], ["List", 0, 0, 3]]],
        expected: [
          "List",
          ["List", "ExponentialE", 0, 0],
          ["List", 0, ["Power", "ExponentialE", 2], 0],
          ["List", 0, 0, ["Power", "ExponentialE", 3]],
        ],
        category: "Scope",
        caption: "A diagonal matrix: exp of each diagonal entry",
      },
      {
        id: "a-3-3-matrix-with-no-diagonal-nilpotent-or-2-2",
        expr: [
          "N",
          ["MatrixExp", ["List", ["List", 1, 2, 3], ["List", 4, 5, 6], ["List", 7, 8, 10]]],
        ],
        expected: [
          "List",
          ["List", 1892793.8019664665, 2319804.34843383, 2921688.7942849034],
          ["List", 4267596.877957099, 5230361.132647167, 6587401.226390927],
          ["List", 7065281.732605146, 8659197.695551049, 10905868.064094879],
        ],
        category: "Scope",
        caption:
          "A 3×3 matrix with no diagonal, nilpotent, or 2×2 structure to exploit: numeric only, via scaling-and-squaring",
      },
      {
        id: "the-exponential-of-the-zero-matrix-is-the",
        expr: ["MatrixExp", ["List", ["List", 0, 0], ["List", 0, 0]]],
        expected: ["List", ["List", 1, 0], ["List", 0, 1]],
        caption: "The exponential of the zero matrix is the identity",
      },
      {
        id: "a-diagonal-matrix-exponentiates-entry-by-entry",
        expr: ["MatrixExp", ["List", ["List", 1, 0], ["List", 0, 2]]],
        expected: ["List", ["List", "ExponentialE", 0], ["List", 0, ["Power", "ExponentialE", 2]]],
        caption: "A diagonal matrix exponentiates entry by entry",
      },
      {
        id: "a-jordan-block-e-i-n-e-i-n",
        expr: ["MatrixExp", ["List", ["List", 1, 1], ["List", 0, 1]]],
        expected: ["List", ["List", "ExponentialE", "ExponentialE"], ["List", 0, "ExponentialE"]],
        category: "Scope",
        caption: "A Jordan block: $e^{I + N} = e\\,(I + N)$",
      },
      {
        id: "a-skew-symmetric-generator-gives-a-rotation",
        expr: ["MatrixExp", ["List", ["List", 0, 1], ["List", -1, 0]]],
        expected: [
          "List",
          ["List", ["Cos", 1], ["Sin", 1]],
          ["List", ["Negate", ["Sin", 1]], ["Cos", 1]],
        ],
        category: "Applications",
        caption:
          "A skew-symmetric generator gives a rotation matrix: the 2×2 closed form recognizes its purely imaginary eigenvalues and reduces straight to $\\cos 1$ and $\\sin 1$, not $\\cosh i$ and $\\sinh i$",
      },
      {
        id: "euler-s-identity-for-matrices-rotation-by-pi-is",
        expr: ["MatrixExp", ["List", ["List", 0, ["Negate", "Pi"]], ["List", "Pi", 0]]],
        expected: ["List", ["List", -1, 0], ["List", 0, -1]],
        category: "Neat examples",
        caption: "Euler's identity for matrices: rotation by $\\pi$ is $-I$",
      },
      {
        id: "applied-to-a-vector-e-a-v-computed-as-e-a-via",
        expr: ["MatrixExp", ["List", ["List", 0, 1], ["List", 0, 0]], ["List", 1, 1]],
        expected: ["List", 2, 1],
        category: "Scope",
        caption:
          "Applied to a vector, $e^A v$: computed as $e^A$ (via whichever closed form applies) times $v$, not a matrix-free method",
      },
      {
        id: "rejects-a-non-square-argument",
        expr: ["MatrixExp", ["List", ["List", 1, 2, 3], ["List", 4, 5, 6]]],
        expected: ["Error", "'expected-square-matrix'", "'[[1,2,3],[4,5,6]]'"],
        category: "Possible issues",
        caption: "Rejects a non-square argument",
      },
      {
        id: "a-3-times-3-nilpotent-generator-the-exponential",
        expr: ["MatrixExp", ["List", ["List", 0, 1, 0], ["List", 0, 0, 1], ["List", 0, 0, 0]]],
        expected: [
          "List",
          ["List", 1, 1, ["Rational", 1, 2]],
          ["List", 0, 1, 1],
          ["List", 0, 0, 1],
        ],
        category: "Scope",
        caption:
          "A $3\\times3$ nilpotent generator: the exponential series truncates exactly, past the $2\\times2$ case.",
      },
      {
        id: "a-jordan-block-repeated-eigenvalue-2-e-2-i-n-not",
        expr: ["MatrixExp", ["List", ["List", 2, 1], ["List", 0, 2]]],
        expected: [
          "List",
          ["List", ["Power", "ExponentialE", 2], ["Power", "ExponentialE", 2]],
          ["List", 0, ["Power", "ExponentialE", 2]],
        ],
        category: "Scope",
        caption:
          "A Jordan block (repeated eigenvalue 2): $e^{2}(I+N)$, not a diagonal exponential.",
      },
      {
        id: "a-generic-matrix-with-no-closed-form-stays",
        expr: ["MatrixExp", ["List", ["List", 1, 2, 3], ["List", 4, 5, 6], ["List", 7, 8, 10]]],
        expected: ["MatrixExp", ["List", ["List", 1, 2, 3], ["List", 4, 5, 6], ["List", 7, 8, 10]]],
        category: "Possible issues",
        caption:
          "A generic matrix with no closed form stays symbolic without `N()` — use `N(MatrixExp(...))` for a numeric answer.",
      },
    ],
    seeAlso: ["Exp", "MatrixPower", "Inverse", "Determinant"],
  },
];
