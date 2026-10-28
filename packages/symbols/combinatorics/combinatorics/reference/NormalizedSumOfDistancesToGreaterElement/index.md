---
name: NormalizedSumOfDistancesToGreaterElement
domain: Permutation statistics
signature: NormalizedSumOfDistancesToGreaterElement(p)
summary: "The same sum, each gap one less: the entries strictly between a position and its nearest greater entry."
catalog:
  - system: findstat
    identity: St000624
    url: https://www.findstat.org/St000624
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: NormalizedSumOfDistancesToGreaterElement(p)
    description: "The same sum, each gap one less: the entries strictly between a position and its nearest greater entry."
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
