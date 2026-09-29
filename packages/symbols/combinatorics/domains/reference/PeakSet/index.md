---
name: PeakSet
domain: Combinatorial maps
signature: PeakSet(Permutation)
summary: The interior positions that rise then fall.
mapOn:
  - Permutation
signatures:
  - call: PeakSet(Permutation)
    description: The interior positions that rise then fall.
    library: enumeratio-domains
    type: (permutation) -> finset
---

- Takes a `Permutation` and returns a `Finset` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Its size is the Peaks statistic, exactly as DescentSet's is Descents.
