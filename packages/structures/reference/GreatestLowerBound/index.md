---
name: GreatestLowerBound
domain: Structures
signature: GreatestLowerBound(a, b)
summary: "The meet of two values in a lattice: the greatest value at or below both."
signatures:
  - call: GreatestLowerBound(a, b)
    description: "The meet of two values in a lattice: the greatest value at or below both."
    library: enumeratio-structures
    type: (any, any) -> unknown
seeAlso:
  - LeastUpperBound
  - Min
  - Compare
---

- The `Lattice` protocol's member, and what `Min` folds when its arguments' type is a lattice.
- In a linear order it is the smaller of the two; under dominance it takes the partial sums' pointwise minimum.
