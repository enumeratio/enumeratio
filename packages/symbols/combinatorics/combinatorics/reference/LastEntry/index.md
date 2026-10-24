---
name: LastEntry
domain: Permutation statistics
signature: LastEntry(p)
summary: The last entry p(n).
signatures:
  - call: LastEntry(p)
    description: The last entry p(n).
    library: enumeratio-combinatorics
    type: (permutation) -> number
catalog:
  - system: findstat
    identity: St000740
    url: https://www.findstat.org/St000740
    on: Permutation
statOn:
  - Permutation
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
