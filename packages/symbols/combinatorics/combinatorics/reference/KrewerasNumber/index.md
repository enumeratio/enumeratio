---
name: KrewerasNumber
domain: Partition statistics
signature: KrewerasNumber(partition)
summary: "The number of noncrossing set partitions whose block sizes are the parts: the size factorial over the factorial of size + 1 - length and the factorials of the multiplicities."
signatures:
  - call: KrewerasNumber(partition)
    description: "The number of noncrossing set partitions whose block sizes are the parts: the size factorial over the factorial of size + 1 - length and the factorials of the multiplicities."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
catalog:
  - system: findstat
    identity: St000517
    url: https://www.findstat.org/St000517
    on: IntegerPartition
statOn:
  - IntegerPartition
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
