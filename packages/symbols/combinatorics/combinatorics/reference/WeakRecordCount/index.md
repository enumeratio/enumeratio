---
name: WeakRecordCount
domain: Composition statistics
signature: WeakRecordCount(composition)
summary: Parts at least as great as every part before.
catalog:
  - system: findstat
    identity: St000765
    url: https://www.findstat.org/St000765
    on: Composition
statOn:
  - Composition
signatures:
  - call: WeakRecordCount(composition)
    description: Parts at least as great as every part before.
    library: enumeratio-combinatorics
    type: (composition) -> number
---

- Defined over `Composition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Composition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Knopfmacher and Mansour, Record statistics in integer compositions.
