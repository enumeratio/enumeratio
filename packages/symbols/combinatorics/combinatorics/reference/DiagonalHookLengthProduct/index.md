---
name: DiagonalHookLengthProduct
domain: Partition statistics
signature: DiagonalHookLengthProduct(partition)
summary: The product of the hook lengths of the cells on the main diagonal.
catalog:
  - system: findstat
    identity: St000870
    url: https://www.findstat.org/St000870
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: DiagonalHookLengthProduct(partition)
    description: The product of the hook lengths of the cells on the main diagonal.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
