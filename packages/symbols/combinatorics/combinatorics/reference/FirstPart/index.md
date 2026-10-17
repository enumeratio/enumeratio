---
name: FirstPart
domain: Composition statistics
signature: FirstPart(composition)
summary: The first part.
catalog:
  - system: findstat
    identity: St000382
    url: https://www.findstat.org/St000382
    on: Composition
statOn:
  - Composition
signatures:
  - call: FirstPart(composition)
    description: The first part.
    library: enumeratio-combinatorics
    type: (composition) -> number
---

- Defined over `Composition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Composition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
