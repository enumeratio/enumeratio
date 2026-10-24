---
name: FirstEntry
domain: Permutation statistics
signature: FirstEntry(p)
summary: The first entry p(1).
signatures:
  - call: FirstEntry(p)
    description: The first entry p(1).
    library: enumeratio-combinatorics
    type: (permutation) -> number
catalog:
  - system: findstat
    identity: St000054
    url: https://www.findstat.org/St000054
    on: Permutation
statOn:
  - Permutation
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
