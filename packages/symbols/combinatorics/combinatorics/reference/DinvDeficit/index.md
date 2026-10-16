---
name: DinvDeficit
domain: Dyck path statistics
signature: DinvDeficit(path)
summary: "The binomial(n, 2) less the area and the dinv: the boxes of the partition traced out by the path where leg minus arm is not 0 or 1."
catalog:
  - system: findstat
    identity: St000369
    url: https://www.findstat.org/St000369
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: DinvDeficit(path)
    description: "The binomial(n, 2) less the area and the dinv: the boxes of the partition traced out by the path where leg minus arm is not 0 or 1."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
