---
name: NontrivialCycles
domain: Permutation statistics
signature: NontrivialCycles(p)
summary: "Cycles of size at least two: the cycles less the fixed points."
catalog:
  - system: findstat
    identity: St000162
    url: https://www.findstat.org/St000162
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: NontrivialCycles(p)
    description: "Cycles of size at least two: the cycles less the fixed points."
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
