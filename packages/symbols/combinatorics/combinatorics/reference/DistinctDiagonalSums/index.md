---
name: DistinctDiagonalSums
domain: Permutation statistics
signature: DistinctDiagonalSums(p)
summary: The number of distinct sums along the diagonals of the permutation matrix.
catalog:
  - system: findstat
    identity: St000891
    url: https://www.findstat.org/St000891
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: DistinctDiagonalSums(p)
    description: The number of distinct sums along the diagonals of the permutation matrix.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- The sum along the diagonal k counts the i with p(i) - i = k, empty diagonals included.
