---
name: BargraphHalfPerimeter
domain: Composition statistics
signature: BargraphHalfPerimeter(composition)
summary: Up steps plus horizontal steps of the bargraph.
catalog:
  - system: findstat
    identity: St000806
    url: https://www.findstat.org/St000806
    on: Composition
statOn:
  - Composition
signatures:
  - call: BargraphHalfPerimeter(composition)
    description: Up steps plus horizontal steps of the bargraph.
    library: enumeratio-combinatorics
    type: (composition) -> number
---

- Defined over `Composition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Composition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Deutsch and Elizalde, A bijection between bargraphs and Dyck paths, and FindStat call it the semiperimeter.
