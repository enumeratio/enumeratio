---
name: UpperMiddleEntry
domain: Permutation statistics
signature: UpperMiddleEntry(p)
summary: The entry p(floor(n/2) + 1).
catalog:
  - system: findstat
    identity: St001806
    url: https://www.findstat.org/St001806
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: UpperMiddleEntry(p)
    description: The entry p(floor(n/2) + 1).
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
