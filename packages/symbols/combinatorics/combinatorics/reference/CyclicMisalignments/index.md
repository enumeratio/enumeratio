---
name: CyclicMisalignments
domain: Permutation statistics
signature: CyclicMisalignments(p)
summary: Pairs (i, j) with i, p(i), j, p(j) in cyclic order.
catalog:
  - system: findstat
    identity: St001536
    url: https://www.findstat.org/St001536
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: CyclicMisalignments(p)
    description: Pairs (i, j) with i, p(i), j, p(j) in cyclic order.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
