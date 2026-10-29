---
name: SetValuedTableauNaturalDescents
domain: Dyck path statistics
signature: SetValuedTableauNaturalDescents(path)
summary: The natural descents of the set-valued two-row tableau the path corresponds to, read off the step pairs by FindStat's rules.
catalog:
  - system: findstat
    identity: St001955
    url: https://www.findstat.org/St001955
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: SetValuedTableauNaturalDescents(path)
    description: The natural descents of the set-valued two-row tableau the path corresponds to, read off the step pairs by FindStat's rules.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat's St001955. The rules go through bicolored Motzkin paths; they are stated on the path itself and implemented as given.
