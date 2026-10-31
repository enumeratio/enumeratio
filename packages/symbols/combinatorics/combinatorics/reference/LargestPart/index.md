---
name: LargestPart
domain: Partition statistics
signature: LargestPart(partition)
summary: The largest part.
catalog:
  - system: findstat
    identity: St001447
    url: https://www.findstat.org/St001447
    on: PlanePartition
  - system: findstat
    identity: St000381
    url: https://www.findstat.org/St000381
    on: Composition
  - system: findstat
    identity: St000147
    url: https://www.findstat.org/St000147
    on: IntegerPartition
statOn:
  - Composition
  - CorePartition
  - IntegerPartition
  - PlanePartition
  - WeakComposition
signatures:
  - call: LargestPart(partition)
    description: The largest part.
    library: enumeratio-combinatorics
    type: (composition | integer_partition | plane_partition) -> number
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_stat("IntegerPartition", $1, "LargestPart")
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
