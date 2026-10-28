---
name: LowerMiddleEntry
domain: Permutation statistics
signature: LowerMiddleEntry(p)
summary: The entry p(floor((n+1)/2)).
catalog:
  - system: findstat
    identity: St001807
    url: https://www.findstat.org/St001807
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: LowerMiddleEntry(p)
    description: The entry p(floor((n+1)/2)).
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
