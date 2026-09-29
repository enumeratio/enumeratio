---
name: MatrixRank
domain: Linear algebra
signature: MatrixRank(A)
summary: "The rank of a matrix: the number of linearly independent rows (equivalently, columns)."
signatures:
  - call: MatrixRank(A)
    description: the rank of the matrix `A`.
  - call: MatrixRank(A)
    description: "The rank of a matrix: the number of linearly independent rows (equivalently, columns)."
    library: enumeratio-analytic
    type: (value) -> integer
    overrides: compute-engine
  - call: MatrixRank(A)
    description: "The rank of a matrix: the number of linearly independent rows (equivalently, columns)."
    library: enumeratio-combinatorics
    type: (value) -> integer
    overrides: enumeratio-analytic
names:
  wolframIdentity: true
---

- Written $\operatorname{rank} A$. Row rank equals column rank, so $\operatorname{rank} A = \operatorname{rank} A^\top$.
- A square matrix is invertible exactly when its rank is its size.
- Not the array [[Rank]], which counts dimensions.
