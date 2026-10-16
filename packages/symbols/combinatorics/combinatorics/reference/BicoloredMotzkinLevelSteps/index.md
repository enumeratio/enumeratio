---
name: BicoloredMotzkinLevelSteps
domain: Dyck path statistics
signature: BicoloredMotzkinLevelSteps(path)
summary: "The level steps of that bicolored Motzkin path: pairs of steps with one up and one down."
catalog:
  - system: findstat
    identity: St001032
    url: https://www.findstat.org/St001032
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: BicoloredMotzkinLevelSteps(path)
    description: "The level steps of that bicolored Motzkin path: pairs of steps with one up and one down."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
