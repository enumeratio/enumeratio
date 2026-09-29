---
name: LeastUpperBound
domain: Structures
signature: LeastUpperBound(a, b)
summary: "The join of two values in a lattice: the least value at or above both."
signatures:
  - call: LeastUpperBound(a, b)
    description: "The join of two values in a lattice: the least value at or above both."
    library: enumeratio-structures
    type: (any, any) -> unknown
seeAlso:
  - GreatestLowerBound
  - Max
  - Compare
---

- The `Lattice` protocol's member, and what `Max` folds when its arguments' type is a lattice.
