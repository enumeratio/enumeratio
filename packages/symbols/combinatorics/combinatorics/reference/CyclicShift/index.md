---
name: CyclicShift
domain: Combinatorial maps
signature: CyclicShift(Permutation)
summary: Rotate the word one place to the left.
mapOn:
  - Permutation
signatures:
  - call: CyclicShift(Permutation)
    description: Rotate the word one place to the left.
    library: enumeratio-combinatorics
    type: (permutation) -> permutation
---

- Takes a `Permutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
