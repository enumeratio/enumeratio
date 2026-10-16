---
name: BicoloredMotzkinHeight
domain: Dyck path statistics
signature: BicoloredMotzkinHeight(path)
summary: "The height of the bicolored Motzkin path made by reading the steps in pairs: two up steps rise, two down steps fall."
catalog:
  - system: findstat
    identity: St001031
    url: https://www.findstat.org/St001031
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: BicoloredMotzkinHeight(path)
    description: "The height of the bicolored Motzkin path made by reading the steps in pairs: two up steps rise, two down steps fall."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
