import type { ReferenceEntry } from "../types.ts";

// Every `expected` was produced by evaluating `expr` with compute-engine 0.128.0
// (the reference tests re-evaluate and pin it). See sibling domain files.

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
];
