---
name: DescentWeightMinusInversions
domain: Permutation statistics
signature: DescentWeightMinusInversions(p)
summary: The sum of i(n - i) over the descents i, less the inversions.
catalog:
  - system: findstat
    identity: St001911
    url: https://www.findstat.org/St001911
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: DescentWeightMinusInversions(p)
    description: The sum of i(n - i) over the descents i, less the inversions.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
