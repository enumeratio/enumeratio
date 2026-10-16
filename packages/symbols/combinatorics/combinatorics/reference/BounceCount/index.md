---
name: BounceCount
domain: Dyck path statistics
signature: BounceCount(path)
summary: The number of bounce points of the bounce path, not counting the two ends.
catalog:
  - system: findstat
    identity: St000306
    url: https://www.findstat.org/St000306
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: BounceCount(path)
    description: The number of bounce points of the bounce path, not counting the two ends.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
