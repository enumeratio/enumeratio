---
name: SmallestMultiplicity
domain: Composition statistics
signature: SmallestMultiplicity(composition)
summary: The smallest number of parts of one size, among the sizes that occur.
catalog:
  - system: findstat
    identity: St000902
    url: https://www.findstat.org/St000902
    on: Composition
statOn:
  - Composition
signatures:
  - call: SmallestMultiplicity(composition)
    description: The smallest number of parts of one size, among the sizes that occur.
    library: enumeratio-combinatorics
    type: (composition) -> number
---

- Defined over `Composition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Composition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
