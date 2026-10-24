---
name: MultinomialOfParts
domain: Partition statistics
signature: MultinomialOfParts(partition)
summary: "The multinomial coefficient of the size over the parts: the size factorial over the product of the factorials of the parts."
signatures:
  - call: MultinomialOfParts(partition)
    description: "The multinomial coefficient of the size over the parts: the size factorial over the product of the factorials of the parts."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
catalog:
  - system: findstat
    identity: St000048
    url: https://www.findstat.org/St000048
    on: IntegerPartition
statOn:
  - IntegerPartition
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
