---
name: ShortestConstantRun
domain: Composition statistics
signature: ShortestConstantRun(composition)
summary: The length of the shortest run of equal parts.
catalog:
  - system: findstat
    identity: St000900
    url: https://www.findstat.org/St000900
    on: Composition
statOn:
  - Composition
signatures:
  - call: ShortestConstantRun(composition)
    description: The length of the shortest run of equal parts.
    library: enumeratio-combinatorics
    type: (composition) -> number
---

- Defined over `Composition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Composition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
