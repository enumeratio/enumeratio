---
name: BargraphValleyHeightSum
domain: Composition statistics
signature: BargraphValleyHeightSum(composition)
summary: The sum of the heights of the valleys of the bargraph.
catalog:
  - system: findstat
    identity: St000807
    url: https://www.findstat.org/St000807
    on: Composition
statOn:
  - Composition
signatures:
  - call: BargraphValleyHeightSum(composition)
    description: The sum of the heights of the valleys of the bargraph.
    library: enumeratio-combinatorics
    type: (composition) -> number
---

- Defined over `Composition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Composition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- A valley is a fall, level steps, then a rise (Deutsch and Elizalde, A bijection between bargraphs and Dyck paths).
