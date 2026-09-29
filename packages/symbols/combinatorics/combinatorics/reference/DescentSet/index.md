---
name: DescentSet
domain: Combinatorial maps
signature: DescentSet(Permutation)
summary: The positions where the word falls.
mapOn:
  - Permutation
signatures:
  - call: DescentSet(Permutation)
    description: The positions where the word falls.
    library: enumeratio-combinatorics
    type: (permutation) -> finset
---

- Takes a `Permutation` and returns a `Finset` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- The statistics Descents and MajorIndex are the size and the sum of this set — which is the reduction worth having: a statistic of a map's output rather than a fresh walk.
