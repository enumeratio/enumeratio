---
name: UpStepsAtEvenPositions
domain: Dyck path statistics
signature: UpStepsAtEvenPositions(path)
summary: Up steps at an even position, counting from 1.
catalog:
  - system: findstat
    identity: St000329
    url: https://www.findstat.org/St000329
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: UpStepsAtEvenPositions(path)
    description: Up steps at an even position, counting from 1.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
