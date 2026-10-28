---
name: BulgarianSolitairePreimageCount
domain: Partition statistics
signature: BulgarianSolitairePreimageCount(partition)
summary: "The partitions of the same size that Bulgarian solitaire (remove the first column, insert it as a row) sends to this one: the distinct part sizes of at least the number of parts less one."
catalog:
  - system: findstat
    identity: St001913
    url: https://www.findstat.org/St001913
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: BulgarianSolitairePreimageCount(partition)
    description: "The partitions of the same size that Bulgarian solitaire (remove the first column, insert it as a row) sends to this one: the distinct part sizes of at least the number of parts less one."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
