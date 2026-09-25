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
      { expr: ["Rank", 5], expected: 0 },
      { expr: ["Rank", ["List", 1, 2, 3]], expected: 1 },
      { expr: ["Rank", ["List", ["List", 1, 0], ["List", 0, 1]]], expected: 2 },
      { expr: ["Rank", cube], expected: 3 },
      {
        expr: ["Equal", ["Rank", cube], ["Length", ["Shape", cube]]],
        expected: "True",
        category: "Properties",
        caption: "The length of the array's shape",
      },
      {
        expr: ["Rank", singular],
        expected: 2,
        category: "Possible issues",
        caption: "A singular 2×2 matrix still has Rank 2; its [[MatrixRank]] is 1",
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
      { expr: ["MatrixRank", ["List", ["List", 1, 0], ["List", 0, 1]]], expected: 2 },
      { expr: ["MatrixRank", singular], expected: 1 },
      { expr: ["MatrixRank", threeByThree], expected: 2 },
      {
        expr: ["MatrixRank", ["List", ["List", 1, 2, 3], ["List", 2, 4, 6]]],
        expected: 1,
        caption: "Non-square matrices too",
      },
      { expr: ["MatrixRank", ["List", ["List", 0, 0], ["List", 0, 0]]], expected: 0 },
      {
        expr: ["Equal", ["MatrixRank", threeByThree], ["MatrixRank", ["Transpose", threeByThree]]],
        expected: "True",
        category: "Properties",
        caption: "Row rank equals column rank",
      },
      {
        expr: ["MatrixRank", ["List", ["List", "x", 1], ["List", 1, "x"]]],
        expected: ["MatrixRank", ["List", ["List", "x", 1], ["List", 1, "x"]]],
        category: "Possible issues",
        caption: "A symbolic matrix stays unevaluated (Wolfram answers the generic rank, 2)",
      },
      {
        expr: ["MatrixRank", ["List", 1, 2, 3]],
        expected: 1,
        category: "Possible issues",
        caption: "A vector is treated as a 1×n matrix (Wolfram rejects it)",
        divergence: {
          wolfram: "Wolfram leaves `MatrixRank[{1, 2, 3}]` unevaluated: a vector is not a matrix.",
        },
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
    ],
    details: [
      "NOT [[Exp]] of a matrix, which broadcasts element-wise instead -- see that entry's divergence note.",
      "Exact where the structure gives one: a diagonal A reduces to elementwise Exp on the diagonal; a 2×2 A reduces to a closed form in Cosh, Sinh and Sqrt of its trace and determinant (which also covers every 2×2 nilpotent and repeated-eigenvalue case); a nilpotent A of any size, with exact entries, reduces to its truncated Taylor series.",
      "Otherwise numeric only, produced under N(): scaling-and-squaring, in double precision.",
      "Rejects a non-square argument, same as [[MatrixRank]]'s siblings [[Inverse]], [[MatrixPower]], and [[Determinant]].",
    ],
    examples: [
      {
        expr: ["MatrixExp", ["List", ["List", 0, 1], ["List", 1, 0]]],
        expected: ["List", ["List", ["Cosh", 1], ["Sinh", 1]], ["List", ["Sinh", 1], ["Cosh", 1]]],
        caption: "The 2×2 closed form -- exact, not decimalized",
      },
      {
        expr: ["MatrixExp", ["List", ["List", 0, 1], ["List", 0, 0]]],
        expected: ["List", ["List", 1, 1], ["List", 0, 1]],
        category: "Scope",
        caption: "A nilpotent matrix: $I + A$, since $A^2 = 0$",
      },
      {
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
        expr: ["MatrixExp", ["List", ["List", 1, 2, 3], ["List", 4, 5, 6]]],
        expected: ["Error", "'expected-square-matrix'", "'[[1,2,3],[4,5,6]]'"],
        category: "Possible issues",
        caption: "Rejects a non-square argument",
      },
    ],
    seeAlso: ["Exp", "MatrixPower", "Inverse", "Determinant"],
  },
];
