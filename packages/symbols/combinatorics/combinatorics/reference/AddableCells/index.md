---
name: AddableCells
domain: Partition statistics
signature: AddableCells(partition)
summary: "Cells that can be added to the diagram and leave a partition: one more than the distinct parts."
catalog:
  - system: findstat
    identity: St000318
    url: https://www.findstat.org/St000318
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: AddableCells(partition)
    description: "Cells that can be added to the diagram and leave a partition: one more than the distinct parts."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_stat("IntegerPartition", $1, "AddableCells")
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
