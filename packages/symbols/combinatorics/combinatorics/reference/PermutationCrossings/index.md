---
name: PermutationCrossings
domain: Permutation statistics
signature: PermutationCrossings(p)
summary: Pairs i, j with i < j <= p(i) < p(j) or p(i) < p(j) < i < j.
catalog:
  - system: findstat
    identity: St000039
    url: https://www.findstat.org/St000039
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: PermutationCrossings(p)
    description: Pairs i, j with i < j <= p(i) < p(j) or p(i) < p(j) < i < j.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Crossings of the arcs of the permutation diagram (Corteel); set partitions have Crossings.
