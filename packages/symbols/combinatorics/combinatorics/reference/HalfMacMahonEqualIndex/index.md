---
name: HalfMacMahonEqualIndex
domain: Dyck path statistics
signature: HalfMacMahonEqualIndex(path)
summary: Half the sum of the positions of double rises and double falls.
catalog:
  - system: findstat
    identity: St000979
    url: https://www.findstat.org/St000979
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: HalfMacMahonEqualIndex(path)
    description: Half the sum of the positions of double rises and double falls.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Half of `MacMahonEqualIndex`, which is even on a Dyck path.
