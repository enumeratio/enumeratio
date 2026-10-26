---
name: StretchingPairs
domain: Permutation statistics
signature: StretchingPairs(p)
summary: Pairs i < j with p(i) < i < j < p(j).
catalog:
  - system: findstat
    identity: St000516
    url: https://www.findstat.org/St000516
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: StretchingPairs(p)
    description: Pairs i < j with p(i) < i < j < p(j).
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
