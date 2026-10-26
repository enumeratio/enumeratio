---
name: CycleDescents
domain: Permutation statistics
signature: CycleDescents(p)
summary: Steps down within the cycles, each written from its smallest point.
catalog:
  - system: findstat
    identity: St000317
    url: https://www.findstat.org/St000317
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: CycleDescents(p)
    description: Steps down within the cycles, each written from its smallest point.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
