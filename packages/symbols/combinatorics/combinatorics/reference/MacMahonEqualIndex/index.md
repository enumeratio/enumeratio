---
name: MacMahonEqualIndex
domain: Dyck path statistics
signature: MacMahonEqualIndex(path)
summary: "The sum of the positions of double rises and double falls: MacMahon's equal index of the step word."
catalog:
  - system: findstat
    identity: St000977
    url: https://www.findstat.org/St000977
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: MacMahonEqualIndex(path)
    description: "The sum of the positions of double rises and double falls: MacMahon's equal index of the step word."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
