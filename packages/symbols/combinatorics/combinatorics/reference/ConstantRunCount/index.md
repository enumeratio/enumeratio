---
name: ConstantRunCount
domain: Composition statistics
signature: ConstantRunCount(composition)
summary: Maximal runs of equal parts.
catalog:
  - system: findstat
    identity: St000767
    url: https://www.findstat.org/St000767
    on: Composition
statOn:
  - Composition
signatures:
  - call: ConstantRunCount(composition)
    description: Maximal runs of equal parts.
    library: enumeratio-combinatorics
    type: (composition) -> number
---

- Defined over `Composition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Composition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Hopkins, Shattuck and Sills, Parts and subword patterns in compositions.
