---
name: StrongRecordCount
domain: Composition statistics
signature: StrongRecordCount(composition)
summary: "Parts greater than every part before: the first part and each new maximum."
catalog:
  - system: findstat
    identity: St000764
    url: https://www.findstat.org/St000764
    on: Composition
statOn:
  - Composition
signatures:
  - call: StrongRecordCount(composition)
    description: "Parts greater than every part before: the first part and each new maximum."
    library: enumeratio-combinatorics
    type: (composition) -> number
---

- Defined over `Composition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Composition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Knopfmacher and Mansour, Record statistics in integer compositions.
