---
name: SetValuedTableauComajorIndex
domain: Dyck path statistics
signature: SetValuedTableauComajorIndex(path)
summary: "The comajor index of the set-valued two-row tableau the path corresponds to: the sum, over its natural descents k, of the semilength plus one less k."
catalog:
  - system: findstat
    identity: St001956
    url: https://www.findstat.org/St001956
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: SetValuedTableauComajorIndex(path)
    description: "The comajor index of the set-valued two-row tableau the path corresponds to: the sum, over its natural descents k, of the semilength plus one less k."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat's St001956; the natural descents are those of `SetValuedTableauNaturalDescents`.
