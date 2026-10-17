---
name: WordWeakMajorIndex
domain: Composition statistics
signature: WordWeakMajorIndex(composition)
summary: The sum of the positions i with c(i) >= c(i+1).
catalog:
  - system: findstat
    identity: St001931
    url: https://www.findstat.org/St001931
    on: Composition
statOn:
  - Composition
signatures:
  - call: WordWeakMajorIndex(composition)
    description: The sum of the positions i with c(i) >= c(i+1).
    library: enumeratio-combinatorics
    type: (composition) -> number
---

- Defined over `Composition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Composition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
