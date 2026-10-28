---
name: CyclicAlignments
domain: Permutation statistics
signature: CyclicAlignments(p)
summary: Pairs (i, j) with i, j, p(j), p(i) in cyclic order.
catalog:
  - system: findstat
    identity: St001535
    url: https://www.findstat.org/St001535
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: CyclicAlignments(p)
    description: Pairs (i, j) with i, j, p(j), p(i) in cyclic order.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
