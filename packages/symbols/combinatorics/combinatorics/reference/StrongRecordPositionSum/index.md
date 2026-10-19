---
name: StrongRecordPositionSum
domain: Composition statistics
signature: StrongRecordPositionSum(composition)
summary: The sum of the positions of the strong records.
catalog:
  - system: findstat
    identity: St000763
    url: https://www.findstat.org/St000763
    on: Composition
statOn:
  - Composition
signatures:
  - call: StrongRecordPositionSum(composition)
    description: The sum of the positions of the strong records.
    library: enumeratio-combinatorics
    type: (composition) -> number
---

- Defined over `Composition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Composition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Knopfmacher and Mansour, Record statistics in integer compositions.
