---
name: InversionsOfThirdEntry
domain: Permutation statistics
signature: InversionsOfThirdEntry(p)
summary: Positions after the third with a smaller entry than p(3).
catalog:
  - system: findstat
    identity: St001556
    url: https://www.findstat.org/St001556
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: InversionsOfThirdEntry(p)
    description: Positions after the third with a smaller entry than p(3).
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
