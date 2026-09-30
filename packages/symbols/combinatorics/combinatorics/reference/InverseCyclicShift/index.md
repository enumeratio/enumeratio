---
name: InverseCyclicShift
domain: Combinatorial maps
signature: InverseCyclicShift(Permutation)
summary: Rotate the word one place to the right.
mapOn:
  - Permutation
signatures:
  - call: InverseCyclicShift(Permutation)
    description: Rotate the word one place to the right.
    library: enumeratio-combinatorics
    type: (permutation) -> permutation
laws:
  - inverse: CyclicShift
---

- Takes a `Permutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
