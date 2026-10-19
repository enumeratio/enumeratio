---
name: BargraphPeakCount
domain: Composition statistics
signature: BargraphPeakCount(composition)
summary: "Peaks of the bargraph with bars of these heights: a rise, level steps, then a fall."
catalog:
  - system: findstat
    identity: St000805
    url: https://www.findstat.org/St000805
    on: Composition
statOn:
  - Composition
signatures:
  - call: BargraphPeakCount(composition)
    description: "Peaks of the bargraph with bars of these heights: a rise, level steps, then a fall."
    library: enumeratio-combinatorics
    type: (composition) -> number
---

- Defined over `Composition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Composition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Deutsch and Elizalde, A bijection between bargraphs and Dyck paths.
