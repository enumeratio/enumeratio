---
name: PermutationAlignments
domain: Permutation statistics
signature: PermutationAlignments(p)
summary: Pairs i, j of arcs of the permutation diagram that align.
catalog:
  - system: findstat
    identity: St000222
    url: https://www.findstat.org/St000222
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: PermutationAlignments(p)
    description: Pairs i, j of arcs of the permutation diagram that align.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
