---
name: MaximalExcedance
domain: Permutation statistics
signature: MaximalExcedance(p)
summary: The largest p(i) - i.
catalog:
  - system: findstat
    identity: St000141
    url: https://www.findstat.org/St000141
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: MaximalExcedance(p)
    description: The largest p(i) - i.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat's title says drop size, i - p(i); its code takes p(i) - i. This follows the code.
