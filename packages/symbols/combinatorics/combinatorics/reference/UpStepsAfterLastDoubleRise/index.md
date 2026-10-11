---
name: UpStepsAfterLastDoubleRise
domain: Dyck path statistics
signature: UpStepsAfterLastDoubleRise(path)
summary: Up steps after the first step of the last double rise; all of them if there is none.
catalog:
  - system: findstat
    identity: St000678
    url: https://www.findstat.org/St000678
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: UpStepsAfterLastDoubleRise(path)
    description: Up steps after the first step of the last double rise; all of them if there is none.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
