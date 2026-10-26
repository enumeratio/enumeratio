---
name: CyclicallyAdjacentTranspositions
domain: Permutation statistics
signature: CyclicallyAdjacentTranspositions(p)
summary: Two-cycles (i, i+1), and the two-cycle (1, n).
catalog:
  - system: findstat
    identity: St001466
    url: https://www.findstat.org/St001466
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: CyclicallyAdjacentTranspositions(p)
    description: Two-cycles (i, i+1), and the two-cycle (1, n).
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- For n = 2 the one two-cycle is counted once.
