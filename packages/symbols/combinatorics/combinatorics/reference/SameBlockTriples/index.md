---
name: SameBlockTriples
domain: Set partition statistics
signature: SameBlockTriples(partition)
summary: Triples of elements in one block.
catalog:
  - system: findstat
    identity: St000561
    url: https://www.findstat.org/St000561
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: SameBlockTriples(partition)
    description: Triples of elements in one block.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
