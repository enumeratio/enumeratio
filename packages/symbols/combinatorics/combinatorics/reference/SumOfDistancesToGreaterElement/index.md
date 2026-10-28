---
name: SumOfDistancesToGreaterElement
domain: Permutation statistics
signature: SumOfDistancesToGreaterElement(p)
summary: Over each position, the gap to the nearest greater entry, the ends counting as greater.
catalog:
  - system: findstat
    identity: St000625
    url: https://www.findstat.org/St000625
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: SumOfDistancesToGreaterElement(p)
    description: Over each position, the gap to the nearest greater entry, the ends counting as greater.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
